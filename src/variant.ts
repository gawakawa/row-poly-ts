import type { Row } from './row.js';

/** バリアント。行 R から導出する tagged union */
export type Variant<R extends Row> = {
	[K in keyof R]: { readonly tag: K; readonly value: R[K] };
}[keyof R];

/** 注入。戻り値 Variant<Record<K, V>> は、より広い Variant<R> へ
 *  構造的部分型でそのまま代入できる */
export const inj = <K extends string, V>(tag: K, value: V): Variant<Record<K, V>> => ({
	tag,
	value,
});

/** タグ判定の型ガード */
export const isTag = <R extends Row, K extends keyof R & string>(
	v: Variant<R>,
	tag: K,
): v is Variant<Pick<R, K>> => v.tag === tag;

/** 射影。タグ不一致なら undefined */
export const prj = <R extends Row, K extends keyof R & string>(
	v: Variant<R>,
	tag: K,
): R[K] | undefined => (isTag(v, tag) ? v.value : undefined);

/** isTag の否定を narrowing できる形で持つ型ガード。on の残余分岐用 */
const isNotTag = <R extends Row, K extends keyof R & string>(
	v: Variant<R>,
	tag: K,
): v is Variant<Omit<R, K>> => !isTag(v, tag);

/** 1 ケース処理と残余継続。残余では行が Omit<R, K> に縮む */
export const on = <R extends Row, K extends keyof R & string, A, B>(
	v: Variant<R>,
	tag: K,
	handler: (value: R[K]) => A,
	otherwise: (rest: Variant<Omit<R, K>>) => B,
): A | B => {
	if (isTag(v, tag)) return handler(v.value);
	if (isNotTag(v, tag)) return otherwise(v);
	throw new Error(`unreachable variant tag: ${String(v.tag)}`);
};

/** 空バリアントの終端。Variant<{}> = never なので引数型は never。
 *  on の連鎖の網羅性をコンパイル時に保証する。PureScript の case_ に相当 */
export const exhaustive = (v: never): never => {
	throw new Error(`unreachable variant: ${JSON.stringify(v)}`);
};

/** ハンドラレコードによる網羅マッチ。mapped type が全ケースの提供を強制する */
export const match = <R extends Row, B>(
	v: Variant<R>,
	handlers: { [K in keyof R]: (value: R[K]) => B },
): B => handlers[v.tag](v.value);

/** タグ一覧のいずれかに一致するかの型ガード。contract 用 */
const isAnyTag = <R extends Row, K extends keyof R & string>(
	v: Variant<R>,
	tags: ReadonlyArray<K>,
): v is Variant<Pick<R, K>> => tags.some((tag) => isTag(v, tag));

/** 行の縮小。型は実行時に消去されるため、タグ一覧を値としても要求する。
 *  不一致なら undefined */
export const contract = <R extends Row, K extends keyof R & string>(
	v: Variant<R>,
	tags: ReadonlyArray<K>,
): Variant<Pick<R, K>> | undefined => (isAnyTag(v, tags) ? v : undefined);
