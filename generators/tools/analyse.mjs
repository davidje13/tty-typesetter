#!/usr/bin/env -S node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { merge, unpack } from '../../src/unpack.mjs';
import { strings } from '../../data/strings.mjs';
import { notesTable } from '../notes.mjs';
import {
	readNextChangeCharacter,
	readOrdered,
	readRandomAccess,
} from './readers.mjs';
import { loadUnicodeRangeData } from './unicode-data.mjs';
import {
	codepointsToString,
	explodeSequenceKey,
	printSequenceKey,
} from './read-strings.mjs';
import { toLink, toTable } from './html.mjs';
import { codepointCount, IGNORE, UNSUPPORTED } from '../../src/constants.mjs';

const SELF_DIR = dirname(new URL(import.meta.url).pathname);
const DATA_DIR = join(SELF_DIR, '..', '..', 'data');
const ANALYSIS_DIR = join(SELF_DIR, '..', '..', 'analysis');

const unicodeVersion = '16.0.0';
const shortUV = /^(\d+\.\d+)\..*$/.exec(unicodeVersion)[1];

// https://unicode.org/reports/tr18/#General_Category_Property
const uGeneralCategoryTable = await loadUnicodeRangeData(
	`https://www.unicode.org/Public/${unicodeVersion}/ucd/extracted/DerivedGeneralCategory.txt`,
);

const uBlockTable = await loadUnicodeRangeData(
	`https://www.unicode.org/Public/${unicodeVersion}/ucd/Blocks.txt`,
);

const uAgeTable = await loadUnicodeRangeData(
	`https://www.unicode.org/Public/${unicodeVersion}/ucd/DerivedAge.txt`,
);

const uGeneralCategory = readRandomAccess(uGeneralCategoryTable);
const uBlock = readOrdered(uBlockTable);
const uAge = readOrdered(uAgeTable);

const files = [];
let canonicalTable;

const dirListing = await readdir(DATA_DIR);
for (const datFile of dirListing) {
	if (!datFile.endsWith('.dat')) {
		continue;
	}
	if (!dirListing.includes(datFile.replace(/\.dat$/, '.mjs'))) {
		continue; // file was not converted to mjs - probably skipped as a duplicate
	}
	const data = await readFile(join(DATA_DIR, datFile), { encoding: 'utf-8' });
	const lines = data.trim().split('\n');
	const packedTable = lines.pop();
	const keyValues = new Map(
		lines.map((ln) => {
			const p = ln.indexOf('=');
			return [ln.substring(0, p), ln.substring(p + 1)];
		}),
	);
	const table = unpack(packedTable);
	files.push({
		isTTY: datFile.startsWith('tty-'),
		name: keyValues.get('name') || datFile.replace(/\.dat$/, ''),
		keyValues,
		w: readRandomAccess(table),
		table,
		codepointCounts: new Map(),
		sequenceCount: 0,
	});
	if (datFile === `cam-${shortUV}.dat`) {
		canonicalTable = table;
	}
}
if (!canonicalTable) {
	throw new Error(
		'No data table for chosen version of Unicode - generate it then run again.',
	);
}

const wExpected = readOrdered(merge([notesTable, canonicalTable]));
const notes = readOrdered(notesTable, 2);
const codepointTotals = new Map();
let sequenceTotal = 0;

const next = makeNextFn(...files.map((f) => f.table), notesTable, uBlockTable);

const codepointTable = {
	class: 'codepoints',
	thead: [
		{
			cells: [
				{ content: 'range' },
				...files.map(({ name }) => ({ content: name })),
				{ content: 'unicode block' },
				{ content: 'unicode version' },
				{ content: 'notes' },
				{ content: 'characters' },
			],
		},
	],
	tbody: [],
};

for (let char = 0x000000; char < codepointCount; ) {
	const nextChar = next(char);
	const rangeEnd = Math.min(nextChar, codepointCount) - 1;
	const count = rangeEnd + 1 - char;
	const generalCats = new Set();
	const ages = new Set();
	let deprecated = true;
	for (let j = char; j <= rangeEnd; ++j) {
		generalCats.add(uGeneralCategory(j)[2]);
		ages.add(uAge(j)[2]);
		if (!/^\p{Deprecated}$/v.test(String.fromCodePoint(j))) {
			deprecated = false;
		}
	}
	ages.delete('Unassigned');
	const unassigned = generalCats.has('Cn');
	const privateUse = generalCats.has('Co');
	const expectedWidth = unassigned ? IGNORE : wExpected(char);
	inc(codepointTotals, expectedWidth, count);
	let note = notes(char);
	if (!note) {
		if (deprecated) {
			note = 'Deprecated';
		} else if (unassigned) {
			note = 'Unassigned';
		} else if (privateUse) {
			note = 'Private Use';
		} else {
			note = [...generalCats].join(', ');
		}
	}
	const fileWidths = [];
	for (const file of files) {
		const width = file.w(char);
		// explicitly allow wide characters to be 3 cells wide,
		// since some terminals do this and it is probably better for some characters
		if (width === expectedWidth || (width === 3 && expectedWidth === 2)) {
			inc(file.codepointCounts, width, count);
		}
		fileWidths.push(width);
	}
	const isCombining =
		generalCats.has('Mn') ||
		generalCats.has('Mc') ||
		generalCats.has('Me') ||
		generalCats.has('Cf');
	codepointTable.tbody.push({
		class: unassigned ? 'x' : '',
		nomerge: unassigned,
		cells: [
			{ nomerge: true, content: printCodepointRange(char, rangeEnd) },
			...fileWidths.map((width) => ({
				content: width,
				class:
					width === expectedWidth
						? 'y'
						: expectedWidth !== IGNORE
							? 'n'
							: `w${width}`,
			})),
			{ raw: makeBlockLink(char) },
			{ content: printVersionRange(ages) },
			{ nomerge: true, content: note },
			{
				nomerge: true,
				content:
					!unassigned && !privateUse
						? printRangeSample(char, rangeEnd, isCombining)
						: '',
			},
		],
	});
	char = nextChar;
}
mergeCells(codepointTable.tbody);

