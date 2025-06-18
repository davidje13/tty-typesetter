#!/usr/bin/env -S node

import { loadUnicodeStringData } from './tools/unicode-data.mjs';
import { makeSequenceKey } from './tools/read-strings.mjs';

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
const toPrint = [];

for (const [seq] of uEmojiSequences) {
	const key = makeSequenceKey(seq);
	// single-character sequences already captured as regular characters
	if (seq.length > 1 && !allSequences.has(key)) {
		allSequences.add(key);
		toPrint.push(key);
	}
}

for (const [seq] of uEmojiZwjSequences) {
	const key = makeSequenceKey(seq);
	if (seq.length > 1 && !allSequences.has(key)) {
		allSequences.add(key);
		toPrint.push(key);
	}
}

process.stdout.write(
	`export const strings=${JSON.stringify(toPrint.sort().join(' '))};\n`,
);
