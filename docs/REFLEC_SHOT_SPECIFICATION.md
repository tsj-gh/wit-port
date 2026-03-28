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
- **Grade 2・折れ 6**: **`goal` の真上 1 マスに固定**（`goalPad = (goal.c, goal.r - 1)`）。`Q → goal` の向きに依存させない。`placeDiagonalBumpers` はこのパッドと **`goalPad → goal`**（真上から盤内へ＝画面 **`DIR.D`**）を前提に、`Q → goal` との整合でゴール周りの斜めバンパーを決める。
- **Grade 2・折れ 4 / Grade 3**: **`goal` に向かう最後の直線の進行方向に、`goal` と直交隣接する盤外 1 マス**。  
  すなわち `prev` を経路上のゴール直前マスとすると、`goalPad = goal + unitDir(prev → goal)`。上辺ゴールで下から入るときは従来どおり `goal` の上側外。

---

## Grade 2 / 3：パッド直交方向が逆向きの場合の正規化

90° 回転後の候補経路について、**直交パッド辺**の向きを次のように定義する（いずれも **画面 `Dir`**、実装では `unitOrthoDirBetween`）。

- **`dStart`**：`startPad → start`（スタートマスへ入る向き）。Grade 2/3 では常に `startPad = (start.c, start.r + 1)` なので、整合した候補では基本 **`DIR.U`**（下から上へ入る）。
- **`dGoal`**：`goalPad → goal`（ゴールマスへ入る向き）。折れ **4**／Grade **3** では `goalPad` が最終直線延長上にある。折れ **6** では `goalPad` が常に真上なので、`unitOrthoDirBetween(goalPad, goal)` は **グリッドで下方向**（`goal.r > goalPad.r`）＝画面 **`DIR.D`** に一致する。

直交のため、`goal → goalPad`（ゴールから盤外パッドへ出る向き）は常に **`dGoal` の逆**（`-dGoal`）である。

### いつ補正するか

- **`padsOpposite`**: `dStart` と `dGoal` が**互いに逆向き**（`dStart === negate(dGoal)`）である。
- **`canonicalEnds`**: **`start` が最下段**（`start.r === height - 1`）かつ **`goal` が最上段**（`goal.r === 0`）である「典型」端配置。

`padsOpposite` が成り立ち、かつ `canonicalEnds` でないとき、**経路ポリラインと盤面を変形**してパッドと経路第 1 歩の整合を取る（`normalizeGrade2OppositePadPolyline`）。`padsOpposite` が false、またはすでに典型端なら **何もしない**。

### 補正の内容

1. **縦鏡映（水平軸）**  
   経路上の一部区間を、ある行 `r = pivotR` を軸とした鏡映 `r' = 2·pivotR - r` で置き換える。鏡映後も**直交隣接の折れ線**であり、**全マスが `pathable` 内**であること、第 1 歩が **`DIR.U`**、`startPad→start` が **`DIR.U`**、`goalPad` が**厳密に盤外**であること（`validateGrade2RotatedPorts`）を満たす必要がある。

2. **分岐（どちらのサブ経路を映すか）**  
   - **最後の直角折れ点**が経路上で**一度しか通らない**とき：その折れ点から **ゴールまで**のサブ経路を映す。採用時、デバッグ用ラベル **`goal->upside down`** を付けうる。  
   - 上記が再訪折れ点などで使えないとき：**最初の直角折れ点**から **スタートまで**のサブ経路を映し、その後 **経路の向きを反転**（`start` と `goal` を入れ替える）する。採用時、ラベル **`start->upside down`** を付けうる。

3. **ピボット**  
   単一の鏡映軸では改善できない場合があるため、**複数の `pivotR` 候補**を試す（折れ点行・端点行の中点周りなど）。

4. **ゴール上側パッド**  
   補正後の経路では、**`goalPad` が `goal` よりグリッド上で上**（`goalPad.r < goal.r`：画面上でゴールの真上隣接）になる候補だけ採用する。

5. **斜めバンパー 1 セルの正解入替**  
   鏡映で幾何が変わる**ちょうど 1 セル**について、正解の `SLASH` / `BACKSLASH` を**入れ替え**る（`swapSlashKey`）。表示のずらしとは別で、**正解経路としての反射**を新しい折れ幾何に合わせるための処理である。

6. **失敗時**  
   どのピボットでも条件を満たせない場合は **`retry`** とし、その 90° 回転候補は捨てて別の回転・別の乱択を試す。

### Grade 3 との関係

