import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { keyArb, rowWithAbsentKeyArb, rowWithExistingKeyArb } from './arbitraries.js';

describe('keyArb', () => {
	it('never produces __proto__', () => {
		fc.assert(
			fc.property(keyArb, (key) => {
				expect(key).not.toBe('__proto__');
			}),
		);
	});
});

describe('rowWithExistingKeyArb', () => {
	it('generates a key that is present in the row', () => {
		fc.assert(
			fc.property(rowWithExistingKeyArb, ({ row, key }) => {
				expect(Object.hasOwn(row, key)).toBe(true);
			}),
		);
	});
});

describe('rowWithAbsentKeyArb', () => {
	it('generates a key that is absent from the row', () => {
		fc.assert(
			fc.property(rowWithAbsentKeyArb, ({ row, key }) => {
				expect(Object.hasOwn(row, key)).toBe(false);
			}),
		);
	});
});
