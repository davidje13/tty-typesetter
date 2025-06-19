import { merge, unpack } from './unpack.mjs';
import { data as cam16_0 } from '../data/cam-16.0.mjs';
import { data as linux } from '../data/tty-linux--.mjs';
import { data as xterm } from '../data/tty-xterm--.mjs';
import { data as lxterminal } from '../data/tty-lxterminal-0.4.0.mjs';
import { data as kitty } from '../data/tty-kitty.mjs';
import { data as urxvt } from '../data/tty-rxvt-unicode--.mjs';
import { data as vscode_1_100_3 } from '../data/tty-xterm-256color-vscode-1.100.3.mjs';
import { data as apple455_1 } from '../data/tty-xterm-256color-Apple_Terminal-455.1.mjs';
import { data as warp } from '../data/tty-warp-0.2025.06.mjs';
import { data as intellij } from '../data/tty-jediterm-2023.3.8.mjs';
import { data as eterm } from '../data/tty-eterm.mjs';

const sources = [
	{
		_table: apple455_1,
		_fontSequences: true,
		_require: [['TERM_PROGRAM', 'Apple_Terminal']],
	},
	{
		_table: intellij,
		_fontSequences: false,
		_require: [['TERMINAL_EMULATOR', 'JetBrains-JediTerm']],
	},
	{
		_table: vscode_1_100_3,
		_fontSequences: false,
		_require: [['TERM_PROGRAM', 'vscode']],
	},
	{
		_table: warp,
		_fontSequences: false,
		_require: [['TERM_PROGRAM', 'WarpTerminal']],
	},
	{
		_table: kitty,
		_fontSequences: false, // has full support for clusters
		_require: [['TERM', 'xterm-kitty']],
	},
	{
		_table: urxvt,
		_fontSequences: false,
		_require: [['TERM', 'rxvt-unicode']],
	},
	{
		_table: lxterminal,
		_fontSequences: false,
		_require: [['VTE_VERSION', (v) => Boolean(v)]], // TODO: find a better identifier (conflicts with xfce)
	},
	{
		_table: eterm,
		_fontSequences: false, // TODO: missing emoji are actually rendered as 2.5 cells wide
		_require: [['TERM', 'eterm-color']],
	},
	{ _table: xterm, _fontSequences: false, _require: [['TERM', 'xterm']] },
	{ _table: linux, _fontSequences: false, _require: [['TERM', 'linux']] },
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
