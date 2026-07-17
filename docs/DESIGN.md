# Design

row-poly-ts の設計文書。
PureScript や SML#、OCaml が備える row polymorphism を、TypeScript の既存の型システム上のエンコードとして提供する。

## 1. 目的とスコープ

row-poly-ts は、コンパイラの改造や独自構文の追加を行わず、素の tsc が検査できる型定義と依存ゼロのランタイム関数だけで row polymorphism を提供するライブラリである。

**row polymorphism**(行多相)とは、レコードやバリアントの型を、ラベルから型への有限写像である**行**(row)と、まだ確定していない残りの部分を表す**行変数**(row variable)に分けて扱う多相性である。
たとえば「少なくとも `x: number` を持つ任意のレコードを受け取り、同じ形のレコードを返す」関数は、行変数 `r` を使って `{ x: number | r } -> { x: number | r }` と書ける。
部分型付けで同じ関数を書くと余分なフィールドの型情報が戻り値で失われるのに対し、行多相は行変数 `r` を通じてそれを保存する。
この「残りを保存する」性質が行多相の価値であり、本ライブラリが TypeScript で再現する対象である。

ゴールは次の三つである。

- **拡張可能レコード**：フィールドの選択、更新、追加、削除、マージ、改名(`get` / `set` / `modify` / `insert` / `remove` / `merge` / `rename`)
- **多相バリアント**：行を共有する tagged union(`Variant<R>` / `inj` / `prj` / `isTag` / `on` / `exhaustive` / `match` / `contract`)
- **型レベル行演算**：`Row` / `Merge` / `Cons` / `Lacks`

非ゴールは次のとおりである。
いずれも 10 章と 11 章で理由を述べる。

- 擬似 HKT と generic ADT(`Option<A>` のような型パラメータ付きバリアントの一般化)
- scoped labels(重複ラベルを許す行)
- OCaml の双方向境界(`[< ]` / `[> ]`)相当の API
- 第一級の exact 型(閉じた行)
- 深い再帰 conditional type による行の分解

## 2. 背景

### 2.1 理論の系譜

行多相の理論は、行に与える意味論の違いで分かれる。
分岐点は「重複ラベルを許すか」と「フィールド追加に何の条件を課すか」の二つである。

| 体系                  | 重複ラベル | 拡張の条件          | 重複時の意味       | 採用例                 |
| --------------------- | ---------- | ------------------- | ------------------ | ---------------------- |
| Wand (1987)           | 不可       | 無条件              | 上書き             | (歴史的)               |
| Rémy (1989)           | 不可       | presence フラグ多相 | フラグ次第         | OCaml                  |
| Gaster & Jones (1996) | 不可       | lacks 制約          | 制約で排除         | PureScript, Haskell 系 |
| Leijen (2005)         | 可(scoped) | 無条件              | 遮蔽(古い値は残存) | Koka                   |

**lacks 制約**は「行 `r` はラベル `l` を含まない」という述語であり、Gaster & Jones はこれを追加の前提条件にすることでラベルの一意性を守った。
**scoped labels** は逆に重複を許し、同名フィールドを変数のスコープのように重ねる。

### 2.2 各言語の実装

**PureScript** は Gaster & Jones 系である。
コンパイラ組み込みの型クラス `Union` / `Cons` / `Lacks` / `Nub` が行の演算を表し、関数従属(fundeps)により「和と左辺から右辺を逆算する」ような多方向の推論ができる。
`purescript-record` の `insert` と `delete` は `Lacks` を前提条件に取り、`merge` は `Union` の後に `Nub` で重複を潰す。
`purescript-variant` はレコードと同じ行からバリアントを作り、`inj`(注入)、`on`(1 ケース処理と残余継続)、`match`(ハンドラレコードによる網羅マッチ)、`expand`(小さい行から大きい行への埋め込み)を提供する。

**SML#**(Ohori のレコード多相)は行変数を使わず、型変数のカインドに制約を付ける。
フィールド選択 `#X` の型は `['a#{X: 'b}, 'b. 'a -> 'b]` であり、`'a#{X: 'b}` は「フィールド `X` を持つ任意のレコード型」を動く。
演算は選択と型を変えない更新のみで、追加と削除はない。

**OCaml** は Rémy 系である。
オブジェクト型の `..` と多相バリアントの `[> ]` / `[< ]` が行変数にあたる。
同じタグに異なるペイロード型を要求する関数を合成すると conjunctive type が生まれ、マニュアル自身が「注釈なしでは検出しづらい誤りを生む」と警告している。

