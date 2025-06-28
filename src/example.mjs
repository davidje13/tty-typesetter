import { Typesetter } from './Typesetter.mjs';

const ts = new Typesetter();

const message = `This is my quite long message which will probably need to wrap, depending on the terminal size. It has some \x1b[32mANSI escape codes to change the text colour\x1b[0m.

Grapheme clusters may or may not be supported by the terminal, but should work with tabs consistently:

Value\tExplanation
a\tSingle-cell character
(\uD83D\uDED6)\t2-cell emoji character from Unicode 16 (hut), in brackets
(\uD83C\uDF37)\t2-cell emoji character from Unicode 6 (tulip), in brackets
\uD83E\uDDD3\uD83C\uDFFD\tGrapheme cluster of 2 codepoints
\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\tGrapheme cluster of 5 codepoints
`;

process.stdout.write('\n');

process.stdout.write('\x1b[1mWithout tty-typesetter:\x1b[0m\n\n');
process.stdout.write(message);
process.stdout.write('\n');

process.stdout.write('\x1b[1mWith tty-typesetter:\x1b[0m\n\n');
for (const line of ts.typeset(message)) {
	process.stdout.write(line);
}
process.stdout.write('\n');
