// To keep track of which emoji sequences are meaningful to measure,
// we use the Unicode data, but compress it by combining common patterns
// (e.g. storing man/woman/adult + fitzpatrick modifier + joiner + blah
// as a single entry instead of one per variation)

// This means we end up measuring a lot of sequences which are not defined,
// but the cost is minimal since the measurement tables only record locations
// where the measurement changes, rather than every value.

export const RANGE_SHORTHANDS = new Map([
	['+', [0x200d]], // zero-width joiner
	['>', [0x27a1]], // right
	['!', [0xfe0f]], // emoji selector

	['%', [0x2640, 0x2642]], // gender sign
	['~', [0x1f466, 0x1f467, 0x1f9d2]], // boy/girl/child
	['&', [0x1f468, 0x1f469, 0x1f9d1]], // man/woman/adult
	['@', [0x1f474, 0x1f475, 0x1f9d3]], // older man/woman/adult
	['*', range(0x1f3fb, 0x1f3ff)], // fitzpatrick modifiers
	['$', range(0x1f1e6, 0x1f1ff)], // region indicator letters
]);

export const EXPANSIONS = new Map([
	['%', '%!'], // emoji selector after gender sign
	['>', '>!'], // emoji selector after 'right'
]);

export const OPTIONAL_EXPANSIONS = new Map([
	['~', '~*'], // fitzpatrick after child
	['&', '&*'], // fitzpatrick after adult
	['@', '@*'], // fitzpatrick after old person
]);

function range(begin, end) {
	const r = [];
	for (let c = begin; c <= end; ++c) {
		r.push(c);
	}
	return r;
}
