import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { unpack } from '../../src/unpack.mjs';

const SELF_DIR = dirname(new URL(import.meta.url).pathname);
const DATA_DIR = join(SELF_DIR, '..', '..', 'data');

export async function* readAllDataFiles() {
	for (const datFile of (await readdir(DATA_DIR)).sort()) {
		if (datFile.endsWith('.dat')) {
			yield await readDataFile(datFile);
		}
	}
}

export async function readDataFile(datFile) {
	const datFilePath = join(DATA_DIR, datFile);
	const data = await readFile(datFilePath, { encoding: 'utf-8' });
	const lines = data.trim().split('\n');
	const packedTable = lines.pop();
	const table = unpack(packedTable);
	const keyValues = new Map(
		lines.map((ln) => {
			const p = ln.indexOf('=');
			return [ln.substring(0, p), ln.substring(p + 1)];
		}),
	);
	const mjsFile = datFile.replace(/\.dat$/, '.mjs');
	const result = {
		datFile,
		datFilePath,
		mjsFile,
		mjsFilePath: join(DATA_DIR, mjsFile),
		isTTY: datFile.startsWith('tty-'),
		rawKeyValues: lines,
		name: keyValues.get('name') || datFile.replace(/\.dat$/, ''),
		platform: keyValues.get('platform'),
		sequences: keyValues.get('sequences'),
		time: keyValues.get('time'),
		packedTable,
		table,
		environment: null, // set later
	};
	keyValues.delete('name');
	keyValues.delete('platform');
	keyValues.delete('sequences');
	keyValues.delete('time');
	result.environment = Object.fromEntries(keyValues.entries());
	return result;
}
