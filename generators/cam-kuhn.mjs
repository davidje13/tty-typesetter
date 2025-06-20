#!/usr/bin/env -S node

// translated from: https://www.cl.cam.ac.uk/~mgk25/ucs/wcwidth.c
// original header:

/*
 * This is an implementation of wcwidth() and wcswidth() (defined in
 * IEEE Std 1002.1-2001) for Unicode.
 *
 * http://www.opengroup.org/onlinepubs/007904975/functions/wcwidth.html
 * http://www.opengroup.org/onlinepubs/007904975/functions/wcswidth.html
 *
 * In fixed-width output devices, Latin characters all occupy a single
 * "cell" position of equal width, whereas ideographic CJK characters
 * occupy two such cells. Interoperability between terminal-line
 * applications and (teletype-style) character terminals using the
 * UTF-8 encoding requires agreement on which character should advance
 * the cursor by how many cell positions. No established formal
 * standards exist at present on which Unicode character shall occupy
 * how many cell positions on character terminals. These routines are
 * a first attempt of defining such behavior based on simple rules
 * applied to data provided by the Unicode Consortium.
 *
 * For some graphical characters, the Unicode standard explicitly
 * defines a character-cell width via the definition of the East Asian
 * FullWidth (F), Wide (W), Half-width (H), and Narrow (Na) classes.
 * In all these cases, there is no ambiguity about which width a
 * terminal shall use. For characters in the East Asian Ambiguous (A)
 * class, the width choice depends purely on a preference of backward
 * compatibility with either historic CJK or Western practice.
 * Choosing single-width for these characters is easy to justify as
 * the appropriate long-term solution, as the CJK practice of
 * displaying these characters as double-width comes from historic
 * implementation simplicity (8-bit encoded characters were displayed
 * single-width and 16-bit ones double-width, even for Greek,
 * Cyrillic, etc.) and not any typographic considerations.
 *
 * Much less clear is the choice of width for the Not East Asian
 * (Neutral) class. Existing practice does not dictate a width for any
 * of these characters. It would nevertheless make sense
 * typographically to allocate two character cells to characters such
 * as for instance EM SPACE or VOLUME INTEGRAL, which cannot be
 * represented adequately with a single-width glyph. The following
 * routines at present merely assign a single-cell width to all
 * neutral characters, in the interest of simplicity. This is not
 * entirely satisfactory and should be reconsidered before
 * establishing a formal standard in this area. At the moment, the
 * decision which Not East Asian (Neutral) characters should be
 * represented by double-width glyphs cannot yet be answered by
 * applying a simple rule from the Unicode database content. Setting
 * up a proper standard for the behavior of UTF-8 character terminals
 * will require a careful analysis not only of each Unicode character,
 * but also of each presentation form, something the author of these
 * routines has avoided to do so far.
 *
 * http://www.unicode.org/unicode/reports/tr11/
 *
 * Markus Kuhn -- 2007-05-26 (Unicode 5.0)
 *
 * Permission to use, copy, modify, and distribute this software
 * for any purpose and without fee is hereby granted. The author
 * disclaims all warranties with regard to this software.
 *
 * Latest version: http://www.cl.cam.ac.uk/~mgk25/ucs/wcwidth.c
 */

