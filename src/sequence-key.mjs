// To keep track of which emoji sequences are meaningful to measure,
// we use the Unicode data, but compress it by combining common patterns
// (e.g. storing man/woman + fitzpatrick modifier + joiner + blah
// as a single entry instead of one per variation)

export const RANGE_SHORTHANDS = new Map([
	['+', [0x200d]], // zero-width joiner
	['!', [0xfe0f]], // emoji selector

	['%', [0x2640, 0x2642]], // gender sign
	['~', [0x1f466, 0x1f467]], // boy/girl
	['&', [0x1f468, 0x1f469]], // man/woman
	['*', range(0x1f3fb, 0x1f3ff)], // fitzpatrick modifiers
	['$', range(0x1f1e6, 0x1f1ff)], // region indicator letters
]);

export const KEY_PART =
	/([0-9a-zA-Z]{4}(?:\/[0-9a-zA-Z]{4})*|[^0-9a-zA-Z?])(\??)/g;

export function splitKey(key) {
	return [...key.matchAll(KEY_PART)].map(([, k, opt]) => ({
		codepoints:
			RANGE_SHORTHANDS.get(k) ??
			k.split('/').map((c) => Number.parseInt(c, 36)),
		optional: Boolean(opt),
	}));
}

function range(begin, end) {
	const r = [];
	for (let c = begin; c <= end; ++c) {
		r.push(c);
	}
	return r;
}
