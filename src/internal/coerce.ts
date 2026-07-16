/* oxlint-disable typescript/consistent-type-assertions --
 * ライブラリ全体で唯一アサーションを許可するファイル。
 * 未解決 generic 上の Omit と交差は TS が簡約できないため(#28234 ほか)、
 * 各演算の戻り値型は checker に証明させられない。
 * 正当性は tests/ の型レベルテストと値レベルテストが具体型で担保する。 */
export const unsafeCoerce = <A, B>(a: A): B => a as unknown as B;
