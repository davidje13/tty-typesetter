#!/usr/bin/env -S node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { strings as oldStrings } from './old-strings.mjs';
import { codepointsToString, explodeSequenceKeys } from './read-strings.mjs';
import { Compressor } from './Compressor.mjs';
import { strings } from '../../data/strings.mjs';
import { codepointCount, UNSUPPORTED } from '../../src/constants.mjs';
import { readRandomAccess } from './readers.mjs';
import { unpack } from '../../src/unpack.mjs';

const newStrings = explodeSequenceKeys(strings);

const flatOldStrings = oldStrings.map(codepointsToString);
const flatNewStrings = newStrings.map(codepointsToString);

if (
	flatNewStrings.length === flatOldStrings.length &&
	flatNewStrings.every((n, i) => flatOldStrings[i] === n)
) {
	console.log('Nothing to do.');
	process.exit(0);
}

const DATA_DIR = join(
	dirname(new URL(import.meta.url).pathname),
	'..',
	'..',
	'data',
);

for (const datFile of await readdir(DATA_DIR)) {
	if (!datFile.endsWith('.dat')) {
		continue;
	}
	console.log(`Remapping ${datFile}...`);
	const data = await readFile(join(DATA_DIR, datFile), { encoding: 'utf-8' });
	const lines = data.trim().split('\n');
	const oldLookup = readRandomAccess(unpack(lines.pop()));

	let out = [];
	for (const line of lines) {
		out.push(line + '\n');
	}
	const compressor = new Compressor((char, w) =>
		out.push(`${w + 2}${char.toString(36).padStart(4, '0')}`),
	);
	for (let char = 0; char < codepointCount; ++char) {
		compressor.add(char, oldLookup(char));
	}
	for (let i = 0; i < flatNewStrings.length; ++i) {
		const string = flatNewStrings[i];
		const oldPos = flatOldStrings.indexOf(string);
		if (oldPos === -1) {
			compressor.add(codepointCount + i, UNSUPPORTED);
		} else {
			compressor.add(codepointCount + i, oldLookup(codepointCount + oldPos));
		}
	}
	compressor.close();
	out.push('\n');
	await writeFile(join(DATA_DIR, datFile), out.join(''), {
		encoding: 'utf-8',
		mode: 0o644,
	});
}
console.log('Done.');
