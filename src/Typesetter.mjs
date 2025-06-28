import { compressedSequences } from '../data/grapheme-clusters.mjs';
import { codepointCount } from './constants.mjs';
import { loadTable } from './data.mjs';
import { splitKey } from './cluster-key.mjs';

export class Typesetter {
	constructor(env = globalThis.process?.env ?? {}) {
		const { _mergedTable, _read, _fontSequences } = loadTable(env);
		this.measureCodepoint = _read;
		const lastChange = _mergedTable[_mergedTable.length - 1];
		this._supportsGraphemeClusters =
			lastChange[0] > codepointCount || lastChange[1] !== null
				? 2
				: _fontSequences
					? 1
					: 0;
	}

	supportsGraphemeClusters() {
		return this._supportsGraphemeClusters === 2;
	}

	measureCharacter(char) {
		return this.measureCodepoint(
			typeof char === 'number' ? char : char.codePointAt(0),
		);
	}

	makeState({ skipAnsi = true } = {}) {
		return {
			_skipAnsi: skipAnsi,
			_isAnsi: 0,
			_isEsc: false,
			_patterns: new Map(),
			_checkClusters: this._supportsGraphemeClusters === 2,
			_renderedW: 0,
			uncertainCodepoints: 0,
		};
	}

	_getGraphemeCluster(codepoint, state, codepointW) {
		if (!state._checkClusters) {
			return null;
		}
		const relevantPatterns = SEQUENCE_PATTERN_CHARS.get(codepoint) ?? EMPTY;
		for (const index of state._patterns.keys()) {
			if (!relevantPatterns.has(index)) {
				state._patterns.delete(index);
			}
		}
		let bestMatch = null;
		let longestPattern = 0;
		for (const index of relevantPatterns) {
			const { _pattern, _rangeBegin } = SEQUENCE_PATTERNS[index];
			let patternState = state._patterns.get(index);
			if (!patternState) {
				patternState = [];
				state._patterns.set(index, patternState);
			}
			let prev = { _patternIndex: 0, _sequenceCols: 0, _codepoints: 0 };
			for (let j = 0; j < _pattern.length; ++j) {
				const part = _pattern[j];
				const size = part.codepoints.length + (part.optional ? 1 : 0);
				let next = patternState[j];
				patternState[j] = null;
				if (prev) {
					const m = part.codepoints.indexOf(codepoint);
					if (m !== -1) {
						const codepoints = prev._codepoints + 1;
						patternState[j] = {
							_patternIndex:
								prev._patternIndex * size + m + (part.optional ? 1 : 0),
							_sequenceCols: prev._sequenceCols + codepointW,
							_codepoints: codepoints,
						};
						if (codepoints > longestPattern) {
							longestPattern = codepoints;
						}
					}
					if (part.optional && !next) {
						next = { ...prev, _patternIndex: prev._patternIndex * size };
					}
				}
				prev = next;
			}
			const result = patternState[patternState.length - 1] ?? prev;
			patternState[patternState.length - 1] = null;
			if (result) {
				const joinedW = this.measureCodepoint(
					_rangeBegin + result._patternIndex,
				);
				if (
					joinedW !== null &&
					(!bestMatch || result._codepoints > bestMatch._codepoints)
				) {
					bestMatch = {
						_w: joinedW,
						_wdiff: joinedW - result._sequenceCols,
						_codepoints: result._codepoints,
					};
				}
			}
		}

		if (!bestMatch) {
			state.uncertainCodepoints = longestPattern;
			return null;
		}

		// update other in-progress patterns to account for the
		// change in width from this potentially partial match
		longestPattern = 0;
		for (const index of relevantPatterns) {
			const patternState = state._patterns.get(index);
			if (patternState) {
				for (let j = 0; j < patternState.length; ++j) {
					const ps = patternState[j];
					if (ps && ps._codepoints >= bestMatch._codepoints) {
						ps._sequenceCols += bestMatch._wdiff;
						if (ps._codepoints > longestPattern) {
							longestPattern = ps._codepoints;
						}
					} else {
						patternState[j] = null;
					}
				}
			}
		}
		state.uncertainCodepoints = longestPattern;
		return bestMatch;
	}

	measureCodepointStateful(codepoint, state) {
		if (state._skipAnsi && isAnsiEscape(codepoint, state)) {
			state._renderedW = 0;
			state.uncertainCodepoints = 0;
			return 0;
		}

		const codepointW = this.measureCodepoint(codepoint);

		const cluster = this._getGraphemeCluster(codepoint, state, codepointW);
		if (cluster) {
			state._renderedW = cluster._w;
			return codepointW + cluster._wdiff;
		} else {
			state._renderedW = codepointW;
			return codepointW;
		}
	}

