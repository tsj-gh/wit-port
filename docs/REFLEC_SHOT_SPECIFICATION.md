# Reflec-Shot 仕様書（盤外パッド・経路端点）

本ドキュメントは **Reflec-Shot** における、盤面内外の役割マスと**グレード別の生成ルール**をまとめる。  
実装の参照先: `src/app/lab/reflec-shot/gridTypes.ts`, `gridStageGen.ts`, `ReflecShotGame.tsx`。

---

## 座標系（共通）

- 盤面上の playable 領域は **`pathable[c][r]`** の矩形（`width`×`height`）。**`c`** は左から 0 の列、**`r`** は上から 0 の行（**`r` が大きいほど画面下**）。
- **下辺**は **`r = height - 1`**、**上辺**は **`r = 0`**、**左辺**は **`c = 0`**、**右辺**は **`c = width - 1`**。
- **`Dir`**: 1 マス移動は `c += dx`, `r += dy`。**`DIR.U = (0, +1)`**（画面下向き）、**`DIR.D = (0, -1)`**（画面上向き）、`L` / `R` は列。
- `startPad` / `goalPad` は盤外座標を取りうる（`isAgentCell` で特例）。

---

## 用語（パッドと経路端点）

### startPad

- **射出体の初期位置**。
- **Grade 1**: 盤面の **下辺外**（`start` の真下：`startPad = (start.c, start.r + 1)`）。
- **Grade 2**: 射入が常に **`DIR.U`** となるよう盤を回転させた後は、**`start` の真上**（`startPad = (start.c, start.r - 1)`）。`startPad → start` が **`DIR.U`**。

### start / goal

- **`start`**: 生成経路の**始端**（盤内 `pathable`）。**`goal`**: **終端**（盤内）。
- Grade 1/2 の折れ線生成では、候補として「下寄り・上寄り」の端点を選んでから経路を張る（詳細は下記グレード節）。

### goalPad

- **射出体が到達するとクリア判定**するマス。
- **Grade 1**: **`goal` の真上**（`goalPad = (goal.c, goal.r - 1)`）。
- **Grade 2**: **`goal` に向かう最後の直線の進行方向に、`goal` と直交隣接する盤外 1 マス**。  
  すなわち `prev` を経路上のゴール直前マスとすると、`goalPad = goal + unitDir(prev → goal)`。上辺ゴールで下から入るときは従来どおり `goal` の上側外。

---

## グレード別・盤面生成ルール

実装は `generateGridStage` / `generatePolylineStage` を参照。

### Grade 1

- **盤面**: 4×4 矩形（全体 `pathable`）。
- **経路**: `start` を `bottomCandidates`、`goal` を `topCandidates` から乱択。折れ数は **2 または 4**（ただし `start` と `goal` が同列なら 4 のみ）。
- **制約**: 折れ数どおりの直角。**同一マス再訪なし**（`grade1NoRevisit`）。
- **バンパー**: 盤内の直角折れに加え、**射出入力で `startPad→start` と経路第 1 辺が直交する場合は `start` にバンパー**。同様に **出口で直交折れなら `goal` にバンパー**（`placeDiagonalBumpers`）。
- **パッド**: 上記「Grade 1」の `startPad` / `goalPad`。

### Grade 2

- **盤面**: 5×5 矩形（全体 `pathable`）。
- **経路**: `start` / `goal` の選び方は Grade 1 と同型。折れ数は **4 または 6**。折れ 4 のときは列差・行差が両方非零（両軸にターン必須）。
- **直交マス**: 経路上に「十」字交差セルが存在すること（`pathHasOrthogonalCrossCell`）。
- **再訪**: 折れマス以外で同じマスを二度通らない（`grade2BendNoRevisit`）。ポータル用の仮想折れは **使わない**（内角折れ集合は `bendCellsInPath` のみ）。
- **向きと回転**: 経路決定後、**盤面と経路を 90° 単位で回転**し、**経路の第 1 歩が必ず `DIR.U`** になる向きだけを採用。複数候補があれば乱択。
- **パッド**: `startPad` / `goalPad` は上記 Grade 2 定義。
- **バンパー**: **盤内の直角折れのセルのみ**（`placeDiagonalBumpersInterior`）。**`start` / `goal` にはポータル用バンパーを置かない**。バンパー個数は **折れ数と常に一致**（例: 6 折れで 8 個にはならない）。

### Grade 3〜5

- **盤面**: グレードに応じたサイズと **穴テンプレート**（L / T / 十字など）。`pathable` は連結だが矩形全域ではない場合がある。
- **経路**: `bottomCandidates` / `topCandidates` から端点を取り、`findSimplePath` で簡単な経路。長さはバンパー個数に応える。
- **バンパー**: 経路上の**内側マス**から指定個数（Grade 3–4 で 2、Grade 5 で 3）を選び、**4 種バンパー**（`bumperKindForTurn`）で正解を付与。斜め 2 種のみの折れ線専用ロジックは **使わない**。
- **パッド**: 現状 **`startPad = (start.c, start.r + 1)`**（`start` の下）、**`goalPad = (goal.c, goal.r - 1)`**（`goal` の上）。Grade 2 とは異なる（将来 Grade 2 と揃える拡張の余地あり）。

---

## 経路のイメージ

盤面上の「線」としての経路は **`start`〜`goal`**。プレイヤー操作・シミュレーションでは **`startPad` から入り、`goalPad` でクリア**までを一連の動きとして扱う。

---

## 検証スクリプト（Grade 2）

Grade 2 の主要条件（第 1 歩 `DIR.U`、`startPad→start` が `DIR.U`、`goalPad` が最終進行延長上の盤外、バンパー数＝折れ数、`start`/`goal` にバンパーなし）をまとめて試す場合:

```bash
npx esbuild scripts/run-reflec-shot-grade2-check.mts --bundle --platform=node --format=cjs --outfile=scripts/tmp-reflec-g2.cjs && node scripts/tmp-reflec-g2.cjs && del scripts\\tmp-reflec-g2.cjs
```

（Windows 以外では生成ファイルの削除コマンドを読み替え。）
