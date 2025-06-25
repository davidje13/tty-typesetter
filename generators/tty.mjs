#!/usr/bin/env -S node

import { strings } from '../data/strings.mjs';
import { Compressor } from './tools/Compressor.mjs';
import {
	codepointsToString,
	explodeSequenceKeys,
} from './tools/read-strings.mjs';
import { codepointCount, UNSUPPORTED } from '../src/constants.mjs';

const flags = process.argv.slice(2);

if (!process.stderr.isTTY || !process.stdin.isTTY) {
	throw new Error('Must be connected to TTY to measure');
}

const CURSOR_POS = /\x1B\[(\d+);(\d+)R/g;
const readStdin = stdinReader();

const batchFlagPos = flags.indexOf('--batch');
const batchSize =
	batchFlagPos === -1
		? 0x100
		: Math.max(Number.parseInt(flags[batchFlagPos + 1]), 1);

process.stderr.write('\n');

let sequenceSupport;
const c1 = '\uD83D\uDC68';
const c2 = '\uD83C\uDFFD';
const w1 = await measureStr(c1);
const w2 = await measureStr(c2);
const w12 = await measureStr(c1 + c2);
if (w12 === w1) {
	sequenceSupport = 'full';
} else {
	process.stderr.write('\x1B[?2027h');
	const w12_2027 = await measureStr(c1 + c2);
	if (w12_2027 === w1) {
		sequenceSupport = 'mode-2027';
	} else {
		process.stderr.write('\r\x1B[2K');
		process.stderr.write(' '.repeat(5) + 'V\n');
		process.stderr.write(
			c1 + c2 + ' '.repeat(5 - w1 - w2) + 'A' + ' '.repeat(w2 - 1) + 'B\n',
		);
		process.stderr.write(' '.repeat(5) + '^\n\n');
		const answer = await readStdin(
			'Font calibration: which letter (A or B) is being pointed at above? ',
			/[abq]/i,
		);
		process.stderr.write('\n\n');
		if (answer[0].toLowerCase() === 'q') {
			process.exit(1);
		}
		sequenceSupport = answer[0].toLowerCase() === 'b' ? 'font' : 'none';
	}
}

process.stderr.write('Measuring...\n');

function beforeBatch() {
	process.stderr.write('\r\x1B[2K');
}

const showProgress = (label) => (frac) =>
	process.stderr.write(`\n${label}: ${(frac * 100).toFixed(1)}%\x1B[A`);

const tmBeforeCodepoints = performance.now();
const r = [];
for await (const w of batched(
	0,
	codepointCount,
	batchSize,
	measure,
	beforeBatch,
	showProgress('codepoints (1/2)'),
)) {
	r.push(w);
}
const tmAfterCodepoints = performance.now();

// Check emoji sequences
// note: in practice, Apple's terminal believes it does not support these
// (and wraps as if they were not supported), but the renderer actually does support some
if (sequenceSupport === 'full') {
	const seqs = explodeSequenceKeys(strings);
	for await (const { w, i } of batched(
		0,
		seqs.length,
		batchSize,
		(i) => measureStr(codepointsToString(seqs[i])).then((w) => ({ w, i })),
		beforeBatch,
		showProgress('sequences (2/2)'),
	)) {
		let unsupportedW = 0;
		for (const v of seqs[i]) {
			unsupportedW += r[v];
		}
		r.push(w === unsupportedW ? UNSUPPORTED : w);
	}
} else {
	r.push(UNSUPPORTED);
}

process.stderr.write('\n\x1B[2KDone.\n\n');
process.stdin.setRawMode(false);
if (sequenceSupport === 'mode-2027') {
	process.stderr.write('\x1B[?2027l');
}

for (const key of [
	'TERM',
	'TERM_PROGRAM',
	'TERM_PROGRAM_VERSION',
	'TERMINAL_EMULATOR',
	'PTYXIS_VERSION',
	'VTE_VERSION',
	'LANG',
]) {
	const value = process.env[key];
	if (value !== undefined) {
		process.stdout.write(`${key}=${value}\n`);
	}
}
process.stdout.write(`platform=${process.platform}\n`);
process.stdout.write(`sequences=${sequenceSupport}\n`);
process.stdout.write(
	`time=${((tmAfterCodepoints - tmBeforeCodepoints) * 0.001).toFixed(3)}s (batch=${batchSize})\n`,
);

const compressor = new Compressor(out);
r.forEach((w, char) => compressor.add(char, w));
compressor.close();
process.stdout.write('\n');
process.exit(0);

function stdinReader() {
	const decoder = new TextDecoder();
	const waiting = [];

	let v = '';
	let terminating = false;
	process.stdin.on('data', (buf) => {
		v += decoder.decode(buf);
		if (v.includes('\x03')) {
			// approximate manual handling of Ctrl+C since we are in raw input mode
			v = '';
			if (!terminating) {
				terminating = true;
				process.stderr.write('\n\nKilled\n\n');
				setTimeout(() => process.exit(1), 50);
			}
		}
		while (true) {
			const next = waiting[0];
			if (!next) {
				return;
			}
			next.pattern.lastIndex = 0;
			const match = next.pattern.exec(v);
			if (!match) {
				return;
			}
			waiting.shift();
			const end = next.pattern.lastIndex;
			next.resolve(match);
			if (end === v.length) {
				v = '';
			} else {
				v = v.substring(end);
			}
		}
	});
	process.stdin.setRawMode(true);

	return (output, pattern) =>
		new Promise((resolve) => {
			waiting.push({ pattern, resolve });
			if (output && !terminating) {
				process.stderr.write(output);
			}
		});
}

async function* batched(from, to, batchSize, fn, beforeBatchFn, progressFn) {
	const block = [];
	progressFn(0);
	for (let i = from; i < to; ++i) {
		block.push(fn(i));
		if (block.length >= batchSize) {
			beforeBatchFn();
			yield* await Promise.all(block);
			progressFn((i - from) / (to - 1 - from));
			block.length = 0;
		}
	}
	if (block.length > 0) {
		beforeBatchFn();
		yield* await Promise.all(block);
		progressFn(1);
	}
}

async function measureStr(s) {
	process.stderr.write('\ra' + s + 'b');
	const match = await readStdin('\x1B[6n', CURSOR_POS);
	return Number.parseInt(match[2], 10) - 3;
}
function measure(i) {
	if (i < 0x0020 || (i >= 0x7f && i < 0xa0)) {
		return i === 0 ? 0 : UNSUPPORTED;
	}
	return measureStr(String.fromCodePoint(i));
}

function out(char, w) {
	process.stdout.write(`${w + 2}${char.toString(36).padStart(4, '0')}`);
}
