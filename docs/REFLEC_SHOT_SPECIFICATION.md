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
| **Lv.4** | 5×5・折れ 6・1 マス再訪（旧 **Grade 3** 生成。プレイ **Grade 5**）。**Default / R-First** は経路後に `pickGrade2OrientedStage`（`relaxBendVisit`）。**R-Second** は向き付けを経路先頭に織り込み終了時は同関数を**経由しない**（下記 Grade 5・`rSecond`） |

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
- **Grade 3 / 5（Lv.2・Lv.4）**（一般）: **`goal` に向かう最後の直線の進行方向に、`goal` と直交隣接する盤外 1 マス**（`prev` を経路上のゴール直前とし `goalPad = goal + sign(goal - prev)`（グリッド差分の直交 1 歩））。
- **Grade 5・Lv.4 の追加ルール**（`enforceLv4GoalPadRules`、本番 Grade 5 の `rSecond` / `default` / `rFirst` すべて）  
  - **`goalPad` を盤面の最下行の真下に置かない**（`goalPad.r < height`。`r = height` のマスは盤外だが、本ルールではその「下側」パッドを禁止する）。  
  - **`goal` が左端**（`c = 0`）のとき、経路上の入射方向（`prev → goal` の **`unitStepDir` / 画面 `Dir`**）は **`L`（右から左）** に限る。  
  - **`goal` が右端**（`c = width - 1`）のとき、入射は **`R`** に限る。  
  - パッド正規化後に上記を満たさないうえ、入射が **`D`**（上から下）かつ末尾が「横 1 セグメント＋縦に goal」という **L 字**である場合、**最後の折れの順序を「縦→横」に入れ替えた**経路を 1 回試し、再度 `normalizeGrade2OppositePadPolyline` して採否する（`gridStageGen.ts` の `lv4TryFlipLastHVToVHTail`）。

---

## Grade 3〜5：パッド直交方向が逆向きの場合の正規化

（旧仕様の「Grade 2 / 3」節と同じロジック。経路決定後に **`pickGrade2OrientedStage`** または **`pickGrade2Bend6OrientedStage`** を通すグレードに対して適用される。）

90° 回転後の候補経路について、**直交パッド辺**の向きを次のように定義する（いずれも **画面 `Dir`**、実装では `unitOrthoDirBetween`）。

- **`dStart`**：`startPad → start`。Grade 3〜5 の整合候補では基本 **`DIR.U`**。
- **`dGoal`**：`goalPad → goal`。Lv.3（Grade 4）では真上固定のため **`DIR.D`** に一致。Lv.2 / Lv.4 では最終直線延長上の盤外。

**`padsOpposite`**（`dStart` と `dGoal` が逆向き）かつ **典型端でない**とき、`normalizeGrade2OppositePadPolyline` により鏡映・経路反転を試す。失敗時は `retry`。詳細は従来どおり（縦鏡映ピボット、`goal->upside down` / `start->upside down` ラベル等）。鏡映後の斜めバンパーは **`placeDiagonalBumpers` / `placeDiagonalBumpersInterior`** による幾何決定のみとし、**`solution` は常に `applyBumper`（画面座標の `/`・`\` 定義）と解経路で両立する**。

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

- **Default / R-First**（`lv4GenMode` が `default` / `rFirst`）: 経路決定後に **`pickGrade2OrientedStage`**（`relaxBendVisit: true`）を通すため、**上記正規化**が適用される（再訪 1 マスなどによっては `goal->upside down` / `start->upside down` が選ばれうる）。
- **R-Second**（`rSecond`）: **ゴールを最上／左右辺に置く出口脚を張る前に**、盤と RS0〜RS1 接頭辞に **90° 回転を適用**し、`start` が下から上向き入射（初手 `DIR.U`）になるフレームを選ぶ。その **射像上の oddG**（仕様上 **出口腕先 `S2` を回転で写したセル `S2'`**）から、**折れ `b2`** に従い **上辺・左端・右端**（**最終盤面**上の `r=0` / `c=0` / `c=w-1`）へ seg2 を接続し、`finalizeGrade2OrientedAfterRotation` でパッド正規化・バンパーを確定する。**二重の全体回転（経路完成後の `pickGrade2OrientedStage`）は行わない**。正規化後も **`goal` は上／左／右辺のいずれか**になるよう実装で棄却する。

