import { INHERIT } from './constants.mjs';

export function unpack(compressed) {
	const data = [];
	if (compressed.length % 5 !== 0) {
		throw new Error('invalid data');
	}
	let previous = -1;
	for (const [, w, p] of compressed.matchAll(/(.)(.{4})/g)) {
		const begin = Number.parseInt(p, 36);
		const width = Number.parseInt(w, 10) - 2;
		if (!(begin > previous) || Number.isNaN(width)) {
			throw new Error('invalid data');
		}
		data.push([begin, width]);
		previous = begin;
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
	let cur = undefined;
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
				const v = data[p][1];
				if (v !== cur) {
					combined.push([i, v]);
					cur = v;
				}
				break;
			}
		}
		i = next;
	}
	return combined;
}