const sequenceTable = {
	class: 'sequences',
	thead: [
		{
			cells: [
				{ content: 'form' },
				...files.map(({ name }) => ({ content: name })),
				{ content: 'notes' },
				{ content: 'instances' },
			],
		},
	],
	tbody: [],
};

let i = codepointCount;
let n = codepointCount;
const seqs = strings.split(' ');
for (let p = 0; p < seqs.length; ++p) {
	const seq = seqs[p];
	const entries = explodeSequenceKey(seq);
	const name = p + ': ' + printSequenceKey(seq);
	while (i < n + entries.length) {
		const nextI = Math.min(next(i), n + entries.length);
		const rangeBegin = i - n;
		const count = nextI - i;
		const expectedWidth = wExpected(i);
		const unassigned = expectedWidth === UNSUPPORTED; // also includes sequences which do not change the width, but that's fine for this use
		if (!unassigned) {
			sequenceTotal += count;
		}
		const currentString = entries[i - n];
		const fileWidths = [];
		for (const file of files) {
			let width = file.w(i);
			if (width === UNSUPPORTED) {
				let fallbackW = 0;
				for (const c of currentString) {
					fallbackW += file.w(c);
				}
				width = fallbackW;
			}
			if (width === 2 && !unassigned) {
				file.sequenceCount += count;
			}
			fileWidths.push(width);
		}
		sequenceTable.tbody.push({
			class: unassigned ? 'x' : '',
			nomerge: unassigned,
			cells: [
				{ content: name },
				...fileWidths.map((width) => ({
					content: width,
					class: unassigned ? '' : width === expectedWidth ? 'y' : 'n',
				})),
				{ nomerge: true, content: notes(i) ?? '' },
				{
					nomerge: true,
					content: entries
						.slice(rangeBegin, rangeBegin + count)
						.map(codepointsToString)
						.join(' '),
				},
			],
		});
		i = nextI;
	}
	n += entries.length;
}
mergeCells(sequenceTable.tbody);

const fullPage = `<!DOCTYPE html>
<html>
<head>
<title>Terminal character width analysis</title>
<link rel="stylesheet" type="text/css" href="./index.css" />
<link rel="icon" href="./favicon.png" />
</head>
<body>
<input type="checkbox" id="unassigned" /><label for="unassigned"> Show unassigned ranges</label>
${toTable(codepointTable)}
${toTable(sequenceTable)}
</body>
</html>
`;

await writeFile(join(ANALYSIS_DIR, 'index.html'), fullPage, {
	encoding: 'utf-8',
	mode: 0o644,
});

const summary = `# Terminal summary

Different terminals have different levels of support for special characters.
This page compares how terminals perform relative to the rules from
[Unicode Technical Report 11](https://www.unicode.org/reports/tr11/), applied
to Unicode ${unicodeVersion}'s character set data (following the convention
from \`wcwidth\` of assigning character widths of 1 for Ambiguous and Neutral
characters, and 0 to format characters, non-spacing combining marks, and
enclosing marks).

Note that terminals which score low here are not necessarily "bad"; zero-width
and joining characters may be intentionally displayed to aid visibility.

| Terminal | Zero Width / Combiner Support | Narrow Character Support | Wide Character Support | Emoji Sequence Support |
| -------- | ----------------------------: | -----------------------: | ---------------------: | ---------------------: |
${files
	.filter((file) => file.isTTY)
	.map((file) => {
		const cells = [file.name];
		for (let i = 0; i <= 2; ++i) {
			cells.push(percent(file.codepointCounts.get(i) / codepointTotals.get(i)));
		}
		let sequences = percent(file.sequenceCount / sequenceTotal);
		if (file.keyValues.get('sequences') === 'font') {
			sequences += '<sup>1</sup>';
		}
		if (file.keyValues.get('sequences') === 'mode-2027') {
			sequences += '<sup>2</sup>';
		}
		cells.push(sequences);
		return `| ${cells.join(' | ')} |`;
	})
	.join('\n')}

<sup>1</sup> Emoji sequences are supported when displaying text, but the cursor
moves as if they were not supported. In practice this causes a reduction in the
available column width when using emoji sequences.

<sup>2</sup> [Mode 2027](https://github.com/contour-terminal/terminal-unicode-core)
must be enabled to support emoji sequences: \`\\x1b[?2027h\`.

[Full analysis](./index.html)
`;

