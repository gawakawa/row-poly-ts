import { insert, remove } from '../src/record.js';
import type { Lacks, Row } from '../src/row.js';

/**
 * 既知の限界(DESIGN.md 11章): generic 文脈で remove(insert(r,'x',v),'x') の
 * 型が元の R に戻らない。
 *
 * 原因(DESIGN 4.5節): R が未解決のまま Omit<R,K> などの型演算を適用すると、
 * 結果は簡約されず不透明なまま残る。insert して remove した結果は
 * Omit<Cons<'x', number, R>, 'x'> という形のまま留まり、checker はこれが
 * R に代入可能であることを証明できない。
 *
 * この @ts-expect-error が不要になったら、TypeScript 側がこの種の
 * 未解決 generic 上の型演算をより深く簡約できるようになった印。
 */
const _roundtrip = <R extends Row>(r: R & Lacks<R, 'x'>, v: number): R =>
	// @ts-expect-error TypeScript cannot prove remove(insert(r,'x',v),'x') is assignable back to R
	remove(insert<'x', number, R>(r, 'x', v), 'x');
