import { Typesetter } from './Typesetter.mjs';

describe('Typesetter', () => {
	describe('measureCodepoint', () => {
		it('returns the cell width of codepoints', () => {
			const ts = new Typesetter({});
			expect(ts.measureCodepoint(0x0061), equals(1));
			expect(ts.measureCodepoint(0x0000), equals(0));
			expect(ts.measureCodepoint(0x0009), equals(null));
			expect(ts.measureCodepoint(0x1f6d6), equals(2));
		});
	});

	describe('measureCharacter', () => {
		it('returns the cell width of characters', () => {
			const ts = new Typesetter({});
			expect(ts.measureCharacter('a'), equals(1));
			expect(ts.measureCharacter('\u0000'), equals(0));
			expect(ts.measureCharacter('\t'), equals(null));
			expect(ts.measureCharacter('\uD83D\uDED6'), equals(2));
		});

		it('accepts raw codepoints', () => {
			const ts = new Typesetter({});
			expect(ts.measureCharacter(0x0061), equals(1));
			expect(ts.measureCharacter(0x0000), equals(0));
			expect(ts.measureCharacter(0x0009), equals(null));
			expect(ts.measureCharacter(0x1f6d6), equals(2));
		});
	});

	describe('measureString', () => {
		it('returns the cell width of full strings', () => {
			const ts = new Typesetter({});
			expect(ts.measureString('a'), equals(1));
			expect(ts.measureString('abc'), equals(3));
			expect(ts.measureString('\u0000'), equals(0));
			expect(ts.measureString('\t'), equals(0));
			expect(ts.measureString('\uD83D\uDED6'), equals(2));
		});

		it('ignores ANSI escapes', () => {
			const ts = new Typesetter({});
			expect(ts.measureString('foo \x1b[0m bar'), equals(8));
			expect(ts.measureString('foo \x1b]0m bar\x1b\\ bar'), equals(8));
		});

		it('includes ANSI escapes if configured', () => {
			const ts = new Typesetter({});
			expect(
				ts.measureString('foo \x1b[0m bar', { skipAnsi: false }),
				equals(11),
			);
		});

		it('squashes grapheme clusters', () => {
			const ts = new Typesetter({});
			expect(ts.measureString('\uD83E\uDDD3\uD83C\uDFFD'), equals(2));
		});

		it('squashes grapheme clusters in complex situations', () => {
			const ts = new Typesetter({});
			expect(ts.measureString('\uD83E\uDDD3'), equals(2));
			expect(ts.measureString('\uD83C\uDFFD'), equals(2));
			expect(
				ts.measureString('\uD83E\uDDD3\uD83E\uDDD3\uD83C\uDFFD'),
				equals(4),
			);
			expect(ts.measureString('\uD83C\uDFFD\uD83E\uDDD3'), equals(4));

			// man+woman+girl+boy (=> 2 parent 2 child family)
			expect(
				ts.measureString(
					'family: \uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66',
				),
				equals(10),
			);

			// man+woman+girlboy (=> 2 parent 1 child family, then boy)
			expect(
				ts.measureString(
					'\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\uD83D\uDC66',
				),
				equals(4),
			);
		});

		it('does not squash grapheme clusters if the terminal only supports them via its font', () => {
			const ts = new Typesetter(APPLE_TERMINAL);
			expect(ts.measureString('\uD83E\uDDD3\uD83C\uDFFD'), equals(4));
		});

		it('does not squash grapheme clusters if the terminal does not support it', () => {
			const ts = new Typesetter(VSCODE100);
			expect(ts.measureString('\uD83E\uDDD3\uD83C\uDFFD'), equals(4));
		});
	});

	describe('measureStringProgressive', () => {
		it('returns a function which measures a string one character at a time', () => {
			const fn = new Typesetter({}).measureStringProgressive();
			expect(fn('a'), equals(1));
			expect(fn('a'), equals(2));
			expect(fn(0x0061), equals(3));
			expect(fn('\uD83D\uDED6'), equals(5));
		});

		it('does not advance width inside ANSI escapes', () => {
			const fn = new Typesetter({}).measureStringProgressive();
			expect(fn('a'), equals(1));
			expect(fn('\x1b'), equals(1));
			expect(fn('['), equals(1));
			expect(fn('0'), equals(1));
			expect(fn('m'), equals(1));
			expect(fn('m'), equals(2));
		});

		it('squashes grapheme clusters', () => {
			const fn = new Typesetter({}).measureStringProgressive();
			expect(fn(0x1f468), equals(2)); // man
			expect(fn(0x200d), equals(2)); // +
			expect(fn(0x1f469), equals(4)); // woman
			expect(fn(0x200d), equals(4)); // +
			expect(fn(0x1f467), equals(2)); // girl (recognised pattern)
			expect(fn(0x200d), equals(2)); // +
			expect(fn(0x1f466), equals(2)); // boy (second recognised pattern overrides first)
		});

		it('handles grapheme clusters which overlap', () => {
			const fn = new Typesetter({}).measureStringProgressive();
			expect(fn(0x1f468), equals(2)); // man
			expect(fn(0x200d), equals(2)); // +
			expect(fn(0x1f468), equals(4)); // man
			expect(fn(0x200d), equals(4)); // +
			expect(fn(0x1f469), equals(6)); // woman
			expect(fn(0x200d), equals(6)); // +
			expect(fn(0x1f467), equals(4)); // girl (recognised pattern)
			// 3-adult family is not a valid sequence, so this finds man+ & man+woman+girl
		});

		it('handles sequential grapheme clusters', () => {
			const fn = new Typesetter({}).measureStringProgressive();
			expect(fn(0x1f468), equals(2)); // man
			expect(fn(0x200d), equals(2)); // +
			expect(fn(0x1f467), equals(2)); // girl (recognised pattern)
			expect(fn(0x1f469), equals(4)); // woman
			expect(fn(0x200d), equals(4)); // +
			expect(fn(0x1f467), equals(4)); // girl (recognised pattern)
		});
	});

	describe('typeset', () => {
		it(
			'wraps lines',
			({ environment = {}, options = {}, input, sizes }) => {
				const ts = new Typesetter(environment);
				for (const [columnLimit, expected] of sizes) {
					const actual = ts.typeset(input, { columnLimit, ...options });
					expect([...actual].join(''), equals(expected));
				}
			},
			{
				parameters: [
					{
						name: 'adds hard line breaks at word boundaries',
						input: 'this is my very long message which needs to wrap.',
						sizes: [
							[11, 'this is my \nvery long \nmessage \nwhich needs\nto wrap.'],
						],
					},
					{
						name: 'ignores additional spaces after wrapping',
						input: 'stuff  which                  is     overly  spaced-out',
						sizes: [[14, 'stuff  which  \nis     overly \nspaced-out']],
					},
					{
						name: 'preserves existing line breaks',
						input: 'this is a message\nwhich already has a newline',
						sizes: [[16, 'this is a \nmessage\nwhich already \nhas a newline']],
					},
					{
						name: 'preserves existing carriage returns',
						input: 'this is a message\rwhich has a carriage return',
						sizes: [[16, 'this is a \nmessage\rwhich has a \ncarriage return']],
					},
					{
						name: 'wraps at soft hyphens and displays them',
						input: 'Super\xadcali\xadfragilistic\xadexpiali\xaddocious',
						sizes: [[12, 'Supercali-\nfragilistic-\nexpiali-\ndocious']],
					},
					{
						name: 'wraps inside words when the console is too narrow',
						input: 'Super\xadcali\xadfragilistic\xadexpiali\xaddocious',
						sizes: [[8, 'Super-\ncalifrag\nilistic-\nexpiali-\ndocious']],
					},
					{
						name: 'preserves soft hyphens and does not use them for wrapping if softHyphens is false',
						input: 'Super\xadcali\xadfragilistic\xadexpiali\xaddocious',
						options: { softHyphens: false },
						sizes: [
							[12, 'Super\xadcali\xadf\nragilistic\xade\nxpiali\xaddocio\nus'],
						],
					},
					{
						name: 'wraps at tabs',
						input: 'a\t\t\t\t  \tb',
						sizes: [[10, 'a         \nb']],
					},
					{
						name: 'includes wrapped tabs if niceWrap is false',
						input: 'a\t\t\t\t  \tb',
						options: { niceWrap: false },
						sizes: [
							[10, 'a       \n        \n        \n          \n        b'],
						],
					},
					{
						name: 'wraps after wide characters',
						columnLimit: 9,
						input: '这是一条测试消息',
						sizes: [
							[9, '这是一条\n测试消息'],
							[4, '这是\n一条\n测试\n消息'],
						],
					},
					{
						name: 'avoids wrapping inside zwj grapheme clusters (with support)',
						environment: KITTY,
						input: 'cluster 👨‍👩‍👧‍👦',
						sizes: [
							[11, 'cluster 👨‍👩‍👧‍👦'],
							[10, 'cluster 👨‍👩‍👧‍👦'],
							[9, 'cluster \n👨‍👩‍👧‍👦'],
						],
					},
					{
						name: 'avoids wrapping inside zwj grapheme clusters (without support)',
						environment: VSCODE100,
						input: 'cluster 👨‍👩‍👧‍👦',
						sizes: [
							[16, 'cluster 👨‍👩‍👧‍👦'],
							[11, 'cluster \n👨‍👩‍👧‍👦'],
							[10, 'cluster \n👨‍👩‍👧‍👦'],
							[9, 'cluster \n👨‍👩‍👧‍👦'],
						],
					},
					{
						name: 'allows wrapping between zwj grapheme clusters',
						environment: KITTY,
						input: 'clusters 👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦',
						sizes: [
							[13, 'clusters 👨‍👩‍👧‍👦👨‍👩‍👧‍👦\n👨‍👩‍👧‍👦'],
							[12, 'clusters 👨‍👩‍👧‍👦\n👨‍👩‍👧‍👦👨‍👩‍👧‍👦'],
							[11, 'clusters 👨‍👩‍👧‍👦\n👨‍👩‍👧‍👦👨‍👩‍👧‍👦'],
						],
					},
					{
						name: 'allows wrapping inside zwj grapheme clusters if atomicGraphemeClusters is false',
						environment: VSCODE100,
						input: 'cluster 👨‍👩‍👧‍👦',
						options: { atomicGraphemeClusters: false },
						sizes: [[11, 'cluster 👨\n‍👩‍👧‍👦']],
					},
					{
						name: 'avoids wrapping inside zwj grapheme clusters if atomicGraphemeClusters is if-supported and the terminal supports grapheme clusters',
						environment: KITTY,
						input: 'cluster 👨‍👩‍👧‍👦',
						options: { atomicGraphemeClusters: 'if-supported' },
						sizes: [[11, 'cluster 👨‍👩‍👧‍👦']],
					},
					{
						name: 'allows wrapping inside zwj grapheme clusters if atomicGraphemeClusters is if-supported and the terminal does not support grapheme clusters',
						environment: VSCODE100,
						input: 'cluster 👨‍👩‍👧‍👦',
						options: { atomicGraphemeClusters: 'if-supported' },
						sizes: [[11, 'cluster 👨\n‍👩‍👧‍👦']],
					},
					{
						name: 'avoids wrapping inside modifier grapheme clusters (with support)',
						environment: KITTY,
						input: 'skin tone 🧓🏽',
						sizes: [
							[13, 'skin tone 🧓🏽'],
							[12, 'skin tone 🧓🏽'],
							[11, 'skin tone \n🧓🏽'],
						],
					},
					{
						name: 'avoids wrapping inside modifier grapheme clusters (without support)',
						environment: VSCODE100,
						input: 'skin tone 🧓🏽',
						sizes: [
							[14, 'skin tone 🧓🏽'],
							[13, 'skin tone \n🧓🏽'],
							[12, 'skin tone \n🧓🏽'],
							[11, 'skin tone \n🧓🏽'],
						],
					},
					{
						name: 'avoids wrapping inside flag grapheme clusters (with support)',
						environment: KITTY,
						input: 'flag 🇬🇧',
						sizes: [
							[7, 'flag 🇬🇧'],
							[6, 'flag \n🇬🇧'],
							[5, 'flag \n🇬🇧'],
						],
					},
					{
						name: 'avoids wrapping inside flag grapheme clusters (without support)',
						environment: VSCODE100,
						input: 'flag 🇬🇧',
						sizes: [
							[7, 'flag 🇬🇧'],
							[6, 'flag \n🇬🇧'],
							[5, 'flag \n🇬🇧'],
						],
					},
					{
						name: 'breaks up grapheme clusters in terminals which would render them strangely',
						environment: APPLE_TERMINAL,
						input: '👨‍👩‍👧‍👦 🧓🏽 🇬🇧',
						sizes: [[30, '👨👩👧👦 \uD83E\uDDD3\u200C\uD83C\uDFFD 🇬\u200C🇧']],
					},
					{
						name: 'does not breaks up grapheme clusters if splitUnsupportedGraphemeClusters is false',
						environment: APPLE_TERMINAL,
						input: '👨‍👩‍👧‍👦 🧓🏽 🇬🇧',
						options: { splitUnsupportedGraphemeClusters: false },
						sizes: [[30, '👨‍👩‍👧‍👦 🧓🏽 🇬🇧']],
					},
					{
						name: 'ignores ANSI escape sequences for line wrapping',
						input: 'this is \x1b[32mgreen\x1b[0m text',
						sizes: [[14, 'this is \x1b[32mgreen\x1b[0m \ntext']],
						sizes: [[13, 'this is \x1b[32mgreen\x1b[0m\ntext']],
						sizes: [[12, 'this is \n\x1b[32mgreen\x1b[0m text']],
					},
					{
						name: 'includes ANSI escape sequences if skipAnsi is false',
						input: 'this is \x1b[32mgreen\x1b[0m text',
						options: { skipAnsi: false },
						sizes: [[20, 'this is \x1b[32mgreen\x1b[0m\ntext']],
						sizes: [[14, 'this is \n\x1b[32mgreen\x1b[0m \ntext']],
					},
					{
						name: 'outputs one character per line if the column limit is too small',
						input: 'foo bar',
						sizes: [
							[1, 'f\no\no\nb\na\nr'],
							[0, 'f\no\no\nb\na\nr'],
						],
					},
					{
						name: 'uses basic line wrapping if niceWrap is false',
						input: 'this is my very long message which needs to wrap.',
						options: { niceWrap: false },
						sizes: [
							[10, 'this is my\n very long\n message w\nhich needs\n to wrap.'],
						],
					},
					{
						name: 'reduces the available width if beginColumn is set',
						input: 'this is my very long message which needs to wrap.',
						options: { beginColumn: 3 },
						sizes: [
							[
								10,
								'this is\nmy very\nlong \nmessage\nwhich \nneeds \nto \nwrap.',
							],
						],
					},
					{
						name: 'uses wrapColumn for subsequent lines',
						input: 'this is my very long message which needs to wrap.',
						options: { beginColumn: 8, wrapColumn: 0 },
						sizes: [
							[20, 'this is my \nvery long message \nwhich needs to wrap.'],
						],
					},
					{
						name: 'adds an initial newline if there is no space in the first line',
						input: 'this is my very long message which needs to wrap.',
						options: { beginColumn: 20, wrapColumn: 0 },
						sizes: [
							[20, '\nthis is my very long\nmessage which needs \nto wrap.'],
						],
					},
					{
						name: 'wraps the first word if there is insufficient space on the first line',
						input: 'this is my very long message which needs to wrap.',
						options: { beginColumn: 18, wrapColumn: 0 },
						sizes: [
							[20, '\nthis is my very long\nmessage which needs \nto wrap.'],
						],
					},
					{
						name: 'splits the first word if there is insufficient space for it even when wrapping',
						input: 'verylongword not so long words',
						options: { beginColumn: 4, wrapColumn: 0 },
						sizes: [[6, 've\nrylong\nword \nnot so\nlong \nwords']],
						sizes: [[5, 'v\nerylo\nngwor\nd not\nso \nlong \nwords']],
						sizes: [[4, '\nvery\nlong\nword\nnot \nso \nlong\nword\ns']],
					},
				],
			},
		);

		describe('tabs', () => {
			it('replaces tabs with spaces', () => {
				const ts = new Typesetter({});
				const actual = ts.typeset('a\tbcdefghi\tc\t\td\na\tb', {
					columnLimit: 100,
				});
				expect(
					[...actual],
					equals(['a       bcdefghi        c               d\n', 'a       b']),
				);
			});

			it('uses tabSize to determine tabstop positions', () => {
				const ts = new Typesetter({});
				const actual = ts.typeset('a\tb\tccc\td', {
					columnLimit: 100,
					tabSize: 3,
				});
				expect([...actual], equals(['a  b  ccc   d']));
			});

			it('uses beginColumn to determine tabstop positions', () => {
				const ts = new Typesetter({});
				const actual = ts.typeset('a\tb\tc\na\tb', {
					columnLimit: 100,
					beginColumn: 3,
				});
				expect([...actual], equals(['a    b       c\n', 'a    b']));
			});

			it('uses wrapColumn for subsequent lines', () => {
				const ts = new Typesetter({});
				const actual = ts.typeset('a\tb\tc\td\te\nf\tg', {
					columnLimit: 15,
					wrapColumn: 3,
				});
				expect(
					[...actual],
					equals(['a       b      \n', 'c    d      \n', 'e\n', 'f    g']),
				);
			});

			it('accounts for wide characters when calculating tab position', () => {
				const ts = new Typesetter({});
				const actual = ts.typeset('\uD83D\uDED6\tb', { columnLimit: 100 });
				expect([...actual], equals(['\uD83D\uDED6      b']));
			});
		});

		describe('padding unsupported characters', () => {
			it('adds spaces after unsupported characters', () => {
				const ts = new Typesetter(VSCODE100);
				const actual = ts.typeset('A hut (\uD83D\uDED6)', { columnLimit: 100 });
				expect([...actual], equals(['A hut (\uD83D\uDED6 )']));
			});

			it('does not add spaces after unsupported characters if configured', () => {
				const ts = new Typesetter(VSCODE100);
				const actual = ts.typeset('A hut (\uD83D\uDED6)', {
					columnLimit: 100,
					padUnsupportedCharacters: false,
				});
				expect([...actual], equals(['A hut (\uD83D\uDED6)']));
			});

			it('does not add spaces after supported characters', () => {
				const ts = new Typesetter(APPLE_TERMINAL);
				const actual = ts.typeset('A hut (\uD83D\uDED6)', { columnLimit: 100 });
				expect([...actual], equals(['A hut (\uD83D\uDED6)']));
			});
		});
	});
});

const KITTY = { TERM: 'xterm-kitty' };
const VSCODE100 = {
	TERM_PROGRAM: 'vscode',
	TERM_PROGRAM_VERSION: '1.100.3',
};
const APPLE_TERMINAL = {
	TERM_PROGRAM: 'Apple_Terminal',
	TERM_PROGRAM_VERSION: '455.1',
};
