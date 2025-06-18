#!/usr/bin/env -S node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { merge, unpack } from '../../src/unpack.mjs';
import { strings } from '../../data/strings.mjs';
import { notesTable } from '../notes.mjs';
import { readNextChangeCharacter, readOrdered } from './readers.mjs';
import { loadUnicodeRangeData } from './unicode-data.mjs';
import { explodeSequenceKey, printSequenceKey } from './read-strings.mjs';
import { toLink, toTable } from './html.mjs';
import { codepointCount, INHERIT, UNSUPPORTED } from './constants.mjs';

const SELF_DIR = dirname(new URL(import.meta.url).pathname);
const DATA_DIR = join(SELF_DIR, '..', '..', 'data');
const ANALYSIS_DIR = join(SELF_DIR, '..', '..', 'analysis');

const unicodeVersion = '17.0.0';
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

const uGeneralCategory = readOrdered(uGeneralCategoryTable);
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
	const data = (
		await readFile(join(DATA_DIR, datFile), { encoding: 'utf-8' })
	).trim();
	const table = unpack(data);
	files.push({
		name: datFile.replace(/\.dat$/, ''),
		w: readOrdered(table),
		table,
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

const next = makeNextFn(...files.map((f) => f.table), notesTable, uBlockTable);

const codepointTable = {
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
	const generalCats = new Set();
	const ages = new Set();
	let deprecated = true;
	for (let j = char; j <= rangeEnd; ++j) {
		generalCats.add(uGeneralCategory(j)[2]);
		ages.add(uAge(j)[2]);
		if (!/^\p{Deprecated}$/.test(String.fromCodePoint(j))) {
			deprecated = false;
		}
	}
	ages.delete('Unassigned');
	const unassigned = generalCats.has('Cn');
	const privateUse = generalCats.has('Co');
	const expectedWidth = unassigned ? INHERIT : wExpected(char);
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
	const showCharacters = !unassigned && !privateUse;
	const isCombining =
		generalCats.has('Mn') ||
		generalCats.has('Mc') ||
		generalCats.has('Me') ||
		generalCats.has('Cf');
	let blockLink = '';
	const block = uBlock(char);
	if (block[2]) {
		blockLink = toLink(
			block[2] ?? '',
			`https://www.unicode.org/charts/PDF/U${block[0].toString(16).padStart(4, '0').toUpperCase()}.pdf`,
		);
	}
	codepointTable.tbody.push({
		class: unassigned ? 'unassigned' : '',
		cells: [
			{ content: printCodepointRange(char, rangeEnd), class: 'nowrap' },
			...files.map(({ w }) => {
				const width = w(char);
				return {
					content: width,
					class: `w-${width} ${width === expectedWidth ? 'pass' : expectedWidth > -2 ? 'fail' : ''}`,
				};
			}),
			{ raw: blockLink, class: 'left nowrap' },
			{ content: printVersionRange(ages), class: 'left nowrap' },
			{ content: note, class: 'left notes' },
			{
				content: showCharacters
					? printRangeSample(char, rangeEnd, isCombining)
					: '',
				class: 'left',
			},
		],
	});
	char = nextChar;
}

const sequenceTable = {
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
for (const seq of strings.split(' ')) {
	const entries = explodeSequenceKey(seq);
	const name = printSequenceKey(seq);
	while (i < n + entries.length) {
		const nextI = next(i);
		const rangeBegin = i - n;
		const rangeEnd = Math.min(nextI - n, entries.length) - 1;
		const expectedWidth = wExpected(i);
		const unassigned = expectedWidth === UNSUPPORTED; // also includes sequences which do not change the width, but that's fine for this use
		sequenceTable.tbody.push({
			class: unassigned ? 'unassigned' : '',
			cells: [
				{ content: name, class: 'nowrap' },
				...files.map(({ w }) => {
					const width = w(i);
					return {
						content: width,
						class: `w-${width} ${width === 2 ? 'pass' : ''}`,
					};
				}),
				{ content: notes(i) ?? '', class: 'left notes' },
				{
					content: unassigned
						? codepointsToString(entries[rangeBegin])
						: entries
								.slice(rangeBegin, rangeEnd + 1)
								.map(codepointsToString)
								.join(' '),
					class: 'left',
				},
			],
		});
		i = nextI;
	}
	n += entries.length;
}

const html = `<!DOCTYPE html>
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

await writeFile(join(ANALYSIS_DIR, 'index.html'), html, {
	encoding: 'utf-8',
	mode: 0o644,
});

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
	return 'U+' + c.toString(16).padStart(6, '0');
}

function printRangeSample(from, to, combining) {
	let v = [];
	const short = to - from > 200;
	for (let i = from; i <= to; ++i) {
		v.push(printSample(i, combining));
	}
	return v.join(short ? '\u200b' : ' ');
}

function printSample(char, combining) {
	if (char === 0x0000) {
		return '<null>';
	} else if (char < 0x0020) {
		return `U+${char.toString(16).padStart(6, '0')}`;
	} else if (char === 0x061c) {
		return '<arabic letter mark>';
	} else if (char === 0x200e) {
		return '<ltr>';
	} else if (char === 0x200f) {
		return '<rtl>';
	} else if (char === 0x202a) {
		return '<lre>';
	} else if (char === 0x202b) {
		return '<rle>';
	} else if (char === 0x202c) {
		return '<pdf>';
	} else if (char === 0x202d) {
		return '<lro>';
	} else if (char === 0x202e) {
		return '<rlo>';
	} else if (char === 0x2066) {
		return '<lri>';
	} else if (char === 0x2067) {
		return '<rli>';
	} else if (char === 0x2068) {
		return '<fsi>';
	} else if (char === 0x2069) {
		return '<pdi>';
	}
	if (combining) {
		return `<a${String.fromCodePoint(char)}b>`;
	}
	return String.fromCodePoint(char);
}

function codepointsToString(l) {
	return l.map((c) => String.fromCodePoint(c)).join('');
}
