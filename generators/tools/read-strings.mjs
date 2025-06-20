import { RANGE_SHORTHANDS, splitKey } from '../../src/sequence-key.mjs';

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
	return key;
}

export function explodeSequenceKeys(keys) {
	return keys.split(' ').flatMap(explodeSequenceKey);
}

export function explodeSequenceKey(key) {
	const result = [];
	explode(splitKey(key), 0, result, []);
	return result;
}

export function codepointsToString(codepoints) {
	return codepoints.map((c) => String.fromCodePoint(c)).join('');
}

export function printSequenceKey(key) {
	return splitKey(key)
		.map(
			({ codepoints, optional }) =>
				'U+' +
				codepoints[0].toString(16).padStart(4, '0') +
				(optional ? '?' : ''),
		)
		.join(' ');
}

function explode(parts, pos, result, current) {
	if (pos === parts.length) {
		result.push([...current]);
		return;
	}
	const l = current.length;
	const { codepoints, optional } = parts[pos];
	if (optional) {
		explode(parts, pos + 1, result, current);
	}
	for (const v of codepoints) {
		current[l] = v;
		explode(parts, pos + 1, result, current);
	}
	current.length = l;
}
