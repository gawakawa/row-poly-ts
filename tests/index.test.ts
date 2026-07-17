import { describe, expect, it } from 'vitest';
import {
	contract,
	get,
	inj,
	insert,
	isTag,
	match,
	merge,
	modify,
	on,
	prj,
	remove,
	rename,
	set,
} from '../src/index.js';

describe('public surface (src/index.ts)', () => {
	it('re-exports the record API and it works end-to-end', () => {
		const rec = { x: 1, y: 'a' };
		expect(get(rec, 'x')).toBe(1);
		expect(set(rec, 'x', 2)).toEqual({ x: 2, y: 'a' });
		expect(modify(rec, 'x', (n) => n + 1)).toEqual({ x: 2, y: 'a' });
		expect(insert(rec, 'z', true)).toEqual({ x: 1, y: 'a', z: true });
		expect(remove(rec, 'y')).toEqual({ x: 1 });
		expect(merge(rec, { y: 'b' })).toEqual({ x: 1, y: 'b' });
		expect(rename(rec, 'x', 'w')).toEqual({ y: 'a', w: 1 });
	});

	it('re-exports the variant API and it works end-to-end', () => {
		// A variant built straight off a single-key row hits a tsgolint
		// inference limitation (see tests/variant.test.ts's `dispatch`),
		// so on/match are called here with explicit type arguments.
		const v = inj('a', 1);
		expect(isTag(v, 'a')).toBe(true);
		expect(prj(v, 'a')).toBe(1);
		expect(
			on<Record<'a', number>, 'a', number, never>(
				v,
				'a',
				(n) => n + 1,
				(rest) => {
					throw new Error(`unreachable: ${JSON.stringify(rest)}`);
				},
			),
		).toBe(2);
		expect(match<Record<'a', number>, number>(v, { a: (n) => n * 2 })).toBe(2);
		expect(contract(v, ['a'])).toEqual(v);
	});
});
