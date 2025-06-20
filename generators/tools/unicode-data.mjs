import { merge } from '../../src/unpack.mjs';
import { INHERIT } from '../../src/constants.mjs';

export async function loadUnicodeRangeData(url) {
	const r = await fetch(url);
	if (r.status !== 200) {
		throw new Error(`failed to load ${url}: HTTP ${r.status}`);
	}
	const data = await r.text();
	const missing = [];
	const main = [];
	data.split('\n').forEach((ln) => {
		let target = main;
		if (ln.startsWith('# @missing: ')) {
			target = missing;
			ln = ln.substring('# @missing: '.length);
		}
		ln = ln.split('#')[0].trim();
		if (!ln.length) {
			return;
		}
		const [range, ...parts] = ln.split(';').map((v) => v.trim());
		const [r0, r1] = range.split('..');
		const mappedRange = [
			Number.parseInt(r0, 16),
			Number.parseInt(r1 ?? r0, 16),
		];
		target.push([...mappedRange, [...mappedRange, ...parts]]);
	});
	main.sort((a, b) => a[0] - b[0]);
	missing.sort((a, b) => a[0] - b[0]);
	return merge([convert(main), convert(missing), [[0, []]]]);
}

export async function loadUnicodeStringData(url) {
	const r = await fetch(url);
	if (r.status !== 200) {
		throw new Error(`failed to load ${url}: HTTP ${r.status}`);
	}
	const data = await r.text();
	const strings = [];
	data.split('\n').forEach((ln) => {
		ln = ln.split('#')[0].trim();
		if (!ln.length) {
			return;
		}
		const [str, ...parts] = ln.split(';').map((v) => v.trim());
		const codepoints = str.split(' ').map((v) => Number.parseInt(v, 16));
		strings.push([codepoints, ...parts]);
	});
	return strings;
}

function convert(rangeTable) {
	const result = [];
	let prev = 0;
	for (const [begin, end, value] of rangeTable) {
		if (begin > prev) {
			result.push([prev, INHERIT]);
		}
		result.push([begin, value]);
		prev = end + 1;
	}
	if (!result.length) {
		result.push([0, INHERIT]);
	} else {
		result.push([rangeTable[rangeTable.length - 1][1] + 1, INHERIT]);
	}
	return result;
}
