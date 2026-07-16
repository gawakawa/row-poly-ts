import fc from 'fast-check';

/** Row の値として使う JSON 値。toEqual での構造比較に安定して使える。 */
export const valueArb: fc.Arbitrary<unknown> = fc.jsonValue();

/**
 * Variant<R> の値として使う値。fc.jsonValue() の JsonObject が持つ
 * optional index signature ({[key in string]?: JsonValue}) は、
 * isTag/on/match/contract の R 推論(mapped type から R を逆算する処理)を
 * 壊してしまうため、Variant 系のテストでは再帰のないプレーンな union を使う。
 */
export const variantValueArb: fc.Arbitrary<number | string | boolean> = fc.oneof(
	fc.integer(),
	fc.string(),
	fc.boolean(),
);

/** Row のラベルとして使うキー。`__proto__` はオブジェクト表現を壊すため除外する。 */
export const keyArb: fc.Arbitrary<string> = fc
	.string({ minLength: 1 })
	.filter((k) => k !== '__proto__');

/** 任意の行。値は JSON 値に限定し、toEqual での構造比較を安定させる。 */
export const rowArb: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(keyArb, valueArb);

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

/** 互いに異なる2つのキーの組。 */
export const distinctKeyPairArb: fc.Arbitrary<[string, string]> = keyArb.chain((key) =>
	fc.tuple(
		fc.constant(key),
		keyArb.filter((other) => other !== key),
	),
);
