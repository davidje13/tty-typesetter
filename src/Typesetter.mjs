import { codepointCount, UNSUPPORTED } from '../generators/tools/constants.mjs';
import { loadTable } from './data.mjs';

export class Typesetter {
	constructor(env = globalThis.process?.env ?? {}) {
		const { _table, _read, _fontSequences } = loadTable(env);
		this.measureCodepoint = _read;
		const lastChange = _table[_table.length - 1];
		this._supportsMultiChar =
			lastChange[0] > codepointCount || lastChange[1] !== UNSUPPORTED
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
		return { _skipAnsi: skipAnsi, _isAnsi: false };
	}

	measureCodepointStateful(codepoint, state) {
		let w = this.measureCodepoint(codepoint);
		if (state._isAnsi) {
			if (
				(codepoint >= 0x41 && codepoint <= 0x5a) ||
				(codepoint >= 0x61 && codepoint <= 0x7a)
			) {
				state._isAnsi = false;
			}
			return 0;
		}
		if (codepoint === 0x1b && state._skipAnsi) {
			state._isAnsi = true;
			return 0;
		}
		// TODO: sequences

		return w;
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
			if (codepoint === 0x00ad && softHyphens && !state._isAnsi) {
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

const WRAP_NONE = { _pos: 0, _col: 0, _softHyphen: false };

function isSpace(codepoint) {
	return codepoint === 0x0009 || codepoint === 0x0020;
}
