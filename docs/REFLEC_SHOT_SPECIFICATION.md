# Reflec-Shot 仕様書（盤外パッド・経路端点）

本ドキュメントは **Reflec-Shot** における、盤面内外の役割マスと**グレード別の生成ルール**をまとめる。  
実装の参照先: `src/app/lab/reflec-shot/gridTypes.ts`, `gridStageGen.ts`, `ReflecShotGame.tsx`。

---

## 座標系（共通）

- **画面**: 上・下・左・右は画面上のそのまま。**x 軸は右が正、y 軸は上が正**（いわゆる数学座標と同じ向き）。
- **グリッド**: playable 領域は **`pathable[c][r]`**（`width`×`height`）。**`c`** は左から 0 の列（= 画面 **x** と一致）、**`r`** は上から 0 の行（**下にいくほど `r` が増える** = 画面 **y 負** に相当）。
- **辺**: **上辺** `r = 0`、**下辺** `r = height - 1`、**左** `c = 0`、**右** `c = width - 1`。
- **`Dir`（進行・反射の向き）**は常に **画面 xy** 基準: **`DIR.R (dx=+1)`** 右、**`DIR.L`** 左、**`DIR.U (dy=+1)`** 上、**`DIR.D (dy=-1)`** 下。次マスは **`addCell`**: `c' = c + dx`, **`r' = r - dy`**。
- 隣接マス間のグリッド差分 `(Δc, Δr)` から `Dir` へは **`gridDeltaToScreenDir`**（`(Δc, -Δr)`）。
- `startPad` / `goalPad` は盤外座標を取りうる（`isAgentCell` で特例）。

---

## 用語（パッドと経路端点）

### startPad

- **射出体の初期位置**。
- **Grade 1**: 盤面の **下辺外**（`start` の真下：`startPad = (start.c, start.r + 1)`）。
- **Grade 2 / 3**: 盤を回転させた後も **`start` の真下**（`startPad = (start.c, start.r + 1)`）。**`startPad → start` は画面**上**向き**（**`DIR.U`**）。

### start / goal

- **`start`**: 生成経路の**始端**（盤内 `pathable`）。**`goal`**: **終端**（盤内）。
- Grade 1/2 の折れ線生成では、候補として「下寄り・上寄り」の端点を選んでから経路を張る（詳細は下記グレード節）。

### goalPad

- **射出体が到達するとクリア判定**するマス。
- **Grade 1**: **`goal` の真上**（`goalPad = (goal.c, goal.r - 1)`）。
- **Grade 2 / 3**: **`goal` に向かう最後の直線の進行方向に、`goal` と直交隣接する盤外 1 マス**。  
  すなわち `prev` を経路上のゴール直前マスとすると、`goalPad = goal + unitDir(prev → goal)`。上辺ゴールで下から入るときは従来どおり `goal` の上側外。

---

## グレード別・盤面生成ルール

実装は `generateGridStage` / `generatePolylineStage` を参照。

### Grade 1

- **盤面**: 4×4 矩形（全体 `pathable`）。
- **経路**: `start` を `bottomCandidates`、`goal` を `topCandidates` から乱択。折れ数は **1〜4** を乱択。
- **制約**: 折れ数どおりの直角。**同一マス再訪なし**（`grade1NoRevisit`）。
- **バンパー**: 盤内の直角折れに加え、**射出入力で `startPad→start` と経路第 1 辺が直交する場合は `start` にバンパー**。同様に **出口で直交折れなら `goal` にバンパー**（`placeDiagonalBumpers`）。**配置後のバンパー合計が 5 以上**の経路は採用しない（リトライ）。
- **パッド**: 上記「Grade 1」の `startPad` / `goalPad`。

### Grade 2

- **盤面**: 5×5 矩形（全体 `pathable`）。
- **経路**: `start` / `goal` の選び方は Grade 1 と同型。折れ数は **4 または 6**。折れ 4 のときは列差・行差が両方非零（両軸にターン必須）。
- **直交マス**: 折れ **4** のときのみ、経路上に「十」字交差セルが存在すること（`pathHasOrthogonalCrossCell`）。折れ **6** のときは**全マス同一再訪なし**（`grade1NoRevisit` と同等）。
- **再訪（折れ 4）**: 折れマス以外で同じマスを二度通らない（`grade2BendNoRevisit`）。ポータル用の仮想折れは **使わない**（内角折れ集合は `bendCellsInPath` のみ）。折れ **6** では上記に加え経路全体でマスの重複なし。
- **向きと回転**: 経路決定後、**盤面と経路を 90° 単位で回転**し、**経路の第 1 歩が必ず `DIR.U`** になる向きだけを採用。複数候補があれば乱択。
- **パッド**: `startPad` / `goalPad` は上記 Grade 2 定義。
- **バンパー**: **盤内の直角折れのセルのみ**（`placeDiagonalBumpersInterior`）。**`start` / `goal` にはポータル用バンパーを置かない**。バンパー個数は **折れ数と常に一致**（例: 6 折れで 8 個にはならない）。