const combining = [
	0x0300, 0x036f, 0x0483, 0x0486, 0x0488, 0x0489, 0x0591, 0x05bd, 0x05bf,
	0x05bf, 0x05c1, 0x05c2, 0x05c4, 0x05c5, 0x05c7, 0x05c7, 0x0600, 0x0603,
	0x0610, 0x0615, 0x064b, 0x065e, 0x0670, 0x0670, 0x06d6, 0x06e4, 0x06e7,
	0x06e8, 0x06ea, 0x06ed, 0x070f, 0x070f, 0x0711, 0x0711, 0x0730, 0x074a,
	0x07a6, 0x07b0, 0x07eb, 0x07f3, 0x0901, 0x0902, 0x093c, 0x093c, 0x0941,
	0x0948, 0x094d, 0x094d, 0x0951, 0x0954, 0x0962, 0x0963, 0x0981, 0x0981,
	0x09bc, 0x09bc, 0x09c1, 0x09c4, 0x09cd, 0x09cd, 0x09e2, 0x09e3, 0x0a01,
	0x0a02, 0x0a3c, 0x0a3c, 0x0a41, 0x0a42, 0x0a47, 0x0a48, 0x0a4b, 0x0a4d,
	0x0a70, 0x0a71, 0x0a81, 0x0a82, 0x0abc, 0x0abc, 0x0ac1, 0x0ac5, 0x0ac7,
	0x0ac8, 0x0acd, 0x0acd, 0x0ae2, 0x0ae3, 0x0b01, 0x0b01, 0x0b3c, 0x0b3c,
	0x0b3f, 0x0b3f, 0x0b41, 0x0b43, 0x0b4d, 0x0b4d, 0x0b56, 0x0b56, 0x0b82,
	0x0b82, 0x0bc0, 0x0bc0, 0x0bcd, 0x0bcd, 0x0c3e, 0x0c40, 0x0c46, 0x0c48,
	0x0c4a, 0x0c4d, 0x0c55, 0x0c56, 0x0cbc, 0x0cbc, 0x0cbf, 0x0cbf, 0x0cc6,
	0x0cc6, 0x0ccc, 0x0ccd, 0x0ce2, 0x0ce3, 0x0d41, 0x0d43, 0x0d4d, 0x0d4d,
	0x0dca, 0x0dca, 0x0dd2, 0x0dd4, 0x0dd6, 0x0dd6, 0x0e31, 0x0e31, 0x0e34,
	0x0e3a, 0x0e47, 0x0e4e, 0x0eb1, 0x0eb1, 0x0eb4, 0x0eb9, 0x0ebb, 0x0ebc,
	0x0ec8, 0x0ecd, 0x0f18, 0x0f19, 0x0f35, 0x0f35, 0x0f37, 0x0f37, 0x0f39,
	0x0f39, 0x0f71, 0x0f7e, 0x0f80, 0x0f84, 0x0f86, 0x0f87, 0x0f90, 0x0f97,
	0x0f99, 0x0fbc, 0x0fc6, 0x0fc6, 0x102d, 0x1030, 0x1032, 0x1032, 0x1036,
	0x1037, 0x1039, 0x1039, 0x1058, 0x1059, 0x1160, 0x11ff, 0x135f, 0x135f,
	0x1712, 0x1714, 0x1732, 0x1734, 0x1752, 0x1753, 0x1772, 0x1773, 0x17b4,
	0x17b5, 0x17b7, 0x17bd, 0x17c6, 0x17c6, 0x17c9, 0x17d3, 0x17dd, 0x17dd,
	0x180b, 0x180d, 0x18a9, 0x18a9, 0x1920, 0x1922, 0x1927, 0x1928, 0x1932,
	0x1932, 0x1939, 0x193b, 0x1a17, 0x1a18, 0x1b00, 0x1b03, 0x1b34, 0x1b34,
	0x1b36, 0x1b3a, 0x1b3c, 0x1b3c, 0x1b42, 0x1b42, 0x1b6b, 0x1b73, 0x1dc0,
	0x1dca, 0x1dfe, 0x1dff, 0x200b, 0x200f, 0x202a, 0x202e, 0x2060, 0x2063,
	0x206a, 0x206f, 0x20d0, 0x20ef, 0x302a, 0x302f, 0x3099, 0x309a, 0xa806,
	0xa806, 0xa80b, 0xa80b, 0xa825, 0xa826, 0xfb1e, 0xfb1e, 0xfe00, 0xfe0f,
	0xfe20, 0xfe23, 0xfeff, 0xfeff, 0xfff9, 0xfffb, 0x10a01, 0x10a03, 0x10a05,
	0x10a06, 0x10a0c, 0x10a0f, 0x10a38, 0x10a3a, 0x10a3f, 0x10a3f, 0x1d167,
	0x1d169, 0x1d173, 0x1d182, 0x1d185, 0x1d18b, 0x1d1aa, 0x1d1ad, 0x1d242,
	0x1d244, 0xe0001, 0xe0001, 0xe0020, 0xe007f, 0xe0100, 0xe01ef,
];

function wcwidth(ucs) {
	if (ucs == 0) return 0;
	if (ucs < 32 || (ucs >= 0x7f && ucs < 0xa0)) return -1;

	if (bisearch(ucs, combining)) return 0;

	return (
		1 +
		(ucs >= 0x1100 &&
			(ucs <= 0x115f ||
				ucs == 0x2329 ||
				ucs == 0x232a ||
				(ucs >= 0x2e80 && ucs <= 0xa4cf && ucs != 0x303f) ||
				(ucs >= 0xac00 && ucs <= 0xd7a3) ||
				(ucs >= 0xf900 && ucs <= 0xfaff) ||
				(ucs >= 0xfe10 && ucs <= 0xfe19) ||
				(ucs >= 0xfe30 && ucs <= 0xfe6f) ||
				(ucs >= 0xff00 && ucs <= 0xff60) ||
				(ucs >= 0xffe0 && ucs <= 0xffe6) ||
				(ucs >= 0x20000 && ucs <= 0x2fffd) ||
				(ucs >= 0x30000 && ucs <= 0x3fffd)))
	);
}

function bisearch(ucs, table) {
	let min = 0;
	let max = table.length / 2 - 1;

	if (ucs < table[0] || ucs > table[max * 2 + 1]) return false;
	while (max >= min) {
		const mid = (min + max) >> 1;
		if (ucs > table[mid * 2 + 1]) min = mid + 1;
		else if (ucs < table[mid * 2]) max = mid - 1;
		else return true;
	}

	return false;
}

for (let i = 0x000000; i <= 0x10ffff; ++i) {
	const w = wcwidth(i);
	process.stdout.write(String(w + 2));
}
process.stdout.write('1'); // all multi-char sequences are not supported
process.stdout.write('\n');
