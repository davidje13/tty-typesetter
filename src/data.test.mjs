import { readAllDataFiles } from '../generators/tools/data-files.mjs';
import { UNSUPPORTED } from './constants.mjs';
import { loadTable } from './data.mjs';

describe('loadTable', async () => {
	const knownTerminals = [];
	for await (const data of readAllDataFiles()) {
		if (!data.isTTY) {
			continue;
		}
		knownTerminals.push({
			name: data.name,
			environment: data.environment,
			sequences: data.sequences,
			expectedTable: JSON.stringify(
				data.table.map(([k, v]) => [k, v === UNSUPPORTED ? null : v]),
			),
		});
	}

	it(
		'recognises various terminals',
		(terminal) => {
			const fetched = loadTable(terminal.environment);
			const fetchedTable = JSON.stringify(fetched._mergedTable);
			if (fetchedTable !== terminal.expectedTable) {
				for (const other of knownTerminals) {
					if (fetchedTable === other.expectedTable) {
						fail(`Got table for ${other.name}`);
					}
				}
			}
			expect(fetchedTable, equals(terminal.expectedTable));
			expect(fetched._fontSequences, equals(terminal.sequences === 'font'));
		},
		{ parameters: knownTerminals },
	);

	it('returns a vanilla Unicode-compliant table if the environment is not recognised', () => {
		const fetched = loadTable({ TERM: 'unknown' });
		expect(fetched._read(0x00), equals(0));
		expect(fetched._read(0x09), equals(null));
		expect(fetched._read(0x30), equals(1));
		expect(fetched._read(0x1f6d6), equals(2));
		expect(fetched._fontSequences, equals(false));
	});
});
