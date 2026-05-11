#!/usr/bin/env -S node

import { writeFile } from 'node:fs/promises';
import { codepointCount, UNSUPPORTED } from '../../src/constants.mjs';
import {
	codepointsToString,
	explodeGraphemeClusterKeys,
} from '../../src/read-grapheme-clusters.mjs';
import { Compressor } from '../../src/Compressor.mjs';
import {
	getDataFilePath,
	readAllDataFiles,
} from '../../dev-utils/data-files.mjs';
import { readRandomAccess } from '../../dev-utils/readers.mjs';

const newVersion = process.argv[2];
if (!newVersion) {
	process.stderr.write(
		'Must specify Unicode version to update to (e.g. 18.0.0)\n',
	);
	process.exit(1);
}

const shortUV = /^(\d+\.\d+)\..*$/.exec(newVersion)[1];

const flatOld = await loadClusterData('../../data/grapheme-clusters.mjs');
const flatNew = await loadClusterData(
	`../../data/grapheme-clusters-${shortUV}.mjs`,
);

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
console.log('Updating grapheme clusters selection...');
await writeFile(
	getDataFilePath('grapheme-clusters.mjs'),
	`// note: to change the version of grapheme clusters, run
// ./generators/tools/remap-grapheme-clusters.mjs <new-version>
// ./generators/tools/optimise.mjs
// so that all data files are updated to match

export { compressedSequences } from ${JSON.stringify(`./grapheme-clusters-${shortUV}.mjs`)};
export const sequencesVersion = ${JSON.stringify(newVersion)};
`,
	{ encoding: 'utf-8', mode: 0o644 },
);
console.log('Done.');

async function loadClusterData(file) {
	const compressedSequences = (await import(file)).compressedSequences;
	return explodeGraphemeClusterKeys(compressedSequences).map(
		codepointsToString,
	);
}
