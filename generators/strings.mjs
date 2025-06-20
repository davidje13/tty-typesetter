#!/usr/bin/env -S node

import { loadUnicodeStringData } from './tools/unicode-data.mjs';
import { makeSequenceKey } from './tools/read-strings.mjs';
import { KEY_PART } from '../src/sequence-key.mjs';

const unicodeVersion = process.argv[2];
if (!unicodeVersion) {
	process.stderr.write('Must specify Unicode version to use (e.g. 16.0.0)\n');
	process.exit(1);
}
const shortUV = /^(\d+\.\d+)\..*$/.exec(unicodeVersion)[1];

const uEmojiSequences = await loadUnicodeStringData(
	`https://www.unicode.org/Public/emoji/${shortUV}/emoji-sequences.txt`,
);

const uEmojiZwjSequences = await loadUnicodeStringData(
	`https://www.unicode.org/Public/emoji/${shortUV}/emoji-zwj-sequences.txt`,
);

const allSequences = new Set();

for (const [seq] of uEmojiSequences) {
	const key = makeSequenceKey(seq);
	// single-character sequences already captured as regular characters
	if (seq.length > 1) {
		allSequences.add(key);
	}
}

for (const [seq] of uEmojiZwjSequences) {
	const key = makeSequenceKey(seq);
	if (seq.length > 1) {
		allSequences.add(key);
	}
}

let split = [...allSequences].map((key) =>
	[...key.matchAll(KEY_PART)].map(([, k, opt]) => [k, Boolean(opt)]),
);

for (let combined = true; combined; ) {
	combined = false;
	for (const a of split) {
		if (!a) {
			continue;
		}
		for (let ib = 0; ib < split.length; ++ib) {
			const b = split[ib];
			if (!b || a === b) {
				continue;
			}
			if (b.length === a.length) {
				let mismatch = -1;
				for (let i = 0; i < a.length; ++i) {
					const matchK = a[i][0] === b[i][0];
					const matchO = a[i][1] === b[i][1];
					if (!matchO) {
						mismatch = -1;
						break;
					} else if (!matchK) {
						if (a[i][0].length === 1 || b[i][0].length === 1) {
							mismatch = -1;
							break;
						} else if (mismatch === -1) {
							mismatch = i;
						} else {
							mismatch = -1;
							break;
						}
					}
				}
				if (mismatch !== -1) {
					a[mismatch][0] = merge(a[mismatch][0], b[mismatch][0], '/');
					split[ib] = null;
					combined = true;
					break;
				}
			} else if (b.length === a.length - 1) {
				let mismatch = -1;
				for (let i = 0; i < a.length; ++i) {
					const j = mismatch === -1 ? i : i - 1;
					const matchK = a[i][0] === b[j]?.[0];
					const matchO = a[i][1] === b[j]?.[1];
					if (!matchO) {
						mismatch = -1;
						break;
					} else if (!matchK) {
						if (mismatch === -1) {
							mismatch = i;
						} else {
							mismatch = -1;
							break;
						}
					}
				}
				if (mismatch !== -1) {
					a[mismatch][1] = true;
					split[ib] = null;
					combined = true;
					break;
				}
			}
		}
	}
	split = split.filter((v) => v);
}

const combined = split
	.map((key) => key.map(([k, opt]) => k + (opt ? '?' : '')).join(''))
	.sort();

process.stdout.write(
	`export const strings=${JSON.stringify(combined.join(' '))};\n`,
);

function merge(a, b, joiner) {
	return [...new Set([...a.split(joiner), ...b.split(joiner)])]
		.sort()
		.join(joiner);
}