---

## グレード別・盤面生成ルール

実装は **`generateGridStage`**（内部で Lv.1〜4 を呼び分け）を参照。

| プレイ Grade | 盤面サイズ | 用いる生成レベル | 採用条件の要約 |
|--------------|------------|------------------|----------------|
| **1** | 4×4 | **Lv.1** | `placeDiagonalBumpers` 後の **バンパー本数がちょうど 2**。満たすまでリトライ |
| **2** | 4×4 | **Lv.1** | 同 **Lv.1** だが **バンパー本数 ≥ 4**。満たすまでリトライ |
| **3** | 5×5 | **Lv.2** | 旧 Grade2・**折れ4** と同じ制約（十型交差・内点バンパーのみ 等） |
| **4** | 5×5 | **Lv.3** | 旧 Grade2・**折れ6〜8**（`tryGrade2Bend6Path` 等）。開発 UI では全体目標折れ 6/7/8 を固定可能 |
| **5** | 5×5 | **Lv.4** | 旧 Grade3・**再訪1マス**・折れ6（盤は Grade3/4 と同寸） |
| **6** | 6×6 | **Grade6 専用** | 折れ **7〜9**・`pickGrade2OrientedStage`（`relaxBendVisit`・`enforceLv4GoalPadRules`・`requireGoalOnTopLeftRight`・`requireStartPadBelowBoard`）・**再訪折れ 1 マス**（`gradeG6RevisitBendOnlyCellKey`）・**再訪十字なし** |
| **7** | 7×7 | **Grade7 専用** | 折れ **8〜11**・上記オプションと同型・**dual 再訪**（再訪十字 1+・再訪折れ 1、`grade6DualRevisitBendCellKey`） |

### Grade 6（6×6）

- **盤面**: 6×6 全域 `pathable`（現状は矩形のみ）。
- **経路**: `tryRandomHighGradeSolutionPath`（mode `g6`）で下辺始点・上辺終点の貪欲ウォーク。訪問は **高々 1 マスが 2 回**（それ以外は各 1 回）。成功候補は `prependVerticalSoStartOnBottomRow` 後、`gradeG6RevisitBendOnlyCellKey` が非 null（再訪十字セル数 0・再訪折れ 1）。
- **閉路形状**: 再訪折れマス 1〜2 出現の閉路区間について、折れ点境界どうしの添字差が 1（1 辺しかない区間）の個数を `revisitLoopUnitLegCount` で数える。候補を多めに集めたうえで **同指標の昇順・ループ span（`grade6RevisitBendLoopSpanSteps`）降順**で上位に絞り、`g6PickRawPathByLoopSpan` で 1 本を選ぶ（Grade5 の閉路のばらつきに寄せる）。ウォークは detour 乱択を抑え、ゴール寄りバイアスをやや強める。
- **折れ数**: `countRightAngles` で **7〜9**（向き付け後の `solutionPath` で再検証）。
- **goal / goalPad**: `requireGoalOnTopLeftRight: true` により **ゴールは上辺・左端・右端のいずれか**（`rSecondGoalOnTopLeftOrRightEdge`）。`enforceLv4GoalPadRules` により Lv.4 と同系のパッド制約。
- **バンパー**: `placeDiagonalBumpersInterior`（`relaxBendVisit: true`）。
- **宝石目標**: `computeRequiredGemCountForStage` で **折れ数 + 3×再訪折れ（両面ヒット）**（再訪十字項は含めない）。

### Grade 7（7×7）