**Elm** の extensible record `{ r | x : Float }` は「少なくとも `x` を持つレコード」であり、更新構文は型を変えない。
かつて存在したフィールドの追加と削除の構文は 0.16 で削除された(elm/compiler#985)。
理由は「実際に使われていない」ことと、行の形がコンパイル時に確定しなくなり固定オフセットの最適化を阻害することの二つである。
行変数を関数の総称性のための制約としてだけ使い、レコード代数を提供しないという割り切りは、SML# と実質同じ着地である。

この二言語の実績から、本ライブラリも「選択と型保存更新」を基本層に据える(5 章)。
追加、削除、マージはその上の層として提供するが、意味論は各言語の直訳ではなく TypeScript の実行時意味論(spread)に合わせる(3 章)。

## 3. エンコード戦略

### 3.1 対応表

行を TypeScript のオブジェクト型で、行変数を generic 型パラメータで表す。
これは TypeScript チーム自身が generic spread(#28234)と generic rest(#28312)で採った表現である。

| 概念       | PureScript              | 本ライブラリ                                                        |
| ---------- | ----------------------- | ------------------------------------------------------------------- |
| 行         | `( x :: Int \| r )`     | `R extends Row`(`Row = Record<string, unknown>`)                    |
| 行変数     | `r`                     | generic 型パラメータ `R`                                            |
| 拡張       | `Cons l a r' r`         | `Cons<K, V, R> = Omit<R, K> & Record<K, V>`                         |
| 合成       | `Union` + `Nub`(左優先) | `Merge<L, R> = Omit<L, keyof R> & R`(右優先)                        |
| 不在制約   | `Lacks l r`             | `Lacks<R, K>`(値引数位置の交差として適用)                           |
| レコード   | `Record r`              | オブジェクト型そのもの                                              |
| バリアント | `Variant r`             | `Variant<R> = { [K in keyof R]: { tag: K; value: R[K] } }[keyof R]` |

レコードとバリアントが同じ行 `R` を共有する対称性は PureScript の設計からそのまま輸入する。
同じ行からレコード(積)とバリアント(和)の両方が生まれるため、たとえば `match` は「行 `R` のバリアント」を「行 `R` のハンドラレコード」で捌く形になる。

### 3.2 拡張の意味論は右優先上書き

追加とマージの意味論は**右優先上書き**(right-biased overwrite)に統一する。
既存のラベルに追加した場合、古い値は新しい値で置き換わる。

この選択は消去法による。
JavaScript のオブジェクトはキーが一意なので、Leijen の scoped labels(重複保持)は実行時表現を持てない。
Gaster & Jones の lacks 制約は、TypeScript では健全性を与えない(4.3 節)。
残るのは spread `{ ...l, ...r }` の実行時意味論そのものである右優先上書きだけであり、型をこれに一致させる。

PureScript の `merge` は左優先だが、これを真似ると型と実行時の値が食い違う。
spread は右が勝つからである。
型が値の挙動を正しく記述することを互換性より優先する。

## 4. TypeScript 本体の制約と設計への影響

エンコードの限界線は microsoft/TypeScript の issue 群で確定している。
本章では各制約と、それに対する本ライブラリの設計判断を対にして述べる。

### 4.1 行演算の公式回答は交差と Omit

TypeScript 3.2 の generic spread(#28234)は `{ ...t, x }` を `T & { x: ... }` と型付けし、generic rest(#28312)は `const { x, ...rest } = t` の `rest` を `Pick<T, Exclude<keyof T, "x">>` と型付けした。
行の拡張は交差、制限は `Omit` 相当、というのが本体チームの公式回答である。

ただし #28234 は非精度を明文で許容している。
`T` が既にラベル `x` を持つ場合、実行時は上書きなのに型は `T & { x: ... }`(交差)になり、具体型を直接 spread した結果と食い違う。

本ライブラリはこの非精度を API の戻り値型で吸収する。
`insert` や `merge` の戻り値を素の交差ではなく `Omit<R, K> & Record<K, V>` の形で宣言し、上書きの意味論を型に反映する。
利用者が素の spread を使った場合の非精度は本ライブラリの範囲外である。

### 4.2 逆方向推論は存在しない

PureScript の行クラスは fundeps により多方向に解けるが、TypeScript の conditional type と mapped type は入力から出力を計算する一方向の型関数である。
`Omit<T, K> = X` から `T` を逆算する単一化はない。

したがって、公開 API は生の型パラメータを入力位置(引数)に、型演算を出力位置(戻り値)にだけ置く。
「和と片方から残りを求める」ような逆方向の演算は提供しない。

### 4.3 width subtyping の下で Lacks は保証にならない

TypeScript の構造的部分型付けでは、`{ y: 1, x: 9 }` を `{ y: number }` 型の変数に代入できる(width subtyping)。
つまり型 `T` にラベル `x` がなくても、値には `x` が実在しうる。
spread がこの「密輸」されたフィールドを実行時に運ぶ unsoundness は #15454 で報告され、by design として close された。
width subtyping を禁止することは spread の全面禁止と同義だから、というのが本体チームの回答である。

したがって、型レベルの `Lacks<R, K>` を検査しても「実行時に上書きが起きない」ことは保証できない。
本ライブラリの `Lacks` は健全性の根拠ではなく、静的に既知のキー衝突を検出する opt-in の検査として位置づける(8 章)。

### 4.4 exact 型と negated type は存在しない

閉じた行(余剰フィールドを持たない exact 型)の要望 #12936 は 9 年以上 open のままであり、実験実装の PR #28749 は「TypeScript の合成手段である交差は exact 型に対して本質的に無意味であり、正解は row types + row polymorphism だが型システムの作り直し級」という作者の結論とともに close された。
negated type(`not T`)の PR #29317 も性能問題で未マージであり、「`T` は `x` を持たない」を第一級で書く手段はない。

したがって、閉じた行を前提にする API(`Object.keys` が `(keyof T)[]` を返す、など)は設計しない。

### 4.5 未解決 generic 上の型演算は簡約されない

型パラメータ `R` が未解決のまま `Omit<R, K>` などの型演算を適用すると、結果は簡約されず不透明なまま残る。
`insert` して `remove` した結果が元の `R` に代入可能であることを、checker は証明できない。

この制約から二つの帰結が出る。
第一に、row 演算を generic 関数の内部で合成するコードは型が通らないことがあり、これは仕様として 11 章の限界一覧に記載する。
第二に、公開 API の実装そのものでは、`Lacks` 制約を検証せずに前提とする unexported の raw ヘルパーへ処理を委譲することで、型アサーションを一切使わずに書ける(9 章)。

## 5. レコード API

### 5.1 基本層は選択と型保存更新

SML# と Elm の実績にならい、基本層は「行変数の保存」だけで実現できる二つの演算にする。

```ts
/** フィールド選択。SML# の #key に相当 */
declare const get: <R extends Row, K extends keyof R & string>(rec: R, key: K) => R[K];

/** 型を変えない更新。Elm の { rec | key = value } に相当 */
declare const set: <R extends Row, K extends keyof R & string>(rec: R, key: K, value: R[K]) => R;
```

`R extends Row` の制約と `K extends keyof R` の組み合わせが、SML# の kinded type variable `'a#{key: 'b}` の直訳になる。
戻り値が `R` そのものなので、余剰フィールドの型情報は失われない。
この層には追加の型演算が一切不要であり、推論も壊れない。

### 5.2 行を変える演算

その上の層として、行の形を変える演算を提供する。

```ts
/** 型の変更を許す更新。PureScript の modify に相当 */
declare const modify: <R extends Row, K extends keyof R & string, B>(
	rec: R,
	key: K,
	f: (value: R[K]) => B,
) => Merge<R, Record<K, B>>;

/** Lacks 制約付きの追加。K が既に R にあるとコンパイルエラー */
declare const insert: <K extends string, V, R extends Row>(
	rec: R & Lacks<R, K>,
	key: K,
	value: V,
) => Cons<K, V, R>;

/** フィールド削除。delete は予約語のため remove とする */
declare const remove: <R extends Row, K extends keyof R & string>(rec: R, key: K) => Omit<R, K>;

/** 右優先マージ */
declare const merge: <L extends Row, R extends Row>(left: L, right: R) => Merge<L, R>;

/** 改名。改名先が残余に既存だとコンパイルエラー */
declare const rename: <R extends Row, K extends keyof R & string, L extends string>(
	rec: R & Lacks<Omit<R, K>, L>,
	from: K,
	to: L,
) => Merge<Omit<R, K>, Record<L, R[K]>>;
```

`set` と `modify` を分けるのは、型保存(推論が壊れない、generic 文脈でも合成できる)と型変更(戻り値に型演算が入り、generic 文脈では簡約されない)のトレードオフが異なるからである。
利用者は型を変えないなら `set` を選ぶことで 4.5 節の制約を回避できる。

`insert` の `Lacks` 制約は型パラメータの制約としてではなく、値引数の交差 `rec: R & Lacks<R, K>` として課す。
`R` の制約節に `R` 自身を参照する型を書くと循環制約エラーになるからである。
違反時のエラーは「`never` に代入できない」という間接的なメッセージになるが、これはエンコードの妥協点として受け入れる。

### 5.3 data-first を採る

全 API はデータを第一引数に取る非カリー化形式(data-first)とする。
TypeScript の型推論は呼び出し時に引数から型パラメータを決める単方向であり、カリー化された data-last 形式では最初の適用の時点で行変数 `R` を決める材料がない。
pipe 演算子との親和性より推論の成立を優先する。

## 6. バリアント API

### 6.1 エンコード

バリアントは行 `R` から導出する tagged union で表す。

```ts
type Variant<R extends Row> = {
	[K in keyof R]: { readonly tag: K; readonly value: R[K] };
}[keyof R];
```

mapped type を `[keyof R]` で index する形は ts-adt が実績を持つエンコードであり、展開結果は素の判別共用体になる。
opaque な独自表現(タプルやクラス)を採らないのは、TypeScript 標準の narrowing と判別共用体エコシステム(switch 文、ts-pattern など)との相互運用を保つためである。

実行時表現は `{ tag, value }` の素朴なオブジェクトで、`purescript-variant` と同じである。

### 6.2 API

```ts
/** 注入。戻り値 Variant<Record<K, V>> は、より広い Variant<R> へ
 *  構造的部分型でそのまま代入できる */
declare const inj: <K extends string, V>(tag: K, value: V) => Variant<Record<K, V>>;

/** タグ判定の型ガード */
declare const isTag: <R extends Row, K extends keyof R & string>(
	v: Variant<R>,
	tag: K,
) => v is Variant<Pick<R, K>>;

/** 射影。タグ不一致なら undefined */
declare const prj: <R extends Row, K extends keyof R & string>(
	v: Variant<R>,
	tag: K,
) => R[K] | undefined;

/** 1 ケース処理と残余継続。残余では行が Omit<R, K> に縮む */
declare const on: <R extends Row, K extends keyof R & string, A, B>(
	v: Variant<R>,
	tag: K,
	handler: (value: R[K]) => A,
	otherwise: (rest: Variant<Omit<R, K>>) => B,
) => A | B;

/** 空バリアントの終端。Variant<{}> = never なので引数型は never。
 *  on の連鎖の網羅性をコンパイル時に保証する。PureScript の case_ に相当 */
declare const exhaustive: (v: never) => never;

/** ハンドラレコードによる網羅マッチ。mapped type が全ケースの提供を強制する */
declare const match: <R extends Row, B>(
	v: Variant<R>,
	handlers: { [K in keyof R]: (value: R[K]) => B },
) => B;

/** 行の縮小。型は実行時に消去されるため、タグ一覧を値としても要求する。
 *  不一致なら undefined */
declare const contract: <R extends Row, K extends keyof R & string>(
	v: Variant<R>,
	tags: ReadonlyArray<K>,
) => Variant<Pick<R, K>> | undefined;
```

### 6.3 expand は提供しない

PureScript の `expand`(小さいバリアントを大きい行へ埋め込む)に相当する関数は提供しない。
`Variant<{ a: A }>` は union の部分型として `Variant<{ a: A; b: B }>` にそのまま代入できるからである。
行多相の「少なくとも」側は、TypeScript では構造的部分型付けが無料で与える。
逆方向の `contract` だけが実行時のタグ検査を必要とする。

### 6.4 残余の持ち回りと双方向境界

`on` の残余を `Variant<Omit<R, K>>` で表す方式は、Effect の Match、ts-pattern、`purescript-variant` の `on` が共通して採る実証済みのパターンである。
`on` の連鎖で行が一つずつ縮み、最後に `exhaustive` が空を確認することで、ハンドラの網羅性がコンパイル時に閉じる。

OCaml の双方向境界(`[< ]` と `[> ]` の同時指定)に相当する表現は `Extract` と `Exclude` で組めるが、API 表面には出さない。
conjunctive type によるエラーメッセージの悪化は OCaml 自身が代償を払って確かめた領域であり、輸入しない。

## 7. 型レベル行演算

```ts
/** 行。ラベル(string)から型への有限写像 */
type Row = Record<string, unknown>;

/** 右優先マージ。spread { ...l, ...r } の実行時意味論と一致する */
type Merge<L extends Row, R extends Row> = Omit<L, keyof R> & R;

/** ラベル K を型 V で追加(既存なら上書き)。Merge の 1 フィールド版 */
type Cons<K extends string, V, R extends Row> = Merge<R, Record<K, V>>;

/** R がラベル K を持たないことの opt-in 検査。持つ場合 never に潰れる */
type Lacks<R extends Row, K extends PropertyKey> = K extends keyof R ? never : unknown;
```

`Union` という名前は使わない。
PureScript の `Union` は重複ラベルを保持する左結合の関係であり、重複を表現できない本ライブラリの `Merge` に同じ名前を与えると意味論の違いを隠してしまう。

`Nub`(重複除去)は提供しない。
交差型と spread は常に上書きで正規化するため、重複ラベルを持つ行がそもそも構成できず、除去する対象が存在しない。

いずれの型も再帰しない単純な mapped type と conditional type で構成する。
深い再帰 conditional type による行の分解(型レベルでのラベル列挙や順序付き処理)は、コンパイル時間の悪化を理由に採らない。
型関数の深い再帰がコンパイル時間でスケールしないことは、ts-toolbelt のメンテナンス停滞が示した教訓である。

## 8. Lacks の位置づけ

`Lacks` は opt-in の lint 的検査であり、健全性の保証ではない。
この区別を API ドキュメントにも明記する。

検出できるのは、静的に既知のキー衝突である。

```ts
insert({ x: 1 }, 'x', 2); // コンパイルエラー: 既存キーへの insert
```

検出できないのは、width subtyping で流入した余剰キーである(4.3 節)。

```ts
const wide = { y: 1, x: 9 };
const narrow: { y: number } = wide; // 合法な代入
insert(narrow, 'x', 2); // 型は通るが、実行時は上書きになる
```

`Lacks` の別のエンコードとして `R & { [P in K]?: never }`(optional な `never` プロパティで不在を表す)があるが、採らない。
このエンコードは `exactOptionalPropertyTypes` の有無で意味が変わる(フラグがないと `undefined` の代入を許してしまう)ため、利用者の tsconfig への依存が生まれる。
conditional type 版の `Lacks` はフラグと独立に機能する。

## 9. ランタイム実装方針

ランタイムは依存ゼロで、次の三種類の操作だけで構成する。

- レコード演算：spread `{ ...rec, [key]: value }` と rest destructuring `const { [key]: _, ...rest } = rec`
- バリアント構成：`{ tag, value }` オブジェクトの生成
- バリアント検査：`v.tag === tag` の比較

本リポジトリの oxlint 設定は型アサーションを全面禁止している(`typescript/consistent-type-assertions: never`)。
本ライブラリはこれを例外なく守り、`oxlint-disable` によるルールの抑制も一切行わない。
型アサーションは 0 件である。

`get`、`set`、`modify`、`insert`、`remove`、`merge`、`inj`、`isTag`、`prj` は自然な推論で戻り値型を満たす。
残る箇所は、4.5 節のとおり checker が「未解決 generic 上の型演算」を簡約できないために素朴な実装では通らないが、いずれも**アサーションではなく設計の変更**で解決する。
使う技法は次の二つに集約される。

- **型ガード委譲**：実行時の `boolean` をユーザー定義型ガード(`v is X`)で包む。TypeScript がアサーションなしで narrowing を得る唯一の公式な手段であり、predicate の正しさ自体を checker は検証しない。`isTag` に加えて `isNotTag`(`on` の残余分岐用)、`isAnyTag`(`contract` 用)がこの形を取る。
- **raw ヘルパーへの委譲**：`Lacks` 制約を検証しない unexported の関数に処理を任せ、公開 API はその制約付き型を被せた薄いラッパーにする。`rename`(および `insert`)がこの形を取る。

### rename と insert: Lacks を検証しない raw ヘルパーへの委譲

`rename` の素朴な実装 `{ ...rest, [to]: value }` は、`to` が非リテラルな generic `string` であるため、`Record<L, R[K]>` ではなく index signature `{ [x: string]: R[K] }` に推論が潰れ、宣言した戻り値型に代入できない。
これを、`Lacks` 制約を持たない `insertRaw`(`src/internal/raw.ts`)に委譲する形で解決する。
`insertRaw` は「追加するだけ」の関数で、キーの重複を型で保証しない。
公開 `insert` はこれに `Lacks` 制約付きの型を被せただけの薄いラッパーであり、`rename`(内部的には `renameRaw`)も同じ `insertRaw` を呼ぶ。
`insertRaw`/`renameRaw` を `src/internal/` に置いて export するのは、テストの PBT ヘルパー(後述)からも同じ実装を再利用するためである。

```ts
// src/internal/raw.ts
export const insertRaw = <K extends string, V, R extends Row>(
	rec: R,
	key: K,
	value: V,
): Cons<K, V, R> => ({ ...rec, [key]: value });

export const renameRaw = <R extends Row, K extends keyof R & string, L extends string>(
	rec: R,
	from: K,
	to: L,
): Merge<Omit<R, K>, Record<L, R[K]>> => {
	const { [from]: value, ...rest } = rec;
	return insertRaw(rest, to, value);
};

// src/record.ts
export const insert = <K extends string, V, R extends Row>(
	rec: R & Lacks<R, K>,
	key: K,
	value: V,
): Cons<K, V, R> => insertRaw(rec, key, value);

export const rename = <R extends Row, K extends keyof R & string, L extends string>(
	rec: R & Lacks<Omit<R, K>, L>,
	from: K,
	to: L,
): Merge<Omit<R, K>, Record<L, R[K]>> => renameRaw(rec, from, to);
```

### on: 二段の型ガードで両分岐を尽くす

`on` の残余分岐では、`isTag` の否定(`else` 相当)だけでは `v` が `Variant<Omit<R, K>>` に narrowing されない。
`Exclude<Variant<R>, Variant<Pick<R, K>>>` のような別表現に変えても checker はこれを `Variant<Omit<R, K>>` と同一だと証明できない(実装時に検証済み)。
そこで `isTag` と対になる `isNotTag`(`v is Variant<Omit<R, K>>`)を追加し、両方の型ガードで分岐を尽くす。
比較ロジックの重複を避けるため、`isNotTag` は `isTag` の否定として実装する。
末尾は型を閉じるためだけの `throw`(到達しない。`isTag`/`isNotTag` は `v.tag` に対する相補的な比較なので、どちらかに必ず一致する)。

```ts
const isNotTag = <R extends Row, K extends keyof R & string>(
	v: Variant<R>,
	tag: K,
): v is Variant<Omit<R, K>> => !isTag(v, tag);

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
```

`isTag` → `isNotTag` → `throw` の順序でなければならない。
逆順(`isNotTag` を先に判定する)にすると、`isTag` 側の分岐で `v.value` が `R[K]` に narrowing されない。

### contract: 型ガード関数として実装する

`contract` は `.some()` という配列操作の結果を直接返しているだけでは narrowing が起きない。
複数タグ版の型ガード `isAnyTag` を新設し、各タグとの比較は `isTag` に委譲する。

```ts
const isAnyTag = <R extends Row, K extends keyof R & string>(
	v: Variant<R>,
	tags: ReadonlyArray<K>,
): v is Variant<Pick<R, K>> => tags.some((tag) => isTag(v, tag));

export const contract = <R extends Row, K extends keyof R & string>(
	v: Variant<R>,
	tags: ReadonlyArray<K>,
): Variant<Pick<R, K>> | undefined => (isAnyTag(v, tags) ? v : undefined);
```

### テスト側の回避策も同じ 4.5 節の制約に由来する

ライブラリ本体だけでなく、テストコードも同じ「未解決 generic 上の型演算は簡約されない」という制約に何度かぶつかる。これは対症療法の場当たり的な積み重ねではなく、原因が共通する第三のカテゴリとして扱う。

- `tests/record.test.ts` の PBT は、行の型が完全にジェネリックな `Record<string, unknown>` になる(`fc.dictionary` などで生成するため)。`keyof Record<string, unknown>` は `string` に潰れるので、`Lacks<Record<string, unknown>, K>` はどんな `K` に対しても `never` になり、公開 `insert`/`rename` をそもそも呼べない。テストは `src/internal/raw.ts` の `insertRaw`/`renameRaw` を直接使ってランタイム挙動だけを検査し、型レベルの `Lacks` 保証は `tests/record.test-d.ts` の具体型テストに委ねる。
- `tests/variant.test.ts` の `on` チェーン(`exhaustive` まで到達させるもの)は、最終段の残余型 `Variant<Omit<Omit<Shape, 'a'>, 'b'>>` が `never` まで簡約されないことがある(tsgolint / typescript-go preview の推論の限界)。最終段の `on` 呼び出しにだけ明示的型引数を与えて回避する。

いずれも `unsafeCoerce` のようなアサーションではなく、型が通る形へ処理を書き換えることで解決している。

### trusted computing base

以前のバージョンは `unsafeCoerce` の呼び出し箇所のリストを trusted computing base としていたが、本ライブラリはこれを持たない。
信頼境界は、公開 API が宣言する `Lacks` 制約付きのシグネチャそのものに移る。
`src/internal/raw.ts` の raw ヘルパーは `Lacks` を検証せず前提とするが、これは通常の関数分割であり、型システムを迂回する操作ではない。
正当性は tests/ の型レベルテストと値レベルテストが具体型・具体値で担保する。

## 10. 採らなかった選択肢

**tsc のフォークと ts-patch**。
コンパイラ改造は行変数の第一級構文と真の単一化を与えるが、TypeScript 本体への追随コストが恒常的に発生する。
generic からの extends(#2509)を本体チームが「分離検査が壊れる」として断念した経緯は、行の第一級化が checker の局所的な拡張では済まないことを示している。
既存 TS 型システム上のエンコードを採り、tsc がそのまま検査できることを優先する。

**exact 型のエミュレーション**。
`T & { [K in Exclude<PropertyKey, keyof T>]?: never }` のようなエンコードは、mapped type のキーが index signature に潰れるため成立しない(negated type がない限り一般解はない、というのが #12936 での結論である)。
branded type による閉じた行の近似も、エラーメッセージと推論を壊すため採らない。

**左優先 merge(PureScript 互換)**。
3.2 節のとおり、spread の実行時意味論と食い違う型は付けない。

**data-last カリー化 API**。
5.3 節のとおり、行変数の推論が成立しない。

**擬似 HKT と generic ADT**。
generic なバリアント(`Option<A>` など)を一般に扱うには、トークン置換(ts-union、paarthenon/variant)か `this` 型 interface(Effect の `TaggedEnum.WithGenerics`、fp-ts の URI テーブル)のいずれかの擬似 HKT が要る。
前者は深いネストで置換が破綻し、後者はパラメータ数固定とボイラープレートを要求する。
どちらも行多相そのものとは独立した機構であり、スコープ外とする。
利用者は具体型の行(`Variant<{ some: number; none: {} }>` など)で代用できる。

**深い再帰 conditional type**。
7 章のとおり、コンパイル時間を理由に採らない。

## 11. 既知の限界

エンコードである以上、本家の行多相と等価にはならない。
既知の限界を現象、原因、テストでの文書化箇所の三つ組で列挙する。
テストの詳細は 12 章で述べる。

| 現象                                                                      | 原因                                        | テスト                                       |
| ------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------- |
| generic 文脈で `remove(insert(r, 'x', v), 'x')` の型が `R` に戻らない     | 未解決 generic 上の `Omit` 非簡約(4.5 節)   | `tests/limits.test-d.ts`                     |
| `Lacks` を通過した値に余剰キーが実在すると `insert` が実行時に上書きする  | width subtyping、#15454(4.3 節)             | `tests/limits.test.ts`                       |
| 「和と片方から残りを求める」形の API が書けない                           | 逆方向推論の不在(4.2 節)                    | 設計で回避(該当 API を提供しない)            |
| `insert` の制約違反エラーが「`never` に代入不可」という間接的な文言になる | 値引数位置の交差による `Lacks` 適用(5.2 節) | `tests/record.test-d.ts`                     |
| `contract` にタグ一覧の値を渡す必要がある                                 | 型の実行時消去                              | `tests/variant.test-d.ts`                    |
| 利用者が素の spread を generic に使うと型が交差になり上書きを表さない     | #28234 の明文化された非精度(4.1 節)         | 本ライブラリ API の範囲外(DESIGN に記載のみ) |

## 12. テスト戦略

テストは値レベルと型レベルの二層で構成する。

```
tests/
  record.test.ts      // 値レベル: 各演算の実行時挙動(右優先上書き、非破壊性)
  variant.test.ts     // 値レベル: inj / prj / on / match / contract の実行時挙動
  record.test-d.ts    // 型レベル: expectTypeOf と @ts-expect-error
  variant.test-d.ts   // 型レベル
  limits.test.ts      // 既知の限界の値レベル文書化
  limits.test-d.ts    // 既知の限界の型レベル文書化
```

型レベルテストには vitest 同梱の `expectTypeOf` と typecheck モードを使う。
typecheck モードは tsc を用いるため、devDependency に `typescript` の追加が必要になる。
正例は `expectTypeOf` による型の一致検査、負例は `@ts-expect-error` による「コンパイルエラーになるべき」ことの検査で書く。
負例の対象は、重複キーへの `insert`、`match` のハンドラ欠落、存在しないキーへの `get`、`rename` の衝突、`exhaustive` への非 `never` 引数である。

11 章の限界一覧は `limits.test.ts` と `limits.test-d.ts` に 1 対 1 で対応させる。
限界の型レベルテストには「この `@ts-expect-error` が不要になったら TypeScript 側が改善された印」というコメントを付け、回帰検知ではなく改善検知として機能させる。

値レベルテストでは、演算の非破壊性(元オブジェクトが変異しない)、マージの右優先、`prj` と `contract` の不一致時 `undefined`、`on` 連鎖と `exhaustive` の網羅実行を検査する。

## 13. 実装計画

小さくコミットできる単位に分割する。

1. **テスト基盤**：`pnpm add -D typescript`、`vitest.config.ts` の新設(typecheck 有効化)、`nix flake check` の hash mismatch エラーから `nix/node-modules.nix` のハッシュを更新(CLAUDE.md 記載の手順)。tsconfig の `declaration: true` が `tsc --noEmit` と衝突する場合は declaration 系オプションを外す(現状ビルド成果物を出していないため影響はない)
2. **型レベル行演算**：`src/row.ts` と `tests/row.test-d.ts`
3. **レコード**：`src/record.ts` とテスト
4. **バリアント**：`src/variant.ts` とテスト
5. **公開面と限界の文書化**：`src/index.ts`、`tests/limits.test.ts` / `limits.test-d.ts`、README の拡充

各段階で `nix fmt` と `nix flake check` を通す。

実装時の検証ポイントが二つある。
computed key の rest destructuring に対する `Omit` 推論は TypeScript バージョン依存の細部があるため、レコード実装の冒頭で最小ケースを確認する。
通らない場合はアサーションで埋めるのではなく、9 章のとおり `Lacks` を検証しない unexported の raw ヘルパーへ処理を委譲する形に設計を変える。
`match` の戻り値 `B` がハンドラ間の union として推論されるかも同様に確認し、問題があれば戻り値型を `{ [K in keyof R]: ReturnType<...> }[keyof R]` 方式に切り替える。

## 14. 参考文献

### 理論

- Wand, "Complete Type Inference for Simple Objects" (LICS 1987)
- Rémy, "Type checking records and variants in a natural extension of ML" (POPL 1989) — <https://dl.acm.org/doi/10.1145/75277.75284>
- Gaster & Jones, "A Polymorphic Type System for Extensible Records and Variants" (1996)
- Leijen, "Extensible records with scoped labels" (TFP 2005) — <https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/scopedlabels.pdf>
- Ohori, "A Polymorphic Record Calculus and Its Compilation" (TOPLAS 1995)
- Morris & McKinna, "Abstracting Extensible Data Types: Or, Rows by Any Other Name" (POPL 2019) — <https://dl.acm.org/doi/pdf/10.1145/3290325>

### 各言語

- PureScript Prim.Row — <https://pursuit.purescript.org/builtins/docs/Prim.Row>
- purescript-variant — <https://github.com/natefaubion/purescript-variant>
- OCaml Manual: Polymorphic variants — <https://ocaml.org/manual/5.4/polyvariant.html>
- SML# Document: Record polymorphism — <https://smlsharp.github.io/en/documents/4.0.0/Ch8.html>
- elm/compiler#985(フィールド追加と削除の構文の削除) — <https://github.com/elm/compiler/issues/985>

### TypeScript 本体の議論

- #12936 Exact Types — <https://github.com/microsoft/TypeScript/issues/12936>
- #28749 Exact types PR(未マージ) — <https://github.com/microsoft/TypeScript/pull/28749>
- #2509 first-class labels for extensible rows — <https://github.com/microsoft/TypeScript/issues/2509>
- #10727 spread/rest higher-order types operator — <https://github.com/microsoft/TypeScript/issues/10727>
- #28234 Generic spread expressions(TS 3.2) — <https://github.com/microsoft/TypeScript/pull/28234>
- #28312 Generic object rest(TS 3.2) — <https://github.com/microsoft/TypeScript/pull/28312>
- #29317 Negated types PR(未マージ) — <https://github.com/microsoft/TypeScript/pull/29317>
- #15454 Object spread unsound w.r.t. width subtyping — <https://github.com/microsoft/TypeScript/issues/15454>

### 既存実装と解説

- ts-adt — <https://github.com/pfgray/ts-adt>
- Effect Match — <https://effect-ts.github.io/effect/effect/Match.ts.html>
- ts-pattern — <https://github.com/gvergnaud/ts-pattern>
- optics-ts — <https://github.com/akheron/optics-ts>
- Iven Marquardt, "Row Polymorphic Records for More Type Safety in TypeScript" — <https://dev.to/iquardt/row-polymorphic-records-for-more-type-safety-in-typescript-4akg>
- Max Heiber, "Subtyping loses information, row polymorphism does not" — <https://maxheiber.medium.com/subtyping-loses-information-row-polymorphism-does-not-c70cb62e2277>
