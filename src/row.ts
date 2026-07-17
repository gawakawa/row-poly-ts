/** 行。ラベル(string)から型への有限写像 */
export type Row = Record<string, unknown>;

/** 右優先マージ。spread { ...l, ...r } の実行時意味論と一致する */
export type Merge<L extends Row, R extends Row> = Omit<L, keyof R> & R;

/** ラベル K を型 V で追加(既存なら上書き)。Merge の 1 フィールド版 */
export type Cons<K extends string, V, R extends Row> = Merge<R, Record<K, V>>;

/** R がラベル K を持たないことの opt-in 検査。持つ場合 never に潰れる */
export type Lacks<R extends Row, K extends PropertyKey> = K extends keyof R ? never : unknown;