await writeFile(join(ANALYSIS_DIR, 'summary.md'), summary, {
	encoding: 'utf-8',
	mode: 0o644,
});

function makeBlockLink(char) {
	const block = uBlock(char);
	if (!block[2]) {
		return '';
	}
	return toLink(
		block[2] ?? '',
		`https://www.unicode.org/charts/PDF/U${block[0].toString(16).padStart(4, '0').toUpperCase()}.pdf`,
	);
}

function makeNextFn(...tables) {
	const nextFns = tables.map(readNextChangeCharacter);
	return (char) => Math.min(...nextFns.map((fn) => fn(char)));
}

function printVersionRange(versions) {
	if (versions.size === 0) {
		return '';
	} else if (versions.size === 1) {
		return [...versions][0];
	} else {
		const sorted = [...versions].sort(
			(a, b) => Number.parseFloat(a) - Number.parseFloat(b),
		);
		return `${sorted[0]} \u2013 ${sorted.pop()}`;
	}
}

function printCodepointRange(a, b) {
	if (a === b) {
		return printCodepoint(a);
	} else {
		return printCodepoint(a) + '\u2013' + printCodepoint(b);
	}
}

function printCodepoint(c) {
	return 'U+' + c.toString(16).padStart(4, '0');
}

function printRangeSample(from, to, combining) {
	let v = [];
	const short = to - from > 200;
	for (let i = from; i <= to; ++i) {
		v.push(printSample(i, combining));
	}
	return v.join(short ? '\u200b' : ' ');
}

function printSample(codepoint, combining) {
	if (codepoint < 0x0020 || (codepoint >= 0x7f && codepoint < 0xa0)) {
		return printCodepoint(codepoint);
	} else if (codepoint === 0x061c) {
		return '[arabic letter mark]';
	} else if (codepoint === 0x200e) {
		return '[ltr]';
	} else if (codepoint === 0x200f) {
		return '[rtl]';
	} else if (codepoint === 0x2028) {
		return '[lsep]';
	} else if (codepoint === 0x2029) {
		return '[psep]';
	} else if (codepoint === 0x202a) {
		return '[lre]';
	} else if (codepoint === 0x202b) {
		return '[rle]';
	} else if (codepoint === 0x202c) {
		return '[pdf]';
	} else if (codepoint === 0x202d) {
		return '[lro]';
	} else if (codepoint === 0x202e) {
		return '[rlo]';
	} else if (codepoint === 0x2066) {
		return '[lri]';
	} else if (codepoint === 0x2067) {
		return '[rli]';
	} else if (codepoint === 0x2068) {
		return '[fsi]';
	} else if (codepoint === 0x2069) {
		return '[pdi]';
	}
	const block = uGeneralCategory(codepoint)[2];
	if (block === 'Cs' || block === 'Co') {
		return '';
	}
	const c = String.fromCodePoint(codepoint);
	return combining ? `[a${c}b]` : c;
}

function inc(table, key, value) {
	table.set(key, (table.get(key) ?? 0) + value);
}

function percent(v) {
	return (v * 100).toFixed(1) + '%';
}

function mergeCells(
	tbody,
	excludeRow = (row) => row.nomerge,
	excludeCell = (cell) => cell.nomerge,
) {
	let prev = null;
	for (const row of tbody) {
		const cells = row.cells;
		let latest = null;
		for (let i = 0; i < cells.length; ++i) {
			if (excludeCell(cells[i], i, row)) {
				latest = null;
			} else if (
				latest &&
				cells[i].content === latest.content &&
				cells[i].raw === latest.raw &&
				cells[i].class === latest.class
			) {
				latest.colspan = (latest.colspan ?? 1) + 1;
				cells[i] = null;
			} else {
				latest = cells[i];
			}
		}
		if (excludeRow(row)) {
			prev = null;
		} else if (prev) {
			for (let i = 0; i < cells.length; ++i) {
				if (cells[i] && excludeCell(cells[i], i, row)) {
					prev[i] = null;
				} else if (
					cells[i] &&
					prev[i] &&
					cells[i].content === prev[i].content &&
					cells[i].raw === prev[i].raw &&
					cells[i].class === prev[i].class &&
					cells[i].colspan === prev[i].colspan
				) {
					prev[i].rowspan = (prev[i].rowspan ?? 1) + 1;
					cells[i] = null;
				} else {
					prev[i] = cells[i];
				}
			}
		} else {
			prev = [...cells];
		}
	}
}
