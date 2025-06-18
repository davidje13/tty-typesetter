import { INHERIT } from '../generators/tools/constants.mjs';

export function unpack(compressed) {
	const data = [];
	for (const [, w, p] of compressed.matchAll(/(.)(.{4})/g)) {
		data.push([Number.parseInt(p, 36), Number.parseInt(w) - 2]);
	}
	if (!data.length) {
		throw new Error('no data found');
	}
	return data;
}

export function merge(tables) {
	const n = tables.length;
	if (!n) {
		return [[0, INHERIT]];
	}
	const ps = tables.map(() => 0);
	const combined = [];
	for (let i = 0; Number.isFinite(i); ) {
		let next = Number.POSITIVE_INFINITY;
		for (let j = 0; j < n; ++j) {
			const data = tables[j];
			while (ps[j] < data.length - 1 && i >= data[ps[j] + 1][0]) {
				++ps[j];
			}
			const p = ps[j];
			if (p < data.length - 1 && data[p + 1][0] < next) {
				next = data[p + 1][0];
			}
			if (data[p][1] !== INHERIT || j === n - 1) {
				combined.push([i, data[p][1]]);
				break;
			}
		}
		i = next;
	}
	return combined;
}
