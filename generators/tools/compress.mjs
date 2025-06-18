#!/usr/bin/env -S node

import { Compressor } from './Compressor.mjs';

let char = 0;
const compressor = new Compressor(out);
const zero = '2'.charCodeAt(0);
const newline = '\n'.charCodeAt(0);

process.stdin.on('data', (buf) => {
	for (const v of buf) {
		if (v !== newline) {
			compressor.add(char, v - zero);
			++char;
		}
	}
});

process.stdin.on('close', () => {
	compressor.close();
	process.stdout.write('\n');
});

function out(char, w) {
	process.stdout.write(`${w + 2}${char.toString(36).padStart(4, '0')}`);
}
