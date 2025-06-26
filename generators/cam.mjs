#!/usr/bin/env -S node

// this is an updated version of cam-kuhn.mjs which applies the rules
// defined by Markus Kuhn to any version of Unicode

// Note: unlike the original, this (typically) marks unassigned
// characters as 1, instead of maintaining the previous width

import { codepointCount, UNSUPPORTED } from '../src/constants.mjs';
import {
	codepointsToString,
	explodeGraphemeClusterKeys,
} from '../src/read-grapheme-clusters.mjs';
import { Compressor } from '../src/Compressor.mjs';
import { readOrdered } from '../dev-utils/readers.mjs';
import {
	loadUnicodeRangeData,
	loadUnicodeStringData,
} from '../dev-utils/unicode-data.mjs';
import { compressedSequences } from '../data/grapheme-clusters.mjs';

const unicodeVersion = process.argv[2];
if (!unicodeVersion) {
	process.stderr.write('Must specify Unicode version to use (e.g. 16.0.0)\n');
	process.exit(1);
}

const uGeneralCategory = readOrdered(
	await loadUnicodeRangeData(
		`https://www.unicode.org/Public/${unicodeVersion}/ucd/extracted/DerivedGeneralCategory.txt`,
	),
);

const uEastAsianWidth = readOrdered(
	await loadUnicodeRangeData(
		`https://www.unicode.org/Public/${unicodeVersion}/ucd/EastAsianWidth.txt`,
	),
);

const compressor = new Compressor(out);

// Characters
for (let char = 0x000000; char < codepointCount; ++char) {
	compressor.add(char, wcwidth(char));
}

// Emoji sequences
const shortUV = /^(\d+\.\d+)\..*$/.exec(unicodeVersion)[1];

const uEmojiSequences = await loadUnicodeStringData(
	`https://www.unicode.org/Public/emoji/${shortUV}/emoji-sequences.txt`,
);

const uEmojiZwjSequences = await loadUnicodeStringData(
	`https://www.unicode.org/Public/emoji/${shortUV}/emoji-zwj-sequences.txt`,
);

const known = new Set();
for (const [seq] of uEmojiSequences) {
	known.add(codepointsToString(seq));
}
for (const [seq] of uEmojiZwjSequences) {
	known.add(codepointsToString(seq));
}

let i = codepointCount;
for (const seq of explodeGraphemeClusterKeys(compressedSequences)) {
	if (known.has(codepointsToString(seq))) {
		compressor.add(i, 2);
	} else {
		compressor.add(i, UNSUPPORTED);
	}
	++i;
}

compressor.close();
process.stdout.write('\n');

function wcwidth(i) {
	switch (i) {
		case 0x000000: // null
			return 0;
		case 0x00ad: // soft hyphen (1 if displayed, else 0)
			return 1;
	}
	if (i >= 0x1160 && i <= 0x11ff) {
		return 0; // Hangul Jamo medial vowels & final consonants
	}
	switch (uGeneralCategory(i)[2]) {
		case 'Cc': // control
			return UNSUPPORTED;
		case 'Cf': // format
			return 0;
		case 'Mn': // non-spacing combining mark
		case 'Me': // enclosing mark
			return 0;
	}
	switch (uEastAsianWidth(i)[2] ?? 'N') {
		case 'F': // fullwidth
		case 'W': // wide
			return 2;
		case 'H': // halfwidth
		case 'Na': // narrow
			return 1;
		case 'A': // ambiguous
			return 1; // pick narrow, as in original methodology
		default: // neutral
			return 1; // pick narrow, as in original methodology
	}
}

function out(char, w) {
	process.stdout.write(`${w + 2}${char.toString(36).padStart(4, '0')}`);
}