- **盤面**: 7×7 全域 `pathable`。
- **経路**: `tryRandomHighGradeSolutionPath`（mode `g7`）。訪問は **ちょうど 2 マスが各 2 回**（dual）。`prependVerticalSoStartOnBottomRow` 後、`gradeG7DualRevisitSolutionPath`（実装名は `grade6DualRevisitBendCellKey` 非 null）を満たす。
- **閉路形状**: 再訪**折れ**マスに対する `revisitLoopUnitLegCount` と Grade6 と同型の候補絞り込み・`g6PickRawPathByLoopSpan`。G7 は dual 幾何のため Grade5 と同一分布にはなりにくいが、単位辺区間の過多を抑える方向でウォークパラメータを G6 よりさらにゴール寄りにする。
- **折れ数**: **8〜11**。
- **goal / goalPad**: Grade6 と同様 **`requireGoalOnTopLeftRight`** ほか。
- **再訪十字**: 1 以上（`revisitCrossCellKeysFromPath`）。
- **宝石目標**: **折れ数 + 再訪十字数 + 3×再訪折れ（両面ヒット）**（旧 Grade6 dual 式と同型）。

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

- **盤面**: **5×5** 全域 `pathable`（Grade3・4 と同一サイズ）。
- **経路**: **折れ数 6**・**ちょうど 1 マスが 2 回通る**（両回 90° 折れ）。再訪の入射・出射ルールは旧 Grade3 と同じ。実装は `findGrade3SixBendPath`（`tryConstructGrade3Path`）＋ `pickGrade2OrientedStage(..., relaxBendVisit: true)`。
- **ゴール／goalPad**: `finalizeGrade2OrientedAfterRotation` に **`enforceLv4GoalPadRules: true`** を渡す。**`goalPad` を最下行の真下にしない**・**左右端 goal では入射を L / R に限定**・**D 入射 L 字末尾は折れ順反転を 1 回試行**。上記 `goalPad` 節を参照。
- **バンパー**: 盤内の直角折れ（再訪セルは 1 セルで両ターンに整合）。**バンパーが置かれるマス数は 5**。
- **生成まわり**: 再訪＋6 直角の整合を 5×5 に収めるのは 6×6 より難易度が高い。実装では `tryConstructGrade3Path` の再訪点サンプルを盤が 5×5 のときやや厚くし、`generateBoardLv4Stage` の試行・`fallbackGridStage(5)` のシード走査を長めに取る。よって **単一 `seed` では `generateGridStage(5, …)` が `null` になりうる**が、`generateGridStageWithFallback` では別シードで再試行される。

#### 生成モード（開発 UI・`ReflectShotPolylineGenOpts.lv4GenMode`）