	measureString(string, options) {
		let w = 0;
		const state = this.makeState(options);
		for (let i = 0; i < string.length; ++i) {
			const codepoint = string.codePointAt(i);
			if (codepoint >= 0x010000) {
				++i; // skip past surrogate pair
			}
			const cw = this.measureCodepointStateful(codepoint, state);
			if (cw !== null) {
				w += cw;
			}
		}
		return w;
	}

	measureStringProgressive(options) {
		let w = 0;
		const state = this.makeState(options);
		return (char) => {
			const codepoint = typeof char === 'number' ? char : char.codePointAt(0);
			const cw = this.measureCodepointStateful(codepoint, state);
			if (cw !== null) {
				w += cw;
			}
			return w;
		};
	}

	*typeset(
		string,
		{
			columnLimit = globalThis.process?.stdout.columns ??
				Number.POSITIVE_INFINITY,
			padUnsupportedCharacters = true,
			softHyphens = true,
			niceWrap = true,
			atomicGraphemeClusters = true,
			tabSize = 8,
			beginColumn = 0,
			wrapColumn = beginColumn,
			...options
		} = {},
	) {
		// substitute minimum workable values if input is unworkable
		if (beginColumn >= columnLimit && wrapColumn >= columnLimit) {
			beginColumn = 0;
			wrapColumn = 0;
			columnLimit = 1;
		} else if (wrapColumn >= columnLimit) {
			wrapColumn = columnLimit - 1;
		}

		const targetW = padUnsupportedCharacters ? loadTable({})._read : null;
		const state = this.makeState(options);
		state._checkClusters ||= atomicGraphemeClusters === true;
		const currentSegment = {
			_joinType: 2, // 1 = continuous, 2 = whitespace, 3 = soft hyphen
			_parts: [],
			_size: 0,
			_breakI: -1,
			_breakS: 0,
		};
		const currentLine = [];
		let swallowLeadingSpace = false;
		let emergencyWrap = false;
		let column = beginColumn;

		function completeLine(trailer) {
			if (!currentLine.length) {
				return trailer;
			}
			const ln =
				(currentLine.length === 1 ? currentLine[0] : currentLine.join('')) +
				trailer;
			currentLine.length = 0;
			return ln;
		}

		function* completeSegment(newJoinType) {
			if (column + currentSegment._size > columnLimit) {
				if (currentSegment._joinType === 2) {
					swallowLeadingSpace = true;
				} else if (currentSegment._joinType === 3) {
					currentLine.push('-');
				}
				yield completeLine('\n');
				column = wrapColumn;
			}
			if (currentSegment._parts.length > 0) {
				currentLine.push(
					currentSegment._parts.length === 1
						? currentSegment._parts[0]
						: currentSegment._parts.join(''),
				);
				column += currentSegment._size;
				currentSegment._parts.length = 0;
				currentSegment._size = 0;
				currentSegment._breakI = -1;
			}
			currentSegment._joinType = newJoinType;
		}

		for (let i = 0; i < string.length; ++i) {
			const codepoint = string.codePointAt(i);
			if (codepoint >= 0x010000) {
				++i; // skip past surrogate pair
			}

			const prevW = state._renderedW;
			let c = String.fromCodePoint(codepoint);
			let cw = this.measureCodepointStateful(codepoint, state);
			if (padUnsupportedCharacters && cw === 1 && targetW(codepoint) === 2) {
				c += ' ';
				cw += this.measureCodepointStateful(0x20, state); // reset grapheme clusters if necessary
			}
			if (swallowLeadingSpace) {
				if (isSpace(codepoint)) {
					continue;
				}
				swallowLeadingSpace = false;
			}
			if (cw === null) {
				if (codepoint === 0x0009 && tabSize > 0) {
					yield* completeSegment(2);
					const next = (Math.floor(column / tabSize) + 1) * tabSize;
					if (niceWrap) {
						cw = Math.min(next, columnLimit) - column;
					} else {
						if (next > columnLimit) {
							cw = tabSize;
						} else {
							cw = next - column;
						}
					}
					c = ' '.repeat(cw);
				} else if (codepoint === 0x000a) {
					yield* completeSegment(0);
					yield completeLine('\n');
					column = wrapColumn;
					continue;
				} else if (codepoint === 0x000d) {
					yield* completeSegment(0);
					yield completeLine('\r');
					column = wrapColumn;
					continue;
				} else {
					cw = 0;
				}
			}
			const isHidden = state._isAnsi || state._isEsc;
			if (
				(state.uncertainCodepoints <= 1 || !atomicGraphemeClusters) &&
				!isHidden
			) {
				if (!niceWrap) {
					yield* completeSegment(1);
				} else if (isSpace(codepoint)) {
					emergencyWrap = false;
					yield* completeSegment(2);
					if (column + cw <= columnLimit) {
						currentSegment._parts.push(c);
						currentSegment._size += cw;
						yield* completeSegment(2);
					} else {
						yield completeLine('\n');
						column = wrapColumn;
						swallowLeadingSpace = true;
					}
					continue;
				} else if (codepoint === 0x00ad && softHyphens) {
					emergencyWrap = false;
					yield* completeSegment(3);
					continue;
				} else if (prevW === 2) {
					emergencyWrap = false;
					yield* completeSegment(1);
				}
			}
			if (emergencyWrap) {
				if (column + cw > columnLimit) {
					yield completeLine('\n');
					column = wrapColumn;
				}
				currentLine.push(c);
				column += cw;
				continue;
			}
			if (niceWrap) {
				if (
					currentSegment._breakI === -1 &&
					column + currentSegment._size + cw > columnLimit
				) {
					// record this location in case we need to apply character-based wrapping
					currentSegment._breakI = currentSegment._parts.length;
					currentSegment._breakS = currentSegment._size;
				}
				if (
					Math.min(column, wrapColumn) + currentSegment._size + cw >
					columnLimit
				) {
					// emergency character-based wrapping: this segment
					// will no longer fit no matter how we wrap it
					currentLine.push(
						currentSegment._parts.splice(0, currentSegment._breakI).join(''),
					);
					yield completeLine('\n');
					currentLine.push(currentSegment._parts.join(''));
					column = wrapColumn + currentSegment._size - currentSegment._breakS;
					if (column >= columnLimit) {
						yield completeLine('\n');
						column = wrapColumn;
					}
					currentLine.push(c);
					column += cw;
					currentSegment._parts.length = 0;
					currentSegment._size = 0;
					currentSegment._breakI = -1;
					emergencyWrap = true;
					continue;
				}
			}
			currentSegment._parts.push(c);
			currentSegment._size += cw;
		}
		yield* completeSegment(0);
		if (currentLine.length > 0) {
			yield currentLine.join('');
		}
	}
}