Grade 3 でも経路決定後は **`pickGrade2OrientedStage`** を通すため、**同一の正規化**が適用される（再訪 1 マスなど、経路の形によっては `goal->upside down` / `start->upside down` のどちらかが選ばれうる）。

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
- **経路**: `start` / `goal` の選び方は Grade 1 と同型。折れ数は **4 または 6**（生成時に 50% の確率でどちらかを採用）。折れ **4** のときのみ、`start` と `goal` の**列差・行差が両方非零**であること（どちらかの軸上に一直線のみの経路を除外）。
- **直交マス**: 折れ **4** のときのみ、経路上に「十」字交差セルが存在すること（`pathHasOrthogonalCrossCell`）。折れ **6** ではこの条件は課さない。
- **再訪**: 折れ **4** では、折れマス以外で同じマスを二度通らない（`grade2BendNoRevisit`）。ポータル用の仮想折れは **使わない**（内角折れ集合は `bendCellsInPath` のみ）。折れ **6** では経路全体で**いかなるマスも一度だけ**通る（`grade1NoRevisit`）。そのため折れセルも含め再訪は一切ない（上記 `grade2BendNoRevisit` も向き調整後に検証されるが、折れ 6 で重複なしなら自動的に整合する）。
- **向きと回転**: 経路決定後、**盤面と経路を 90° 単位で回転**し採用向きを選ぶ。折れ **4** は `pickGrade2OrientedStage` で **第 1 歩が必ず `DIR.U`** の回転だけを採用。折れ **6** は `pickGrade2Bend6OrientedStage` で **`DIR.U` に限定しない**（`start` で直交折れ＋バンパーを許容するため）。いずれも複数候補があれば乱択。
- **パッド**: `startPad` / `goalPad` は用語節の Grade 2 定義に従う。**`startPad→start` と `goalPad→goal` が直交で互いに逆向き**であり、かつ**典型端**（`start` が最下段・`goal` が最上段）でないときの鏡映・経路反転・`swapSlashKey` 等は、上記セクション「**Grade 2 / 3：パッド直交方向が逆向きの場合の正規化**」に従う。
- **バンパー**: 折れ **4** のみ **盤内の直角折れセルのみ**（`placeDiagonalBumpersInterior`）。**`start` / `goal` には置かない**。バンパー個数は **折れ数と常に一致**（4 折れなら **4** 個）。折れ **6** ではこの「端点に置かない」制約を**課さず**、`goalPad` 真上固定のもと `placeDiagonalBumpers(path, startPad, goalPad)` により **入口／出口で直交折れがあるときは `start` / `goal` にも斜めバンパーを置いてよい**。正解個数は **`totalDiagonalTurnCount`＝内角の数（`countRightAngles`）＋（入口直交折れがあれば 1）＋（出口直交折れがあれば 1）**。`countRightAngles` は **6〜8** を許容し、**7 や 8 でも棄却しない**（下記「折れ 6 の生成手順」）。

#### Grade 2・折れ 6 の生成手順（フック＋尾 DFS／実装対応）

折れ **6** が選ばれた試行では、折れ **4** と次の差分で盤を確定する。経路探索は **6 折れ専用の高速ルート**（`tryGrade2Bend6Path`）とし、**フック形状**: スタート（またはゴール）側で横 `ds` マス進んで 1 マス上がり、残りを尾で辿る。

1. **端点**: `start` は `bottomCandidates`、`goal` は `topCandidates` からそれぞれ乱択。候補の取り方は折れ 4 と同じ（最下／最上段かつ一つ内側行も pathable のマスのみ）。
2. **フック案 A/B**: **A**: 「`start` で折れる」、**B**: 「`goal` で折れる」。試行ごとに **50%** でどちらかを選ぶ（折れ 4 の 50% 分岐の後段で折れ **6** のときに実行）。
3. **横ズレ `ds`**: 符号付き・非ゼロの整数をランダムに取る。絶対値は盤幅に収まる範囲（実装では概ね 1〜4）。  
   - **A**: `S1 = (start.c + ds, start.r)`。`S2` は `S1` の**真上** 1 マス `(S1.c, S1.r - 1)`。  
   - **B**: **`G1 = (goal.c + ds, goal.r)`**、**`G2 = (G1.c, G1.r + 1)`**（`G1` の直下 1 マス）。
