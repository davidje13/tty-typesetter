import { Typesetter } from './Typesetter.mjs';

// can pass in an optional custom environment object (defaults to process.env)
const typesetter = new Typesetter();

const message = 'A hut (\uD83D\uDED6)\n'; // 16.0
//const message = 'A tulip (\uD83C\uDF37)\n'; // 6.0

process.stdout.write('\n');

process.stdout.write('Without tty-typesetter:\n');
process.stdout.write(message);
process.stdout.write('\n');

process.stdout.write('With tty-typesetter:\n');
for (const line of typesetter.typeset(message)) {
	process.stdout.write(line);
}
process.stdout.write('\n');

for (const line of typesetter.typeset(
	'A message which is quite long and may need to wrap depending on the terminal size.',
)) {
	process.stdout.write(line);
}
process.stdout.write('\n');
