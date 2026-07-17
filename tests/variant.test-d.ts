import { expectTypeOf } from 'vitest';
import { contract, exhaustive, isTag, match, on } from '../src/variant.js';
import type { Variant } from '../src/variant.js';

declare const v: Variant<{ a: number; b: string; c: boolean }>;

// Variant<R> expands to a plain discriminated union.
expectTypeOf<Variant<{ a: number; b: string }>>().branded.toEqualTypeOf<
	{ readonly tag: 'a'; readonly value: number } | { readonly tag: 'b'; readonly value: string }
>();

// isTag narrows the union to the single matching branch.
if (isTag(v, 'a')) {
	expectTypeOf(v).branded.toEqualTypeOf<{ readonly tag: 'a'; readonly value: number }>();
}

// on narrows the handled branch and shrinks the residual row by one key.
on(
	v,
	'a',
	(value) => expectTypeOf(value).toEqualTypeOf<number>(),
	(rest) => expectTypeOf(rest).branded.toEqualTypeOf<Variant<{ b: string; c: boolean }>>(),
);

// exhaustive only accepts never.
// @ts-expect-error exhaustive rejects a non-never argument
exhaustive(v);

// match requires a handler for every tag.
match(v, {
	a: (value) => expectTypeOf(value).toEqualTypeOf<number>(),
	b: (value) => expectTypeOf(value).toEqualTypeOf<string>(),
	c: (value) => expectTypeOf(value).toEqualTypeOf<boolean>(),
});

// @ts-expect-error match rejects a handler record missing a tag
match(v, {
	a: (value: number) => value,
	b: (value: string) => value,
});

// contract narrows to the requested subset of tags.
expectTypeOf(contract(v, ['a', 'b'])).branded.toEqualTypeOf<
	Variant<{ a: number; b: string }> | undefined
>();
