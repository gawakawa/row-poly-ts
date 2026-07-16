import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { contract, exhaustive, inj, isTag, match, on } from '../src/variant.js';
import type { Variant } from '../src/variant.js';
import { keyArb, variantValueArb } from './arbitraries.js';

const differentKeyArb = (tag: string): fc.Arbitrary<string> =>
	keyArb.filter((other) => other !== tag);

describe('inj / prj is implemented via isTag narrowing, exercised through on', () => {
	it('on dispatches to the handler when the tag matches', () => {
		fc.assert(
			fc.property(keyArb, variantValueArb, (tag, value) => {
				const v = inj(tag, value);
				const result = on(
					v,
					tag,
					(handled) => ({ kind: 'handled' as const, value: handled }),
					(rest) => ({ kind: 'otherwise' as const, value: rest }),
				);
				expect(result).toEqual({ kind: 'handled', value });
			}),
		);
	});

	it('on dispatches to otherwise with the original variant when the tag mismatches', () => {
		fc.assert(
			fc.property(
				keyArb.chain((tag) => fc.tuple(fc.constant(tag), differentKeyArb(tag))),
				variantValueArb,
				([tag, otherTag], value) => {
					const v = inj(tag, value);
					const result = on(
						v,
						otherTag,
						(handled) => ({ kind: 'handled' as const, value: handled }),
						(rest) => ({ kind: 'otherwise' as const, value: rest }),
					);
					expect(result).toEqual({ kind: 'otherwise', value: v });
				},
			),
		);
	});
});

describe('isTag', () => {
	it('is true for the injected tag', () => {
		fc.assert(
			fc.property(keyArb, variantValueArb, (tag, value) => {
				expect(isTag(inj(tag, value), tag)).toBe(true);
			}),
		);
	});

	it('is false for a different tag', () => {
		fc.assert(
			fc.property(
				keyArb.chain((tag) => fc.tuple(fc.constant(tag), differentKeyArb(tag))),
				variantValueArb,
				([tag, otherTag], value) => {
					expect(isTag(inj(tag, value), otherTag)).toBe(false);
				},
			),
		);
	});
});

describe('match', () => {
	it('dispatches to the handler for the injected tag', () => {
		fc.assert(
			fc.property(keyArb, variantValueArb, (tag, value) => {
				const v = inj(tag, value);
				const result = match(v, { [tag]: (handled: unknown) => ({ handled }) });
				expect(result).toEqual({ handled: value });
			}),
		);
	});
});

describe('contract', () => {
	it('keeps the variant when its tag is in the tag list', () => {
		fc.assert(
			fc.property(keyArb, variantValueArb, (tag, value) => {
				const v = inj(tag, value);
				expect(contract(v, [tag])).toEqual(v);
			}),
		);
	});

	it('returns undefined when its tag is not in the tag list', () => {
		fc.assert(
			fc.property(
				keyArb.chain((tag) => fc.tuple(fc.constant(tag), differentKeyArb(tag))),
				variantValueArb,
				([tag, otherTag], value) => {
					const v = inj(tag, value);
					expect(contract(v, [otherTag])).toBeUndefined();
				},
			),
		);
	});
});

describe('on chain + exhaustive', () => {
	type Shape = { a: number; b: string; c: boolean };

	// tsgolint(typescript-go preview) does not always reduce a chained
	// Variant<Omit<Omit<...>>> residual down to `never` from inference
	// alone; explicit type arguments make each step's row concrete.
	const dispatch = (v: Variant<Shape>): string =>
		on<Shape, 'a', string, string>(
			v,
			'a',
			(n) => `a:${n}`,
			(r1) =>
				on<Omit<Shape, 'a'>, 'b', string, string>(
					r1,
					'b',
					(s) => `b:${s}`,
					(r2) =>
						on<Omit<Omit<Shape, 'a'>, 'b'>, 'c', string, never>(
							r2,
							'c',
							(b) => `c:${b}`,
							exhaustive,
						),
				),
		);

	it('reaches the a handler', () => {
		fc.assert(
			fc.property(fc.integer(), (n) => {
				expect(dispatch(inj('a', n))).toBe(`a:${n}`);
			}),
		);
	});

	it('reaches the b handler', () => {
		fc.assert(
			fc.property(fc.string(), (s) => {
				expect(dispatch(inj('b', s))).toBe(`b:${s}`);
			}),
		);
	});

	it('reaches the c handler', () => {
		fc.assert(
			fc.property(fc.boolean(), (b) => {
				expect(dispatch(inj('c', b))).toBe(`c:${b}`);
			}),
		);
	});
});
