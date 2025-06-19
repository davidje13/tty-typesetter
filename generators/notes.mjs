// These ranges have been checked manually and include notes
// where this is INHERIT, we inherit from cam-17.0 as the assumed ground-truth

import { INHERIT, IGNORE } from './tools/constants.mjs';

export const notesTable = [
	[0x0000, INHERIT],

	[
		0x00ad,
		1,
		'soft hyphen: has width 1 if at end of line, else 0. In practice, terminals always render it with a width of 1.',
	],
	[0x00ae, INHERIT],

	[0x0483, 0, 'combining'],
	[0x0488, 0, 'enclosing'],
	[0x048a, INHERIT],

	[0x061c, 0, 'Arabic Letter Mark (direction mark)'],
	[0x061d, INHERIT],

	[0x06dd, 0, 'Arabic End Of Ayah (should enclose number)'],
	[0x06de, INHERIT],

	[0x070f, 0, 'Syriac Abbreviation Mark'],
	[0x0710, INHERIT],

	[0x0890, IGNORE, 'Unclear if these are combining or not (TODO)'],
	[0x0892, INHERIT],

	[0x08e2, 0, 'Arabic Disputed End Of Ayah (should combine above numbers)'],
	[0x08e3, INHERIT],

	[0x1160, 0, 'Medial vowels'],
	[0x1176, 0, 'Old medial vowels'],
	[0x11a8, 0, 'Final consonants'],
	[0x11c3, 0, 'Old final consonants'],
	[0x1200, INHERIT],

	[0x2000, 1, 'Various width spaces'],
	[0x200b, 0, 'Zero-width spaces'],
	[0x200e, 0, 'Direction markers'],
	[0x2010, INHERIT],

	[0x202a, 0, 'Direction markers'],
	[0x202f, INHERIT],

	[0x2060, 0, 'Word joiner'],
	[0x2061, 0, 'Invisible operators'],
	[0x2065, INHERIT],

	[0x2066, 0, 'Direction markers'],
	[0x2070, INHERIT],

	[0x2329, 2, 'Deprecated, equivalent to CJK punctuation'],
	[0x232b, INHERIT],

	[0x303f, 1, 'Half Fill Space'],
	[0x3041, INHERIT],
	[
		0x31ef,
		2,
		'Ideographic Description Character Subtraction - not an invisible composition control',
	],

	[0x3248, 1, 'Speed limits'],
	[0x3250, INHERIT],
];
