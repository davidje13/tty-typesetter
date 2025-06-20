import { codepointCount } from './constants.mjs';
import { strings } from '../data/strings.mjs';
import { loadTable } from './data.mjs';
import { splitKey } from './sequence-key.mjs';

export class Typesetter {
	constructor(env = globalThis.process?.env ?? {}) {
		const { _mergedTable, _read, _fontSequences } = loadTable(env);
		this.measureCodepoint = _read;
		const lastChange = _mergedTable[_mergedTable.length - 1];
		this._supportsMultiChar =
			lastChange[0] > codepointCount || lastChange[1] !== null
				? 2
				: _fontSequences
					? 1
					: 0;
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
			patterns: [],
			pos: 0,
		};
	}

	measureCodepointStateful(codepoint, state) {
		if (codepoint === 0x1b && state._skipAnsi) {
			state._isEsc = true;
			return 0;
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
				return 0;
			}
		}
		switch (state._isAnsi) {
			case 0:
				break;
			case 0x9b: // Control Sequence
				if (codepoint < 0x20 || codepoint > 0x7e) {
					// invalid character for ANSI escape
					state._isAnsi = 0;
					break;
				} else if (codepoint >= 0x40 && codepoint <= 0x7e) {
					// terminating character
					state._isAnsi = 0;
					return 0;
				} else {
					return 0;
				}
			case 0x9d:
				if (codepoint === 0x09) {
					// bel (terminating character)
					state._isAnsi = 0;
				}
				return 0;
			default:
				return 0;
		}

		const w = this.measureCodepoint(codepoint);
		if (this._supportsMultiChar !== 2) {
			return w;
		}

		let bestMatch = null;
		for (let i = 0; i < STRING_PATTERNS.length; ++i) {
			const { pattern, start } = STRING_PATTERNS[i];
			const pos = (state.patterns[i] ??= { p: 0, n: 0, s: 0 });
			if (pos.p === 0) {
				pos.s = state.pos;
			}
			while (true) {
				const part = pattern[pos.p];
				const m = part.codepoints.indexOf(codepoint);
				if (m !== -1) {
					pos.n =
						pos.n * (part.codepoints.length + (part.optional ? 1 : 0)) + m + 1;
					++pos.p;
					let match = true;
					for (let p = pos.p; match && p < pattern.length; ++p) {
						match &&= pattern[p].optional;
					}
					if (match) {
						const ww = this.measureCodepoint(start + pos.n);
						const posSeq = pos.s + ww + 0x100;
						let wdiff = (posSeq - state.pos) & 0xff;
						if (wdiff >= 0x80) {
							wdiff -= 0x100;
						}
						if (bestMatch === null || wdiff < bestMatch.wdiff) {
							bestMatch = { wdiff, posSeq };
						}
					}
					break;
				} else if (part.optional) {
					pos.n *= part.codepoints.length + 1;
					++pos.p;
					if (pos.p === pattern.length) {
						pos.p = 0;
						pos.n = 0;
						pos.s = state.pos;
					}
				} else if (pos.p > 0) {
					pos.p = 0;
					pos.n = 0;
					pos.s = state.pos;
				} else {
					break;
				}
			}
		}
		if (bestMatch) {
			state.pos = bestMatch.posSeq & 0xff;
			return bestMatch.wdiff;
		} else {
			if (w > 0) {
				state.pos = (state.pos + w) & 0xff;
			}
			return w;
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
			if (cw > 0) {
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
			if (cw > 0) {
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
			tabSize = 8,
			beginColumn = 0,
			wrapColumn = beginColumn,
			...options
		} = {},
	) {
		let targetW = null;
		if (padUnsupportedCharacters) {
			targetW = loadTable({})._read;
		}
		const state = this.makeState(options);
		let column = beginColumn;
		let currentLine = [];
		let wrap = WRAP_NONE;
		let swallowSpace = false;
		let lastJoiner = false;
		for (let i = 0; i < string.length; ++i) {
			const codepoint = string.codePointAt(i);
			if (codepoint >= 0x010000) {
				++i; // skip past surrogate pair
			}
			if (swallowSpace) {
				if (isSpace(codepoint)) {
					continue;
				} else {
					swallowSpace = false;
				}
			}
			let cw = this.measureCodepointStateful(codepoint, state);
			if (
				codepoint === 0x00ad &&
				softHyphens &&
				!state._isAnsi &&
				!state._isEsc
			) {
				cw = 1; // force display if we are using soft hyphens - we will display a regular hyphen
			}
			if (cw > 0) {
				let c = String.fromCodePoint(codepoint);
				if (padUnsupportedCharacters && cw === 1 && targetW(codepoint) === 2) {
					cw = 2;
					c += ' ';
				}
				if (column > 0 && column + cw > columnLimit) {
					if (isSpace(codepoint)) {
						wrap = {
							_pos: currentLine.length,
							_col: column,
							_softHyphen: false,
						};
					}
					if (niceWrap && wrap._pos > 0) {
						const ln = currentLine.splice(0, wrap._pos);
						if (wrap._softHyphen) {
							ln.push('-');
						}
						ln.push('\n');
						yield ln.join('');
						column += wrapColumn - wrap._col;
						wrap = WRAP_NONE;
						while (currentLine[0]?.startsWith(' ')) {
							currentLine.shift();
						}
					} else {
						currentLine.push('\n');
						yield currentLine.join('');
						currentLine.length = 0;
						column = wrapColumn;
						wrap = WRAP_NONE;
					}
					if (niceWrap) {
						if (!currentLine.length) {
							swallowSpace = true;
							if (isSpace(codepoint)) {
								lastJoiner = false;
								continue;
							}
						}
					}
				}
				if (codepoint === 0x0020) {
					column += cw;
					currentLine.push(' ');
					wrap = { _pos: currentLine.length, _col: column, _softHyphen: false };
				} else if (codepoint === 0x00ad && softHyphens) {
					wrap = { _pos: currentLine.length, _col: column, _softHyphen: true };
				} else {
					column += cw;
					currentLine.push(c);
					if (cw === 2 && !lastJoiner) {
						wrap = {
							_pos: currentLine.length,
							_col: column,
							_softHyphen: false,
						};
					}
				}
			} else if (cw < 0) {
				if (column < -cw) {
					// only possible if we added a line wrap inside an emoji sequence,
					// but that should not happen unless the terminal is very narrow
					// (prefers wrapping before emoji sequence)
					column = 0;
				} else {
					column += cw;
				}
			} else if (cw === 0) {
				currentLine.push(String.fromCodePoint(codepoint));
			} else if (codepoint === 0x0009 && tabSize >= 0) {
				const next = (Math.floor(column / tabSize) + 1) * tabSize;
				if (next >= columnLimit) {
					currentLine.push('\n');
					yield currentLine.join('');
					currentLine.length = 0;
					column = wrapColumn;
					wrap = WRAP_NONE;
					if (niceWrap) {
						swallowSpace = true;
					}
				} else {
					currentLine.push(' '.repeat(next - column));
					column = next;
					wrap = { _pos: currentLine.length, _col: column, _softHyphen: false };
				}
			} else if (codepoint === 0x000a) {
				currentLine.push('\n');
				yield currentLine.join('');
				currentLine.length = 0;
				column = wrapColumn;
				wrap = WRAP_NONE;
			} else if (codepoint === 0x000d) {
				currentLine.push('\r');
				yield currentLine.join('');
				currentLine.length = 0;
				column = wrapColumn;
				wrap = WRAP_NONE;
			} else {
				currentLine.push(String.fromCodePoint(codepoint));
			}

			lastJoiner = codepoint === 0x200d;
		}
		if (currentLine.length > 0) {
			yield currentLine.join('');
		}
	}
}

const STRING_PATTERNS = strings
	.split(' ')
	.map(splitKey)
	.map((pattern) => ({ pattern, begin: 0 }));

for (let i = 0, p = 0; i < STRING_PATTERNS.length; ++i) {
	STRING_PATTERNS[i].begin = p;
	let count = 1;
	for (const part of STRING_PATTERNS[i].pattern) {
		count *= part.codepoints.length + (part.optional ? 1 : 0);
	}
	p += count;
}

const WRAP_NONE = { _pos: 0, _col: 0, _softHyphen: false };

function isSpace(codepoint) {
	return codepoint === 0x0009 || codepoint === 0x0020;
}
