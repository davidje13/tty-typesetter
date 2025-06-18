import {
	EXPANSIONS,
	OPTIONAL_EXPANSIONS,
	RANGE_SHORTHANDS,
} from '../../src/sequence-key.mjs';

const NORM = new Map();
for (const [k, vs] of RANGE_SHORTHANDS) {
	for (const v of vs) {
		NORM.set(v, k);
	}
}

export function makeSequenceKey(seq) {
	let key = seq
		.map((v) => NORM.get(v) ?? v.toString(36).padStart(4, '0'))
		.join('');
	for (const [short, long] of EXPANSIONS) {
		key = key.replaceAll(long, short);
	}
	for (const [short, long] of OPTIONAL_EXPANSIONS) {
		key = key.replaceAll(long, short);
	}
	return key;
}

export function explodeSequenceKeys(keys) {
	return keys.split(' ').flatMap(explodeSequenceKey);
}

export function explodeSequenceKey(key) {
	for (const [short, long] of EXPANSIONS) {
		key = key.replaceAll(short, long);
	}
	const result = [];
	explode(splitKey(key), 0, result, [], 0);
	return result;
}

export function printSequenceKey(key) {
	for (const [short, long] of EXPANSIONS) {
		key = key.replaceAll(short, long);
	}
	for (const [short, long] of OPTIONAL_EXPANSIONS) {
		key = key.replaceAll(short, long);
	}
	return splitKey(key)
		.map((part) => RANGE_SHORTHANDS.get(part) ?? [Number.parseInt(part, 36)])
		.map((codepoints) => 'U+' + codepoints[0].toString(16).padStart(4, '0'))
		.join(' ');
}

function explode(parts, pos, result, current, noExpand) {
	if (pos === parts.length) {
		result.push([...current]);
		return;
	}
	const l = current.length;
	const part = parts[pos];
	const exp = OPTIONAL_EXPANSIONS.get(part);
	if (noExpand <= 0 && exp !== undefined) {
		const expandedParts = splitKey(exp);
		explode(
			[...expandedParts, ...parts.slice(pos + 1)],
			0,
			result,
			current,
			expandedParts.length,
		);
	}
	const values = RANGE_SHORTHANDS.get(part) ?? [Number.parseInt(part, 36)];
	for (const v of values) {
		current[l] = v;
		explode(parts, pos + 1, result, current, noExpand - 1);
	}
	current.length = l;
}

function splitKey(key) {
	return [...key.matchAll(/[0-9a-zA-Z]{4}|[^0-9a-zA-Z]/g)].map(([k]) => k);
}
