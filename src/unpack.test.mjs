import { INHERIT } from './constants.mjs';
import { merge, unpack } from './unpack.mjs';

describe('unpack', () => {
	it('reads compressed table data', () => {
		expect(
			unpack('3000a4001000020'),
			equals([
				[10, 1],
				[36, 2],
				[72, INHERIT],
			]),
		);
	});

	it('throws if given no data', () => {
		expect(() => unpack(''), throws());
	});

	it('throws if given invalid data', () => {
		expect(() => unpack('a0000'), throws());
		expect(() => unpack('0~000'), throws());
		expect(() => unpack('0000'), throws());
	});
});

describe('merge', () => {
	it('combines multiple tables', () => {
		const t1 = [
			[0, INHERIT],
			[10, 5],
			[30, INHERIT],
		];

		const t2 = [
			[0, 1],
			[5, 2],
			[15, 3],
			[25, 4],
			[35, 5],
		];

		expect(
			merge([t1, t2]),
			equals([
				[0, 1],
				[5, 2],
				[10, 5],
				[30, 4],
				[35, 5],
			]),
		);
	});
});
