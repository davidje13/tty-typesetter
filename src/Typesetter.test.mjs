import { Typesetter } from './Typesetter.mjs';

describe('Typesetter', () => {
	describe('measureCodepoint', () => {
		it('returns the cell width of codepoints', () => {
			const ts = new Typesetter({});
			expect(ts.measureCodepoint(0x0061), equals(1));
			expect(ts.measureCodepoint(0x0000), equals(0));
			expect(ts.measureCodepoint(0x0009), equals(-1));
			expect(ts.measureCodepoint(0x1f6d6), equals(2));
		});
	});

	describe('measureCharacter', () => {
		it('returns the cell width of characters', () => {
			const ts = new Typesetter({});
			expect(ts.measureCharacter('a'), equals(1));
			expect(ts.measureCharacter('\u0000'), equals(0));
			expect(ts.measureCharacter('\t'), equals(-1));
			expect(ts.measureCharacter('\uD83D\uDED6'), equals(2));
		});

		it('accepts raw codepoints', () => {
			const ts = new Typesetter({});
			expect(ts.measureCharacter(0x0061), equals(1));
			expect(ts.measureCharacter(0x0000), equals(0));
			expect(ts.measureCharacter(0x0009), equals(-1));
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
		});

		it('includes ANSI escapes if configured', () => {
			const ts = new Typesetter({});
			expect(
				ts.measureString('foo \x1b[0m bar', { skipAnsi: false }),
				equals(11),
			);
		});

		it.ignore('squashes combined characters', () => {
			// TODO
			const ts = new Typesetter({});
			expect(ts.measureString('\uD83E\uDDD3\uD83C\uDFFD'), equals(2));
		});

		it('does not squash combined characters if the terminal only supports them via its font', () => {
			const ts = new Typesetter({
				TERM_PROGRAM: 'Apple_Terminal',
				TERM_PROGRAM_VERSION: '455.1',
			});
			expect(ts.measureString('\uD83E\uDDD3\uD83C\uDFFD'), equals(4));
		});

		it('does not squash combined characters if the terminal does not support it', () => {
			const ts = new Typesetter({
				TERM_PROGRAM: 'vscode',
				TERM_PROGRAM_VERSION: '1.100.3',
			});
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
			expect(fn('0'), equals(1));
			expect(fn('m'), equals(1));
			expect(fn('m'), equals(2));
		});
	});

	describe('typeset', () => {
		it('adds hard line breaks at word boundaries to fit the column width', () => {
			const ts = new Typesetter({});
			const actual = ts.typeset(
				'this is my very long message which needs to wrap.',
				{ columnLimit: 11 },
			);
			const expected = [
				'this is my \n',
				'very long \n',
				'message \n',
				'which needs\n',
				'to wrap.',
			];
			expect([...actual], equals(expected));
		});

		it('allows wrapping after soft hyphens and removes them if line wrapping does not occur', () => {
			const ts = new Typesetter({});
			const input = 'Super\xadcali\xadfragilistic\xadexpiali\xaddocious';
			expect(
				[...ts.typeset(input, { columnLimit: 12 })],
				equals(['Supercali-\n', 'fragilistic-\n', 'expiali-\n', 'docious']),
			);

			expect(
				[...ts.typeset(input, { columnLimit: 8 })],
				equals([
					'Super-\n',
					'cali-\n',
					'fragilis\n',
					'tic-\n',
					'expiali-\n',
					'docious',
				]),
			);
		});

		it('returns one character per line if the column limit is too small', () => {
			const ts = new Typesetter({});
			const actual = ts.typeset('foo bar', { columnLimit: 0 });
			expect([...actual], equals(['f\n', 'o\n', 'o\n', 'b\n', 'a\n', 'r']));
		});

		it('uses basic line wrapping if niceWrap is false', () => {
			const ts = new Typesetter({});
			const actual = ts.typeset(
				'this is my very long message which needs to wrap.',
				{ columnLimit: 10, niceWrap: false },
			);
			const expected = [
				'this is my\n',
				' very long\n',
				' message w\n',
				'hich needs\n',
				' to wrap.',
			];
			expect([...actual], equals(expected));
		});

		it('replaces tabs with spaces', () => {
			const ts = new Typesetter({});
			const actual = ts.typeset('a\tbcdefghi\tc\t\td', { columnLimit: 100 });
			expect(
				[...actual],
				equals(['a       bcdefghi        c               d']),
			);
		});

		it('accounts for wide characters when calculating tab position', () => {
			const ts = new Typesetter({});
			const actual = ts.typeset('\uD83D\uDED6\tb', { columnLimit: 100 });
			expect([...actual], equals(['\uD83D\uDED6      b']));
		});

		it('wraps at tabs', () => {
			const ts = new Typesetter({});
			const actual = ts.typeset('a\t\t\t\t  \tb', { columnLimit: 10 });
			expect([...actual], equals(['a       \n', 'b']));
		});

		it('includes wrapped tabs if niceWrap is false', () => {
			const ts = new Typesetter({});
			const actual = ts.typeset('a\t\t\t\t  \tb', {
				columnLimit: 10,
				niceWrap: false,
			});
			expect([...actual], equals(['a       \n', '        \n', '        b']));
		});

		it('adds spaces after unsupported characters', () => {
			const ts = new Typesetter({
				TERM_PROGRAM: 'vscode',
				TERM_PROGRAM_VERSION: '1.100.3',
			});
			const actual = ts.typeset('A hut (\uD83D\uDED6)', { columnLimit: 100 });
			expect([...actual], equals(['A hut (\uD83D\uDED6 )']));
		});

		it('does not add spaces after unsupported characters if configured', () => {
			const ts = new Typesetter({
				TERM_PROGRAM: 'vscode',
				TERM_PROGRAM_VERSION: '1.100.3',
			});
			const actual = ts.typeset('A hut (\uD83D\uDED6)', {
				columnLimit: 100,
				padUnsupportedCharacters: false,
			});
			expect([...actual], equals(['A hut (\uD83D\uDED6)']));
		});

		it('does not add spaces after supported characters', () => {
			const ts = new Typesetter({
				TERM_PROGRAM: 'Apple_Terminal',
				TERM_PROGRAM_VERSION: '455.1',
			});
			const actual = ts.typeset('A hut (\uD83D\uDED6)', { columnLimit: 100 });
			expect([...actual], equals(['A hut (\uD83D\uDED6)']));
		});
	});
});
