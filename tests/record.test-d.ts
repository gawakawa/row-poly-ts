import { expectTypeOf } from 'vitest';
import { get, insert, merge, modify, remove, rename, set } from '../src/record.js';

declare const rec: { x: number; y: string };

// get/set preserve the row variable R.
expectTypeOf(get(rec, 'x')).toEqualTypeOf<number>();
expectTypeOf(set(rec, 'x', 1)).toEqualTypeOf<{ x: number; y: string }>();

// @ts-expect-error getting a key absent from the row is a compile error
get(rec, 'z');

// modify changes the value type of the targeted key only.
expectTypeOf(modify(rec, 'x', (value) => value > 0)).branded.toEqualTypeOf<{
	x: boolean;
	y: string;
}>();

// insert extends the row with a new key.
expectTypeOf(insert(rec, 'z', true)).branded.toEqualTypeOf<{ x: number; y: string; z: boolean }>();

// @ts-expect-error insert rejects a key already present in the row
insert(rec, 'x', 1);

// remove narrows the row by one key.
expectTypeOf(remove(rec, 'x')).branded.toEqualTypeOf<{ y: string }>();

// merge is right-biased at the type level too.
expectTypeOf(merge(rec, { y: true, z: 1 })).branded.toEqualTypeOf<{
	x: number;
	y: boolean;
	z: number;
}>();

// rename moves the value to the new label.
expectTypeOf(rename(rec, 'x', 'z')).branded.toEqualTypeOf<{ y: string; z: number }>();

// @ts-expect-error rename rejects a destination that collides with a remaining key
rename(rec, 'x', 'y');