function isAnsiEscape(codepoint, state) {
	if (codepoint === 0x1b) {
		state._isEsc = true;
		return true;
	}
	if (state._isEsc) {
		state._isEsc = false;
		if (codepoint >= 0x40 && codepoint <= 0x5f) {
			const c1equiv = codepoint + 0x40;
			if (state._isAnsi) {
				if (c1equiv === 0x9c) {
					state._isAnsi = 0;
				}
			} else if (c1equiv !== 0x9c) {
				// TODO: various termination requirements for different codes
				state._isAnsi = c1equiv;
			}
			return true;
		}
	}
	// https://en.wikipedia.org/wiki/ANSI_escape_code
	switch (state._isAnsi) {
		case 0:
			return false;
		case 0x9b: // Control Sequence
			if (codepoint < 0x20 || codepoint > 0x7e) {
				// invalid character for ANSI escape
				state._isAnsi = 0;
				return false;
			} else if (codepoint >= 0x40 && codepoint <= 0x7e) {
				// terminating character
				state._isAnsi = 0;
			}
			return true;
		case 0x9d:
			if (codepoint === 0x09) {
				// bel (terminating character)
				state._isAnsi = 0;
			}
			return true;
		default:
			return true;
	}
}

const SEQUENCE_PATTERN_CHARS = new Map();
const EMPTY = new Set();
const SEQUENCE_PATTERNS = compressedSequences
	.split(' ')
	.map(splitKey)
	.map((pattern) => ({ _pattern: pattern, _rangeBegin: 0 }));

for (let i = 0, p = codepointCount; i < SEQUENCE_PATTERNS.length; ++i) {
	SEQUENCE_PATTERNS[i]._rangeBegin = p;
	let count = 1;
	for (const part of SEQUENCE_PATTERNS[i]._pattern) {
		for (const codepoint of part.codepoints) {
			const list = SEQUENCE_PATTERN_CHARS.get(codepoint) ?? new Set();
			list.add(i);
			SEQUENCE_PATTERN_CHARS.set(codepoint, list);
		}
		count *= part.codepoints.length + (part.optional ? 1 : 0);
	}
	p += count;
}

function isSpace(codepoint) {
	return codepoint === 0x0009 || codepoint === 0x0020;
}
