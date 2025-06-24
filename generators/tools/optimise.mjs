#!/usr/bin/env -S node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Compressor } from './Compressor.mjs';
import { readNextChangeCharacter, readOrdered } from './readers.mjs';
import { unpack } from '../../src/unpack.mjs';

const DATA_DIR = join(
	dirname(new URL(import.meta.url).pathname),
	'..',
	'..',
	'data',
);

const files = [];
const duplicates = [];
const observedData = new Map();

console.log('Loading files...');
for (const datFile of (await readdir(DATA_DIR)).sort()) {
	if (!datFile.endsWith('.dat')) {
		continue;
	}
	const data = await readFile(join(DATA_DIR, datFile), { encoding: 'utf-8' });
	const packedTable = data.trim().split('\n').pop();
	const outFile = datFile.replace(/\.dat$/, '.mjs');
	const duplicate = observedData.get(packedTable);
	if (duplicate) {
		console.log(`  ${datFile}: duplicate of ${duplicate.datFile}`);
		duplicates.push({ datFile, outFile, duplicate });
	} else {
		const table = unpack(packedTable);
		console.log(`  ${datFile}: ${table.length} nodes`);
		files.push({
			datFile,
			outFile,
			table,
			source: null,
			diff: null,
		});
		observedData.set(packedTable, { datFile, outFile });
	}
}
observedData.clear();

console.log('Calculating diffs...');

// for stability, make the Unicode versions a base chain which inherit from each other,
// then allow other data files to branch off from whichever is closest (which also gives
// a good hint about which version of Unicode the implementation is using)
const done = files.filter(({ datFile }) => /cam-[\d.]+\.dat$/.test(datFile));
for (let i = 1; i < done.length; ++i) {
	done[i].source = done[i - 1];
	done[i].diff = recompress(done[i].table, done[i - 1].table);
}
const remaining = new Set(files);
for (const source of done) {
	remaining.delete(source);
}

for (const file of remaining) {
	for (const source of done) {
		const diff = recompress(file.table, source.table);
		if (diff.length < (file.diff ?? file.table).length) {
			file.source = source;
			file.diff = diff;
		}
	}
}
while (remaining.size > 0) {
	let best = null;
	let bestL = Number.POSITIVE_INFINITY;
	for (const file of remaining) {
		const l = (file.diff ?? file.table).length;
		if (l < bestL) {
			best = file;
			bestL = l;
		}
	}
	done.push(best);
	remaining.delete(best);
	for (const file of remaining) {
		const diff = recompress(file.table, best.table);
		if (diff.length < (file.diff ?? file.table).length) {
			file.source = best;
			file.diff = diff;
		}
	}
}

console.log('Writing files...');
for (const { outFile, source, table, diff } of done) {
	let content;
	if (source) {
		console.log(
			`  ${outFile}: ${diff.length} nodes, inherit from ${source.outFile}`,
		);
		content = `import { data as base } from ${JSON.stringify('./' + source.outFile)};\n\nexport const data = [${JSON.stringify(pack(diff))}, ...base];\n`;
	} else {
		console.log(`  ${outFile}: ${table.length} nodes`);
		content = `export const data = [${JSON.stringify(pack(table))}];\n`;
	}
	await writeFile(join(DATA_DIR, outFile), content, {
		encoding: 'utf-8',
		mode: 0o644,
	});
}
for (const { outFile, duplicate } of duplicates) {
	console.log(`  ${outFile}: duplicate of ${duplicate.outFile}`);
	await writeFile(
		join(DATA_DIR, outFile),
		`export { data } from ${JSON.stringify('./' + duplicate.outFile)};\n`,
		{
			encoding: 'utf-8',
			mode: 0o644,
		},
	);
}

console.log('Done.');

function recompress(data, base) {
	const all = [];
	const compressor = new Compressor((char, w) => all.push([char, w]));

	const w = readOrdered(data);
	const wBase = readOrdered(base);
	const next = readNextChangeCharacter(data);
	const nextBase = readNextChangeCharacter(base);
	for (
		let char = 0x000000;
		Number.isFinite(char);
		char = Math.min(next(char), nextBase(char))
	) {
		compressor.add(char, w(char), wBase(char));
	}
	return all;
}

function pack(table) {
	return table
		.map(([char, w]) => `${w + 2}${char.toString(36).padStart(4, '0')}`)
		.join('');
}
