import { INHERIT } from '../generators/tools/constants.mjs';
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
