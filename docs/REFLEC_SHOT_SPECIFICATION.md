# Reflec-Shot 仕様書（盤外パッド・経路端点）

本ドキュメントは **Reflec-Shot** における、盤面内外の役割マスと**グレード別の生成ルール**をまとめる。  
実装の参照先: `src/app/lab/reflec-shot/gridTypes.ts`, `gridStageGen.ts`, `ReflecShotGame.tsx`。

---

## 盤面生成レベル（Lv.1〜4）

アルゴリズム単位の呼称。いずれも `gridStageGen.ts` 内の生成関数に対応する。

| レベル | 内容（旧呼称） |
|--------|----------------|
| **Lv.1** | 矩形盤・下／上端候補から端点・折れ数 1〜4 乱択・`tryOrthogonalPolyline`・`placeDiagonalBumpers`（旧 **Grade 1** 生成） |
| **Lv.2** | 5×5・折れ **4** 固定・十型交差・`pickGrade2OrientedStage`（旧 **Grade 2・折れ4**） |
| **Lv.3** | 5×5・折れ **6〜8**・`tryGrade2Bend6Path`（フック＋尾）・`pickGrade2Bend6OrientedStage`（旧 **Grade 2・折れ6**） |
| **Lv.4** | 6×6・折れ 6・1 マス再訪・`pickGrade2OrientedStage`（`relaxBendVisit`）（旧 **Grade 3** 生成） |

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
- **Grade 1 / 2（Lv.1）**: 盤面の **下辺外**（`start` の真下：`startPad = (start.c, start.r + 1)`）。
- **Grade 3〜5（Lv.2〜4 適用後）**: 盤を回転させた後も **`start` の真下**（`startPad = (start.c, start.r + 1)`）。整合した候補では **`startPad → start` は画面**上**向き**（**`DIR.U`**）。

### start / goal

- **`start`**: 生成経路の**始端**（盤内 `pathable`）。**`goal`**: **終端**（盤内）。
- Lv.1 では `bottomCandidates` / `topCandidates` から端点を選ぶ。Lv.2〜4 も同型の候補取り（盤サイズに依存）。

### goalPad

- **射出体が到達するとクリア判定**するマス。
- **Grade 1 / 2（Lv.1）**: **`goal` の真上**（`goalPad = (goal.c, goal.r - 1)`）。
- **Grade 4（Lv.3・折れ6）**: **`goal` の真上 1 マスに固定**（`goalPad = (goal.c, goal.r - 1)`）。`placeDiagonalBumpers` はこのパッドと **`goalPad → goal`** を前提にゴール周りの斜めバンパーを決める。
- **Grade 3 / 5（Lv.2・Lv.4）**: **`goal` に向かう最後の直線の進行方向に、`goal` と直交隣接する盤外 1 マス**（`prev` を経路上のゴール直前とし `goalPad = goal + unitDir(prev → goal)`）。

---

## Grade 3〜5：パッド直交方向が逆向きの場合の正規化

（旧仕様の「Grade 2 / 3」節と同じロジック。経路決定後に **`pickGrade2OrientedStage`** または **`pickGrade2Bend6OrientedStage`** を通すグレードに対して適用される。）

90° 回転後の候補経路について、**直交パッド辺**の向きを次のように定義する（いずれも **画面 `Dir`**、実装では `unitOrthoDirBetween`）。

- **`dStart`**：`startPad → start`。Grade 3〜5 の整合候補では基本 **`DIR.U`**。
- **`dGoal`**：`goalPad → goal`。Lv.3（Grade 4）では真上固定のため **`DIR.D`** に一致。Lv.2 / Lv.4 では最終直線延長上の盤外。

**`padsOpposite`**（`dStart` と `dGoal` が逆向き）かつ **典型端でない**とき、`normalizeGrade2OppositePadPolyline` により鏡映・経路反転・`swapSlashKey` 等を試す。失敗時は `retry`。詳細は従来どおり（縦鏡映ピボット、`goal->upside down` / `start->upside down` ラベル等）。

### `goal->upside down` 時の start 延長（経路がスタートより「下」に潜る場合）

`grade2PadAdjustLabel === "goal->upside down"` が付いた盤だけ、次を実行する（実装: `gridStageGen.ts` の `maybeExtendStartForGoalUpsideDown`）。

1. **点 B**：正規化後の経路 `Path_0` 上で **行 `r` が最大**のマス（画面上最も下。同率は先に現れる順で代表点）。
2. **`y_b = B.r - start.r`**。`y_b <= 0` なら何もしない。
3. **`y_b > 0` のとき**  
   - 延長前の `start` を **S0** とする。  
   - `start` と `startPad` の **グリッド行 `r` をそれぞれ `y_b` だけ増やす**（画面下方向。`startPad = (start.c, start.r + 1)` の関係を保つ）。  
   - 新 `start` から **S0** へ、`c = S0.c` 固定で **1 マスずつ `r` を減じる**直列を **Path\_S** とする（セル列は `r = S0.r + y_b, S0.r + y_b - 1, …, S0.r`）。  
   - **Path\_S のうち S0 以外**の各マスが、元の `Path_0` のいずれかのセルと一致（再訪）する場合は **この生成試行を破棄**しリトライする。開発者がデバッグモードをオンにしているとき、Worker 側で `console` に棄却理由を出す。  
   - それ以外は **最終経路 = Path\_S と Path\_0 を連結**（`Path_S` の終端と `Path_0` の始端はともに S0 のため、`Path_S.concat(Path_0.slice(1))` で S0 を二重にしない）。  
   - 延長後にグレードごとのバンパー整合（折れ6は `placeGrade2Bend6Bumpers` と `totalDiagonalTurnCount` 等）を **再検証**する。  
