import { merge, unpack } from './unpack.mjs';
import { data as cam16_0 } from '../data/cam-16.0.mjs';
import { data as linux } from '../data/tty-linux--.mjs';
import { data as xterm } from '../data/tty-xterm-256color--.mjs';
import { data as vscode_1_100_3 } from '../data/tty-xterm-256color-vscode-1.100.3.mjs';
import { data as apple455_1 } from '../data/tty-xterm-256color-Apple_Terminal-455.1.mjs';

const sources = [
	{
		_table: apple455_1,
		_fontSequences: true,
		_require: [['TERM_PROGRAM', 'Apple_Terminal']],
	},
	{
		_table: vscode_1_100_3,
		_fontSequences: false,
		_require: [['TERM_PROGRAM', 'vscode']],
	},
	{
		_table: xterm,
		_fontSequences: false,
		_require: [['TERM', 'xterm-256color']],
	},
	{
		_table: linux,
		_fontSequences: false,
		_require: [['TERM', 'linux']],
	},
	{ _table: cam16_0, _fontSequences: false },
];

export function loadTable(env) {
	for (const source of sources) {
		let match = true;
		for (const [key, requirement] of source._require ?? []) {
			const value = env[key];
			const keyMatch =
				typeof requirement === 'function'
					? requirement(value)
					: value === requirement;
			if (!keyMatch) {
				match = false;
				break;
			}
		}
		if (match) {
			source._mergedTable ??= merge(source._table.map(unpack));
			source._read ??= read(source._mergedTable);
			return source;
		}
	}
	throw new Error('failed to load width table');
}

const read = (data) => (i) => {
	let low = 0;
	let high = data.length;
	while (high > low + 1) {
		const mid = (low + high) >> 1;
		if (i >= data[mid][0]) {
			low = mid;
		} else {
			high = mid;
		}
	}
	return data[low][1];
};
