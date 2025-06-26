import { Typesetter } from './Typesetter.mjs';

const ts = new Typesetter();

const message1 = `This message will be measured and hard-wrapped to fit the terminal if necessary.

It can include \x1b[32mANSI escape codes such as colour changes\x1b[0m.
`;

for (const line of ts.typeset(message1)) {
	process.stdout.write(line);
}

// Hut was added in Unicode 16.0, Tulip has been around since 6.0
const message2 = 'A hut (\uD83D\uDED6), and a tulip (\uD83C\uDF37)\n';

process.stdout.write('\n');

process.stdout.write('Without tty-typesetter:\n');
process.stdout.write(message2);
process.stdout.write('\n');

process.stdout.write('With tty-typesetter:\n');
for (const line of ts.typeset(message2)) {
	process.stdout.write(line);
}
process.stdout.write('\n');
