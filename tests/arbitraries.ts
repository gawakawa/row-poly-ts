import fc from 'fast-check';

/** Row の値として使う JSON 値。toEqual での構造比較に安定して使える。 */
export const valueArb: fc.Arbitrary<unknown> = fc.jsonValue();

/** Row のラベルとして使うキー。`__proto__` はオブジェクト表現を壊すため除外する。 */
export const keyArb: fc.Arbitrary<string> = fc
	.string({ minLength: 1 })
	.filter((k) => k !== '__proto__');

/** 任意の行。値は JSON 値に限定し、toEqual での構造比較を安定させる。 */
export const rowArb: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(keyArb, fc.jsonValue());

/** 空でない行と、その行に含まれるキーの組。 */
export const rowWithExistingKeyArb: fc.Arbitrary<{
	row: Record<string, unknown>;
	key: string;
}> = rowArb
	.filter((row) => Object.keys(row).length > 0)
	.chain((row) => fc.constantFrom(...Object.keys(row)).map((key) => ({ row, key })));

/** 行と、その行に含まれないキーの組。 */
export const rowWithAbsentKeyArb: fc.Arbitrary<{
	row: Record<string, unknown>;
	key: string;
}> = fc
	.tuple(rowArb, keyArb)
	.filter(([row, key]) => !(key in row))
	.map(([row, key]) => ({ row, key }));