4. **3–5. 正式経路の離散化（1 マスずつ）**  
   **`solutionPath` は隣接マス同士のみをつなぐ折れ線**とする（各辺はグリッド上ちょうど **1 歩**）。  
   - **A**: `start → S1 → S2 → … → goal` のうち、`start` から `S1` までは **同一行で水平に 1 マスずつ**進み、**`start` と `S1` の間のすべてのマス**を経路列に含める（`|ds| > 1` でも飛び石にしない）。  
   - **B**: `goal` から `G1` まで **同様に 1 マスずつ**水平に列挙してから `G1 → G2` とし、尾を DFS で張り、反転して `start … goal` とする。  
5. **仮定メモ（斜めの想像）**: `ds > 0` なら `start` に `BACKSLASH`、`ds < 0` なら `SLASH` を仮定し `S1` には逆種を仮定する（実バンパーは `placeDiagonalBumpers`）。試行ごとに目標折れ数 **6・7・8** を乱択し、**上記 1 歩区間で数えた**フック部の折れを差し引いた残りで尾の DFS を行う。
6. **尾のゴール付近と `goalPad`**: 正式な芯経路は **`start → … → S1 → S2 → … → Q → goal`**（または **B** の反転後の同型）。**`goalPad` は始終 `(goal.c, goal.r - 1)`**。**`placeGrade2Bend6Bumpers` → `placeDiagonalBumpers(path, startPad, goalPad)`** でバンパーを決める。
7. **検証**: **隣接ステップの連続性**、`countRightAngles` が **6〜8**、`grade1NoRevisit`（全マス一意訪問）。十型交差セル条件は課さない。
8. **向き・パッド・バンパー**: `pickGrade2Bend6OrientedStage` で 90° 回転・**折れ 6 専用の** `normalizeGrade2OppositePadPolyline`（`goalPad` を真上固定で解釈）・`swapSlashKey` を適用。正解バンパーは **`placeGrade2Bend6Bumpers` → `placeDiagonalBumpers(path, startPad, goalPad)`**。経路の第 1 歩は **`DIR.U` 限定としない**。採用条件は **`bumpers.size === totalDiagonalTurnCount(path, startPad, goalPad)`** かつ **`goalPad` が厳密に盤外**。
9. **全体リトライ**: `tryGrade2Bend6Path` が失敗した試行は捨て、端点の再抽選などを含め `generatePolylineStage` の Grade 2 試行上限（**1200**）まで繰り返す（折れ **6** では `tryOrthogonalPolyline` は呼ばない）。

### Grade 3

- **盤面**: 6×7 矩形（全体 `pathable`）。
- **経路**: **折れ数 6** の直交経路で、**ちょうど 1 マス（再訪折れ点）だけが 2 回通る**。そのマスでは **1 回目も 2 回目も 90° 折れ**（直進通過はしない）。
- **再訪の入射方向**: 2 回目の入射方向は、**1 回目の入射方向の逆向き**、または **1 回目の反射（出射）方向と同じ**のいずれか。例: 再訪マスが `SLASH` で 1 回目が `DIR.U` 進入のとき反射は `DIR.R` なので、2 回目の進入は `DIR.D`（`U` の逆向き）または `DIR.R`。**再訪マスの上下左右 4 隣接マスは、4 本の辺としてそれぞれ 1 度ずつ**使われる（前後の経路セルが 4 点とも異なる）。
- **生成**: 端点は下辺寄り・上辺寄り候補から乱択したうえで、制約を満たす経路を探索（DFS）。**経路決定後**、Grade 2 と同様に **90° 単位で盤と経路を回転**し、**第 1 歩が `DIR.U`** かつ **`startPad→start` が `DIR.U`** になる向きを採用（**`goalPad→goal` と逆向きの整合**が必要な場合の正規化は、上記「**パッド直交方向が逆向きの場合の正規化**」と同じ `pickGrade2OrientedStage` 経路）。
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

Grade 2 の主要条件（`startPad→start` が `DIR.U`、折れ **4** では `goalPad` が最終進行延長上の盤外・第 1 歩 `DIR.U`・バンパー数＝折れ数・`start`/`goal` にバンパーなし、折れ **6〜8** では `goalPad = (goal.c, goal.r - 1)` が盤外・バンパー数＝`totalDiagonalTurnCount`・端点にバンパー可）をまとめて試す場合:

```bash
npx esbuild scripts/run-reflec-shot-grade2-check.mts --bundle --platform=node --format=cjs --outfile=scripts/tmp-reflec-g2.cjs && node scripts/tmp-reflec-g2.cjs && del scripts\\tmp-reflec-g2.cjs
```

（Windows 以外では生成ファイルの削除コマンドを読み替え。）
