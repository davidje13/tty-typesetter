#!/usr/bin/env -S node

import { writeFile } from 'node:fs/promises';
import { Compressor } from '../../src/Compressor.mjs';
import { readAllDataFiles } from '../../dev-utils/data-files.mjs';
import {
	readNextChangeCharacter,
	readOrdered,
} from '../../dev-utils/readers.mjs';

const files = [];
const duplicates = [];
const observedData = new Map();

console.log('Loading files...');
for await (const data of readAllDataFiles()) {
	const duplicate = observedData.get(data.packedTable);
	if (duplicate) {
		console.log(`  ${data.datFile}: duplicate of ${duplicate.datFile}`);
		duplicates.push({ ...data, duplicate });
	} else {
		console.log(`  ${data.datFile}: ${data.table.length} nodes`);
		files.push({ ...data, source: null, diff: null });
		observedData.set(data.packedTable, {
			datFile: data.datFile,
			mjsFile: data.mjsFile,
		});
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
for (const { mjsFile, mjsFilePath, source, table, diff } of done) {
	let content;
	if (source) {
		console.log(
			`  ${mjsFile}: ${diff.length} nodes, inherit from ${source.mjsFile}`,
		);
		content = `import { data as base } from ${JSON.stringify('./' + source.mjsFile)};\n\nexport const data = [${JSON.stringify(pack(diff))}, ...base];\n`;
	} else {
		console.log(`  ${mjsFile}: ${table.length} nodes`);
		content = `export const data = [${JSON.stringify(pack(table))}];\n`;
	}
	await writeFile(mjsFilePath, content, { encoding: 'utf-8', mode: 0o644 });
}
for (const { mjsFile, mjsFilePath, duplicate } of duplicates) {
	console.log(`  ${mjsFile}: duplicate of ${duplicate.mjsFile}`);
	await writeFile(
		mjsFilePath,
		`export { data } from ${JSON.stringify('./' + duplicate.mjsFile)};\n`,
		{ encoding: 'utf-8', mode: 0o644 },
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
	compressor.close();
	return all;
}

function pack(table) {
	return table
		.map(([char, w]) => `${w + 2}${char.toString(36).padStart(4, '0')}`)
		.join('');
}
