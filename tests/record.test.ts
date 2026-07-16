import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { get, merge, modify, remove, set } from '../src/record.js';
import type { Cons, Merge, Row } from '../src/row.js';
import {
	keyArb,
	rowArb,
	rowWithAbsentKeyArb,
	rowWithExistingKeyArb,
	valueArb,
} from './arbitraries.js';

/**
 * insert/rename の Lacks 制約は、値引数位置の交差として課されているため
 * (DESIGN 5.2 節)、行がジェネリックな Record<string, unknown> のままでは
 * keyof R が string に潰れて Lacks が常に never になり、そもそも呼び出せない。
 * PBT は runtime の absence (rowWithAbsentKeyArb) を保証済みなので、
 * ここでは Lacks を持たない直接実装でランタイム挙動を検査する。
 * 型レベルの Lacks 保証自体は record.test-d.ts が別途検査する。
 */
const insertUnchecked = <R extends Row, K extends string, V>(
	row: R,
	key: K,
	value: V,
): Cons<K, V, R> => ({ ...row, [key]: value });

const renameUnchecked = <R extends Row, K extends keyof R & string, L extends string>(
	row: R,
	from: K,
	to: L,
): Merge<Omit<R, K>, Record<L, R[K]>> => {
	const { [from]: value, ...rest } = row;
	return insertUnchecked(rest, to, value);
};

const expectUnchangedOtherKeys = (
	before: Record<string, unknown>,
	after: Record<string, unknown>,
	changedKeys: ReadonlyArray<string>,
): void => {
	for (const key of Object.keys(before)) {
		if (!changedKeys.includes(key)) {
			expect(after[key]).toBe(before[key]);
		}
	}
};

describe('get / set', () => {
	it('get-set: get(set(r,k,v),k) === v', () => {
		fc.assert(
			fc.property(rowWithExistingKeyArb, valueArb, ({ row, key }, value) => {
				expect(get(set(row, key, value), key)).toEqual(value);
			}),
		);
	});

	it('set-get: set(r,k,get(r,k)) leaves other keys untouched and does not mutate r', () => {
		fc.assert(
			fc.property(rowWithExistingKeyArb, ({ row, key }) => {
				const before = structuredClone(row);
				const result = set(row, key, get(row, key));
				expect(result).toEqual(row);
				expect(row).toEqual(before);
			}),
		);
	});

	it('set-set: set(set(r,k,v1),k,v2) === set(r,k,v2)', () => {
		fc.assert(
			fc.property(rowWithExistingKeyArb, valueArb, valueArb, ({ row, key }, v1, v2) => {
				expect(set(set(row, key, v1), key, v2)).toEqual(set(row, key, v2));
			}),
		);
	});

	it('set does not mutate the original row', () => {
		fc.assert(
			fc.property(rowWithExistingKeyArb, valueArb, ({ row, key }, value) => {
				const before = structuredClone(row);
				set(row, key, value);
				expect(row).toEqual(before);
			}),
		);
	});
});

describe('modify', () => {
	const double = (value: unknown): unknown[] => [value, value];

	it('applies f to the targeted key and leaves other keys untouched', () => {
		fc.assert(
			fc.property(rowWithExistingKeyArb, ({ row, key }) => {
				const before = structuredClone(row);
				const result = modify(row, key, double);
				expect(result[key]).toEqual(double(get(row, key)));
				expectUnchangedOtherKeys(row, result, [key]);
				expect(row).toEqual(before);
			}),
		);
	});
});

describe('insert', () => {
	it('adds the key with the given value and leaves other keys untouched', () => {
		fc.assert(
			fc.property(rowWithAbsentKeyArb, valueArb, ({ row, key }, value) => {
				const before = structuredClone(row);
				const result = insertUnchecked(row, key, value);
				expect(get(result, key)).toEqual(value);
				expectUnchangedOtherKeys(row, result, [key]);
				expect(row).toEqual(before);
			}),
		);
	});
});

describe('remove', () => {
	it('drops the key and leaves other keys untouched', () => {
		fc.assert(
			fc.property(rowWithExistingKeyArb, ({ row, key }) => {
				const before = structuredClone(row);
				const result = remove(row, key);
				expect(Object.hasOwn(result, key)).toBe(false);
				expectUnchangedOtherKeys(row, result, [key]);
				expect(row).toEqual(before);
			}),
		);
	});

	it('remove(insert(r,k,v),k) is equivalent to r', () => {
		fc.assert(
			fc.property(rowWithAbsentKeyArb, valueArb, ({ row, key }, value) => {
				expect(remove(insertUnchecked(row, key, value), key)).toEqual(row);
			}),
		);
	});
});

describe('merge', () => {
	it('is right-biased: every key in the right row wins', () => {
		fc.assert(
			fc.property(rowArb, rowArb, (left, right) => {
				const result = merge(left, right);
				for (const key of Object.keys(right)) {
					expect(get(result, key)).toEqual(get(right, key));
				}
			}),
		);
	});

	it('has {} as a left and right identity', () => {
		fc.assert(
			fc.property(rowArb, (row) => {
				expect(merge(row, {})).toEqual(row);
				expect(merge({}, row)).toEqual(row);
			}),
		);
	});

	it('is associative', () => {
		fc.assert(
			fc.property(rowArb, rowArb, rowArb, (a, b, c) => {
				expect(merge(merge(a, b), c)).toEqual(merge(a, merge(b, c)));
			}),
		);
	});

	it('does not mutate either operand', () => {
		fc.assert(
			fc.property(rowArb, rowArb, (left, right) => {
				const beforeLeft = structuredClone(left);
				const beforeRight = structuredClone(right);
				merge(left, right);
				expect(left).toEqual(beforeLeft);
				expect(right).toEqual(beforeRight);
			}),
		);
	});
});

describe('rename', () => {
	const renameCandidateArb = fc
		.tuple(rowWithExistingKeyArb, keyArb)
		.filter(([{ row, key }, to]) => to === key || !(to in row));

	it('the renamed key holds the original value', () => {
		fc.assert(
			fc.property(renameCandidateArb, ([{ row, key: from }, to]) => {
				const originalValue = get(row, from);
				const result = renameUnchecked(row, from, to);
				expect(get(result, to)).toEqual(originalValue);
			}),
		);
	});

	it('the old key is gone unless it equals the new key', () => {
		fc.assert(
			fc.property(renameCandidateArb, ([{ row, key: from }, to]) => {
				const result = renameUnchecked(row, from, to);
				if (from !== to) {
					expect(Object.hasOwn(result, from)).toBe(false);
				}
			}),
		);
	});

	it('leaves keys other than from/to untouched and does not mutate the row', () => {
		fc.assert(
			fc.property(renameCandidateArb, ([{ row, key: from }, to]) => {
				const before = structuredClone(row);
				const result = renameUnchecked(row, from, to);
				expectUnchangedOtherKeys(row, result, [from, to]);
				expect(row).toEqual(before);
			}),
		);
	});
});
