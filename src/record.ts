import type { Cons, Lacks, Merge, Row } from './row.js';

/**
 * insert の Lacks 制約を検証せずに追加だけを行う内部ヘルパー。
 * insert と rename の両方から使う。呼び出し元が Lacks を保証する。
 */
const insertRaw = <K extends string, V, R extends Row>(
	rec: R,
	key: K,
	value: V,
): Cons<K, V, R> => ({
	...rec,
	[key]: value,
});

/** フィールド選択。SML# の #key に相当 */
export const get = <R extends Row, K extends keyof R & string>(rec: R, key: K): R[K] => rec[key];

/** 型を変えない更新。Elm の { rec | key = value } に相当 */
export const set = <R extends Row, K extends keyof R & string>(rec: R, key: K, value: R[K]): R => ({
	...rec,
	[key]: value,
});

/** 型の変更を許す更新。PureScript の modify に相当 */
export const modify = <R extends Row, K extends keyof R & string, B>(
	rec: R,
	key: K,
	f: (value: R[K]) => B,
): Merge<R, Record<K, B>> => ({ ...rec, [key]: f(rec[key]) });

/** Lacks 制約付きの追加。K が既に R にあるとコンパイルエラー */
export const insert = <K extends string, V, R extends Row>(
	rec: R & Lacks<R, K>,
	key: K,
	value: V,
): Cons<K, V, R> => insertRaw(rec, key, value);

/** フィールド削除。delete は予約語のため remove とする */
export const remove = <R extends Row, K extends keyof R & string>(rec: R, key: K): Omit<R, K> => {
	const { [key]: _removed, ...rest } = rec;
	return rest;
};

/** 右優先マージ */
export const merge = <L extends Row, R extends Row>(left: L, right: R): Merge<L, R> => ({
	...left,
	...right,
});

/** 改名。改名先が残余に既存だとコンパイルエラー */
export const rename = <R extends Row, K extends keyof R & string, L extends string>(
	rec: R & Lacks<Omit<R, K>, L>,
	from: K,
	to: L,
): Merge<Omit<R, K>, Record<L, R[K]>> => {
	const { [from]: value, ...rest } = rec;
	return insertRaw(rest, to, value);
};