### Grade 3

- **盤面**: 6×7 矩形（全体 `pathable`）。
- **経路**: **折れ数 6** の直交経路で、**ちょうど 1 マス（再訪折れ点）だけが 2 回通る**。そのマスでは **1 回目も 2 回目も 90° 折れ**（直進通過はしない）。
- **再訪の入射方向**: 2 回目の入射方向は、**1 回目の入射方向の逆向き**、または **1 回目の反射（出射）方向と同じ**のいずれか。例: 再訪マスが `SLASH` で 1 回目が `DIR.U` 進入のとき反射は `DIR.R` なので、2 回目の進入は `DIR.D`（`U` の逆向き）または `DIR.R`。**再訪マスの上下左右 4 隣接マスは、4 本の辺としてそれぞれ 1 度ずつ**使われる（前後の経路セルが 4 点とも異なる）。
- **生成**: 端点は下辺寄り・上辺寄り候補から乱択したうえで、制約を満たす経路を探索（DFS）。**経路決定後**、Grade 2 と同様に **90° 単位で盤と経路を回転**し、**第 1 歩が `DIR.U`** かつ **`startPad→start` が `DIR.U`** になる向きを採用。
- **バンパー**: 盤内の直角折れのみ（`placeDiagonalBumpersInterior`）。**同一セルに 2 度折れる場合は 1 個の斜めバンパーが両方のターンに整合**すること（両ターンで同じ `SLASH` / `BACKSLASH`）。**バンパーが置かれるマス数は 5**（直角 6 回のうち再訪マスが 2 回分を 1 セルで担当）。

### Grade 4〜5

- **盤面**: グレードに応じたサイズと **穴テンプレート**（L / T、Grade 5 に十字など）。`pathable` は連結だが矩形全域ではない場合がある。
- **経路**: `bottomCandidates` / `topCandidates` から端点を取り、`findSimplePath` で簡単な経路。長さはバンパー個数に応える。
- **バンパー**: 経路上の**内側マス**から指定個数（**Grade 4 で 2、Grade 5 で 3**）を選び、**4 種バンパー**（`bumperKindForTurn`）で正解を付与。斜め 2 種のみの折れ線専用ロジックは **使わない**。
- **パッド**: 現状 **`startPad = (start.c, start.r + 1)`**（`start` の下）、**`goalPad = (goal.c, goal.r - 1)`**（`goal` の上）。Grade 2 / 3 とは異なる。

---

## 経路のイメージ

盤面上の「線」としての経路は **`start`〜`goal`**。プレイヤー操作・シミュレーションでは **`startPad` から入り、`goalPad` でクリア**までを一連の動きとして扱う。

---

## 盤面の描画（キャンバス）

実装は `ReflecShotGame.tsx` のキャンバス描画と `gridTypes.ts` の **`stageRowRange`**。

- **列**: 各グリッド行について **`c = 0`〜`width - 1`** のマスを描画する（盤の矩形幅は常に `width` 列）。
- **行（縦方向のビューポート）**: 描画する行範囲 `rMin`〜`rMax` は、`startPad`・`goalPad`・`start`・`goal` の行に加え、**正解経路 `solutionPath` に含まれるすべてのマス**（`start`〜`goal` の各セル）の行の最小・最大で決める。
- **経路マスの表示**: 上記により、**経路が占めるマスは必ず描画対象の行範囲に含まれる**。`start` / `goal` が同じ行にあっても、経路が他の行を通る場合に「1 行だけの帯」に見える欠けが出ない。
- **パッド**: `startPad` / `goalPad` は盤外座標を取りうる。パッド行は上記 `rMin`〜`rMax` にパッド自身の `r` が含まれるため、パッド用マスもキャンバス内にレイアウトされる（従来どおり）。
- Void（`pathable` が false のマス）は、ビューポート内にあれば従来どおり穴として描画される。

---

## 検証スクリプト（Grade 2）

Grade 2 の主要条件（第 1 歩 `DIR.U`、`startPad→start` が `DIR.U`、`goalPad` が最終進行延長上の盤外、バンパー数＝折れ数、`start`/`goal` にバンパーなし）をまとめて試す場合:

```bash
npx esbuild scripts/run-reflec-shot-grade2-check.mts --bundle --platform=node --format=cjs --outfile=scripts/tmp-reflec-g2.cjs && node scripts/tmp-reflec-g2.cjs && del scripts\\tmp-reflec-g2.cjs
```

（Windows 以外では生成ファイルの削除コマンドを読み替え。）
