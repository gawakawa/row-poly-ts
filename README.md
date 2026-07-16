# row-poly-ts

PureScript や SML#、OCaml が備える row polymorphism(拡張可能レコードと多相バリアント)を、TypeScript の既存の型システム上のエンコードとして提供するライブラリ。
コンパイラの改造や独自構文は使わない。

設計と根拠は [docs/DESIGN.md](docs/DESIGN.md) を参照。

## 使い方

### レコード

```ts
import { get, insert, merge, modify, remove, rename, set } from 'row-poly-ts';

const user = { id: 1, name: 'Ada' };

get(user, 'name'); // 'Ada'
set(user, 'name', 'Grace'); // { id: 1, name: 'Grace' }
modify(user, 'id', (id) => id.toString()); // { id: '1', name: 'Ada' }
insert(user, 'active', true); // { id: 1, name: 'Ada', active: true }
remove(user, 'name'); // { id: 1 }
merge(user, { name: 'Grace', age: 30 }); // { id: 1, name: 'Grace', age: 30 }(右優先)
rename(user, 'name', 'displayName'); // { id: 1, displayName: 'Ada' }
```

`user` はどの操作でも変異しない。`insert` は既存キーへの追加を、`rename` は改名先の衝突をコンパイルエラーにする(`Lacks` による opt-in 検査。健全性の保証ではない点は [docs/DESIGN.md](docs/DESIGN.md) 8 章を参照)。

### バリアント

```ts
import { contract, exhaustive, inj, isTag, match, on, prj } from 'row-poly-ts';
import type { Variant } from 'row-poly-ts';

type Shape = { circle: number; square: number };

const area = (shape: Variant<Shape>): number =>
	match(shape, {
		circle: (radius) => radius * radius * Math.PI,
		square: (side) => side * side,
	});

const describe = (shape: Variant<Shape>): string =>
	on(
		shape,
		'circle',
		(radius) => `circle: ${radius}`,
		(rest) => on(rest, 'square', (side) => `square: ${side}`, exhaustive),
	);

const shape: Variant<Shape> = inj('circle', 3);

isTag(shape, 'circle'); // true
prj(shape, 'circle'); // 3
prj(shape, 'square'); // undefined
area(shape); // 28.27...
describe(shape); // 'circle: 3'
contract(shape, ['circle']); // shape | undefined
```

`inj('circle', 3)` は `Variant<Record<'circle', number>>` を返すが、より広い `Variant<Shape>` へ構造的部分型でそのまま代入できる(6.3 節「expand は提供しない」)。`match` は `Shape` の全タグ分のハンドラを渡さないとコンパイルエラーになる。`on` の連鎖は `exhaustive` で終端することで、ハンドラの網羅性をコンパイル時に保証する。

## 既知の限界

エンコードである以上、本家の row polymorphism と等価にはならない。既知の限界は [docs/DESIGN.md](docs/DESIGN.md) 11 章に一覧があり、`tests/limits.test.ts` / `tests/limits.test-d.ts` に対応する検証がある。