| 値 | 経路の作り方（要約） |
|----|----------------------|
| **`default`** | `tryConstructGrade3Path`（ゴールは `topCandidates`、スタートは `bottomCandidates` を乱択）＋`pickGrade2OrientedStage`。**Grade 5 の生成既定では使わず**（未指定オプションは **`rSecond`** 扱い） |
| **`rFirst`** | **再訪折れ点 `R` を先に**内側マスから乱択し、1 回目の入射・出射・2 回目の入射・出射（斜めバンパー 1 種に整合する直交ターン）を決めたうえで、`start→P1`・`S1→P2`・`S2→goal` の **3 区間**を `tryOrthogonalPolyline` で接合する（各区間の直角折れ数の和は 4・全体で 6）。折れ配分 `(b0,b1,b2)` は **区間ごとの最大折れが小さい順**を優先してシャッフルし、Default より試行の偏りを抑えつつ早期成功を狙う。**現状の実装スコープは N=1**（再訪折れ点は 1 マスのみ）。 |
| **`rSecond`** | **R-Second（RS2）**。`(b0,b1,b2)`（`b1` は RS2-1 幾何で制限）の **`b1` は中脚の折れ本数の合計**（`R→S1` と `S1→中脚先`、`手前→P2` と `P2→R` の直交関節を含む）。**`b2` は出口脚の合計**（`R→S2` の関節を含む）。**中脚 S1〜P2** は開区間折れ `b1Open=max(0,b1-2)`（短）と **`min(b1, b1Open+1)`**（長・短より 1 本多い開区間折れ）の **両方**を `tryOrthogonalPolylineRFirst` で探索する（長に `b1` をそのまま渡すと R 周り関節と二重計上され、全体直角 6 と整合しにくい）。それぞれについて **`R→S1` で関節折れあり／なし**と **`P2→R` で関節折れあり／なし**の **3 通り**（両方折れ・S1 のみ・P2 のみ）を、`forcedSecond` 候補を **直交歩／直進歩**に分けて順序付けし、経路形状でフィルタして **明示的に列挙**する（「`b1Open` ＝常に S1・P2 両方が頂点」という前提は置かない）。**試行順は単端折れ（S1 のみ／P2 のみ）を先に**（この 2 つは乱数で前後を入れ替え）、**両端折れは最後**とし、容易パターンが先に成功して再訪ループの幾何が偏るのを避ける。**再訪点 R を中間で踏まない**候補に限る。**`b1≥3` かつ短・長両立のときは長→短の順**に出口接続まで試し、長で詰まったら短へフォールバックする；それ以外で両立のときは乱数（長をやや優先）。長め側は **複数回**乱択する。有効な **`(b0,b1,b2)`** は **b1 の大きい帯からラウンドロビン**（帯内シャッフル）で試す。**2 回目入射 `dIn2` の 2 候補**は、RS2-1 で許される **最大 `b1` が大きい方をやや先**に試す。S2〜goal は **`max(0,b2-1)`** を `tryOrthogonalPolylineRFirst` に渡す。RS0〜RS1 を接合した **接頭辞**を得たあと、**先に**その接頭辞と盤に **0〜3 回の 90° CCW** を試し、**最終盤面**でスタートが下から上向き射出となる向き（接頭辞の初手が `DIR.U`）に固定する。続けて **oddG**＝**射像 `S2'`** から、**`b2`** に従い **上辺・左端・右端**（その座標系での `r=0` / `c=0` / `c=w-1`）へ seg2 をポリライン接合する（事前に `goal` を乱択しない）。接頭辞＋seg2 に対し **`finalizeGrade2OrientedAfterRotation`**（パッド正規化・`placeDiagonalBumpersInterior`）でステージを確定し、**正規化後の `goal` も上／左／右辺に無い候補は棄却**。**経路完成後の `pickGrade2OrientedStage` は呼ばない**。**出口探索中**の **ハード違反**（重複・直角頂点再踏み等）は、**長→短の別中脚**が残っていればそちらへ進み、最後の中脚でも解消しないとき **`outerR` 先頭へ戻る**。**N=1**。 |

**RF4-1（最下行の `R`）**: `R` が最下行（`r === height - 1`）にあるときは、1 回目の入射を **盤外真下**（画面では `startPad → R` が `DIR.U`）に限定する。経路配列上の先頭セルは `R` であり、その直前のマス `P1` は盤外になる。検証は `grade3RevisitOneCellRule(path, { implicitBeforeFirstR: P1 })` で行う。

**RF2（N≥2 向け・将来）**: 複数の `R_ret` を最外周の同一辺に寄せすぎない等の制約は、**N=1 の実装では未適用**（常に 1 点のみ）。

**RF3〜RF8（N=1 での解釈）**: 接続順は上記 3 区間の **幾何上の依存**（`start→P1`、`R` 直後 `S1→P2`、`R` 直後 `S2→goal`）に固定される。区間内の折れはグレードの「合計 6 直角・再訪 1」に含まれる。N>1 時の隣接マス逐次接続・斜めバンパー幾何の段階固定・RF7 のバックトラックは **未実装**（将来 `tryConstructGrade3PathRFirst` 系に拡張する想定）。

**デバッグ UI**: `?devtj=true` かつデバッグ ON・**Grade 5 以上**のとき、パネルに **Default / R-First / R-Second** を切り替える。**R-First** または **Default** 選択中はストックと生成モードが一致しないためストックをスキップする（**R-Second** 本番既定とストックは一致）。

---

## ステージ識別子 `rs2` と生成オプション（再現性の注意）

