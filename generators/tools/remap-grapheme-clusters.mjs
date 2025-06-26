#!/usr/bin/env -S node

import { writeFile } from 'node:fs/promises';
import { codepointCount, UNSUPPORTED } from '../../src/constants.mjs';
import {
	codepointsToString,
	explodeGraphemeClusterKeys,
} from '../../src/read-grapheme-clusters.mjs';
import { Compressor } from '../../src/Compressor.mjs';
import { readAllDataFiles } from '../../dev-utils/data-files.mjs';
import { readRandomAccess } from '../../dev-utils/readers.mjs';
import { compressedSequences } from '../../data/grapheme-clusters.mjs';
import { compressedSequences as oldCompressedSequences } from './old-grapheme-clusters.mjs';

const flatOld = oldCompressedSequences.map(codepointsToString);
const flatNew =
	explodeGraphemeClusterKeys(compressedSequences).map(codepointsToString);

if (
	flatNew.length === flatOld.length &&
	flatNew.every((n, i) => flatOld[i] === n)
) {
	console.log('Nothing to do.');
	process.exit(0);
}

for await (const data of readAllDataFiles()) {
	console.log(`Remapping ${data.datFile}...`);
	const oldLookup = readRandomAccess(data.table);

	let out = [];
	for (const line of data.rawKeyValues) {
		out.push(line + '\n');
	}
	const compressor = new Compressor((char, w) =>
		out.push(`${w + 2}${char.toString(36).padStart(4, '0')}`),
	);
	for (let char = 0; char < codepointCount; ++char) {
		compressor.add(char, oldLookup(char));
	}
	for (let i = 0; i < flatNew.length; ++i) {
		const sequence = flatNew[i];
		const oldPos = flatOld.indexOf(sequence);
		if (oldPos === -1) {
			compressor.add(codepointCount + i, UNSUPPORTED);
		} else {
			compressor.add(codepointCount + i, oldLookup(codepointCount + oldPos));
		}
	}
	compressor.close();
	out.push('\n');
	await writeFile(data.datFilePath, out.join(''), {
		encoding: 'utf-8',
		mode: 0o644,
	});
}
console.log('Done.');
