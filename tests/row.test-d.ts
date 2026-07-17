import { expectTypeOf } from 'vitest';
import type { Cons, Lacks, Merge, Row } from '../src/row.js';

expectTypeOf<{ x: number }>().toMatchTypeOf<Row>();

type MergeDisjoint = Merge<{ x: number }, { y: string }>;
expectTypeOf<MergeDisjoint>().branded.toEqualTypeOf<{ x: number; y: string }>();

type MergeOverlap = Merge<{ x: number; y: string }, { y: boolean; z: number }>;
expectTypeOf<MergeOverlap>().branded.toEqualTypeOf<{ x: number; y: boolean; z: number }>();

type ConsExisting = Cons<'x', boolean, { x: number; y: string }>;
expectTypeOf<ConsExisting>().branded.toEqualTypeOf<{ x: boolean; y: string }>();

type ConsNew = Cons<'z', boolean, { x: number; y: string }>;
expectTypeOf<ConsNew>().branded.toEqualTypeOf<{ x: number; y: string; z: boolean }>();

type LacksAbsent = Lacks<{ x: number }, 'y'>;
expectTypeOf<LacksAbsent>().toBeUnknown();

type LacksPresent = Lacks<{ x: number }, 'x'>;
expectTypeOf<LacksPresent>().toBeNever();