**`rs2.{grade}.{hex}` に含まれる情報**は、実装上 **`grade`（プレイ Grade 1〜7）と 32-bit `seed`（hex）**のみである。  
Worker へ渡しうる **任意の生成オプション**（以下）は **ハッシュにエンコードされない**。

| オプション | 主な効き先 | UI / 条件の例 |
|------------|------------|----------------|
| **`grade2Bend6TotalBends`** | Grade 4（Lv.3・折れ6）の `tryGrade2Bend6Path` 内 **`targetBends` 固定** | `?devtj=true` かつデバッグ ON のとき、`debugGrade2Bend6MidSlider + 4` として **6 / 7 / 8** を Worker に渡す |
| **`debugReflecShotConsole`** | `maybeExtendStartForGoalUpsideDown` 等の棄却理由を **`console`** に出すか | 同上デバッグ ON で `true` |
| **`lv4GenMode`** | Grade 5（Lv.4）で **`rFirst`** → `tryConstructGrade3PathRFirstN1`＋`pickGrade2OrientedStage`、**`rSecond`**（**未指定時の既定**）→ `tryConstructGrade3PathRSecondN1` 内で向き付け・出口・`finalizeGrade2OrientedAfterRotation` まで完結、**`default`** → 従来 `tryConstructGrade3Path` 系＋`pickGrade2OrientedStage` | 同上。本番 Grade 5 は **`rSecond` を明示送信**（ストックと整合） |

### 同じ `rs2` でも盤が変わりうる理由（ビット同一性の落とし穴）

1. **`grade2Bend6TotalBends` の有無で RNG がずれる**  
   未指定時は `tryGrade2Bend6Path` の各内側試行で `6 + floor(rng()*3)` として **折れ目標を乱択**するため **`rng()` の消費回数が変わる**。指定時はその乱択が省略され、**同じ `seed` でも乱数列の分岐が最初からずれ、別盤になる**。

2. **`generateGridStageWithFallback` のフォールバック**  
   初回 `generateGridStage(grade, seed, opts)` が `null` のとき、実装は **`seed` をずらした別シードで最大約 200 回**再試行する。ハッシュ上は「元の seed」しか分からないため、**フォールバックに入った盤は `rs2` だけからは一意に言えない**（成功した内部試行のシードは UI に必ずしも表示されない）。

3. **プリフェッチストックと「ユーザー生成」の違い**  
   ストック補充は **`grade2Bend6TotalBends` / `debugReflecShotConsole` / `lv4GenMode` なし**で Worker を呼ぶ。デバッグ Grade4 は **ストックをスキップしてフルオプション生成**する分岐があり、デバッグ Grade5 で **R-First** も同様にストックをスキップする。**見えている `seed` が同じでも呼び出しパスが違う**と結果が一致しないことがある。

### 厳密に同じ盤を言い切るときの条件（推奨）

- **同じ** `grade`・**同じ** `seed` に加え、**同じ** `ReflectShotPolylineGenOpts`（少なくとも Grade4 なら `grade2Bend6TotalBends` の有無・値と `debugReflecShotConsole`）で **`generateGridStage` または `generateGridStageWithFallback` を直接呼ぶ**。
- 将来、完全なビット再現が必要なら **オプションを含む新しい識別子**（別プレフィックスや Base64 ペイロード等）を定義するか、**`rs1`（盤スナップショット）**で共有する、のいずれかを検討する。

### ユーザー向け簡易ルール（仕様メモ）

- **`rs2` は「その Grade・そのシードで、通常オプションに近い生成」を指す**とみなすのが無難で、**開発者デバッグ（折れ固定・コンソール）ON の Grade4 では、同じ文字列でも一般プレイ時のストック盤とは一致しないことがある**旨を認識する。

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

G5 / G6 / G7 の再訪折れ閉路上の「1 辺区間」本数（`revisitLoopUnitLegCount`）の統計:

```bash
npx --yes tsx scripts/stats-revisit-loop-unit-legs.mts 30
```

（旧バンドル手順から `tsx` 直実行に簡略化可能。）
