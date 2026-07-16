import type { Cons, Merge, Row } from '../row.js';

/**
 * insert の Lacks 制約を検証せずに追加だけを行う内部ヘルパー。
 * insert と rename から使う。呼び出し元が Lacks を保証する。
 * tests/record.test.ts の PBT ヘルパーも同じ実装を再利用する
 * (ジェネリックな Row では Lacks が常に never になり insert/rename を
 * 直接呼べないため)。
 */
export const insertRaw = <K extends string, V, R extends Row>(
	rec: R,
	key: K,
	value: V,
): Cons<K, V, R> => ({ ...rec, [key]: value });

/** rename の Lacks 制約を検証せずに改名だけを行う内部ヘルパー。 */
export const renameRaw = <R extends Row, K extends keyof R & string, L extends string>(
	rec: R,
	from: K,
	to: L,
): Merge<Omit<R, K>, Record<L, R[K]>> => {
	const { [from]: value, ...rest } = rec;
	return insertRaw(rest, to, value);
};