4. 延長が実際に行われた盤は **`GridStage.reflecSourceStartExtended`** を立て、デバッグパネルの **Source** 行末に **`start extended`**（黄色）を付ける。

### Grade 5（Lv.4）との関係

Grade 5 でも経路決定後は **`pickGrade2OrientedStage`**（`relaxBendVisit: true`）を通すため、**上記正規化**が適用される（再訪 1 マスなど経路の形によっては `goal->upside down` / `start->upside down` が選ばれうる）。

---

## グレード別・盤面生成ルール

実装は **`generateGridStage`**（内部で Lv.1〜4 を呼び分け）を参照。

| プレイ Grade | 盤面サイズ | 用いる生成レベル | 採用条件の要約 |
|--------------|------------|------------------|----------------|
| **1** | 4×4 | **Lv.1** | `placeDiagonalBumpers` 後の **バンパー本数がちょうど 2**。満たすまでリトライ |
| **2** | 4×4 | **Lv.1** | 同 **Lv.1** だが **バンパー本数 ≥ 4**。満たすまでリトライ |
| **3** | 5×5 | **Lv.2** | 旧 Grade2・**折れ4** と同じ制約（十型交差・内点バンパーのみ 等） |
| **4** | 5×5 | **Lv.3** | 旧 Grade2・**折れ6〜8**（`tryGrade2Bend6Path` 等）。開発 UI では全体目標折れ 6/7/8 を固定可能 |
| **5** | 6×6 | **Lv.4** | 旧 Grade3・**再訪1マス**・折れ6 |

### Grade 1 / 2（Lv.1）の補足

- 経路は **折れ数 1〜4** を乱択し、直角数・**同一マス再訪なし**（`grade1NoRevisit`）を満たすもののみ進む。
- **Grade 1** では従来の「バンパー 5 本以上で棄却」は使わず、**ちょうど 2 本**で採否する。
- **Grade 2** は **4 本以上**で採否（上限は Lv.1 の幾何の範囲内に任せる）。

### Grade 3（Lv.2）

- **盤面**: 5×5 全域 `pathable`。
- **経路**: 折れ **4** 固定。**列差・行差が両方非零**。**十型交差セル**（`pathHasOrthogonalCrossCell`）。再訪ルールは旧 Grade2 折れ4（`grade2BendNoRevisit` 向き調整後）。
- **バンパー**: **盤内直角折れのみ**（`placeDiagonalBumpersInterior`）。`start` / `goal` には置かない。本数は折れ数と一致（4）。

### Grade 4（Lv.3）

- **盤面**: 5×5。
- **経路・バンパー**: 旧 **Grade2・折れ6** 節の「フック＋尾 DFS」「`goalPad` 真上固定」「`countRightAngles` 6〜8」「`totalDiagonalTurnCount` とバンパー数一致」等と同一。実装詳細は `tryGrade2Bend6Path` / `pickGrade2Bend6OrientedStage` を参照。

### Grade 5（Lv.4）

- **盤面**: 6×6 全域 `pathable`。
- **経路**: **折れ数 6**・**ちょうど 1 マスが 2 回通る**（両回 90° 折れ）。再訪の入射・出射ルールは旧 Grade3 と同じ。
- **バンパー**: 盤内の直角折れ（再訪セルは 1 セルで両ターンに整合）。**バンパーが置かれるマス数は 5**。

---

## 経路のイメージ

盤面上の「線」としての経路は **`start`〜`goal`**。プレイヤー操作・シミュレーションでは **`startPad` から入り、`goalPad` でクリア**までを一連の動きとして扱う。

---

## 盤面の描画（キャンバス）

実装は `ReflecShotGame.tsx` のキャンバス描画と `gridTypes.ts` の **`stageRowRange`**。

- **列**: 各グリッド行について **`c = 0`〜`width - 1`** のマスを描画する。
- **行（縦方向のビューポート）**: `startPad`・`goalPad`・`start`・`goal`・`solutionPath` の行の最小・最大で `rMin`〜`rMax` を決める。
- **パッド**: 盤外座標も上記範囲に含めてレイアウトする。
- Void（`pathable` が false のマス）は従来どおり穴として描画（本仕様の Lv.1〜4 デフォルトは矩形全域 true）。

---

## 検証スクリプト（Grade 3 / 4・Lv.2 / Lv.3）

Grade 3（折れ4）・Grade 4（折れ6）の主要条件をまとめて試す場合:

```bash
npx --yes tsx scripts/run-reflec-shot-grade2-check.mts
```

（旧バンドル手順から `tsx` 直実行に簡略化可能。）
