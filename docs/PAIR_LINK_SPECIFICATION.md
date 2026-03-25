# ペアリンク（Pair Link）実装仕様書

本ドキュメントは、リポジトリ内に実装されている **ペアリンク**（ナンバーリンク型パズル）の挙動・盤面生成・スコア・出題フローを **コードに忠実に** 記述したものです。  
グレードごとの盤面採用条件の表と閾値の一覧は、別紙 **`docs/PAIR_LINK_GRADE_GENERATION_CONDITIONS.md`** を参照してください。

---

## 1. 概要

- **目的**: 同じ数字のマスを **正交する線** でつなぎ、盤面の **全マスをちょうど一度ずつ** 通るようにする。
- **主な実装場所**
  - クライアント UI・入力・モード切替: `src/app/games/pair-link/PairLinkGame.tsx`
  - 盤面生成（ブラウザ Web Worker）: `public/workers/board-worker.js`
  - クリア検証（サーバーアクション経由で同じロジック）: `src/lib/puzzle-engine/pair-link.ts` の `validatePaths`
  - グレード定義・ストック: `src/lib/pair-link-grade-constants.ts`, `src/hooks/usePuzzleStockByGrade.ts`
  - レガシーストック（サイズ×ペア数キー）: `src/hooks/usePuzzleStock.ts`
  - Edge-Swap スコアの既定パラメータ（TS 側で UI マージ用）: `src/lib/pair-link-edge-swap-score.ts`
  - 分析用 ABC スコア（クライアント計算）: `src/lib/pair-link-abc-score.ts`

---

## 2. データモデルと座標系

### 2.1 座標

- **`x`**: 列（column）インデックス、左から 0。
- **`y`**: 行（row）インデックス、上から 0。
- サーバー型 `Pair` の `start` / `end` は **`[row, col]` = `[y, x]`** の順（`pair-link.ts` および Worker の `pairs` と一致）。
- `numbers` の各セルは `{ x, y, val, color }`（表示用。`val` がペア ID）。

### 2.2 `pairs`

```ts
{ id: number; start: [number, number]; end: [number, number] }
```

- `id` は 1 始まりのペア番号。盤面上の数字としても使われる。

### 2.3 `paths`（プレイヤー状態）

- キー: ペア ID の文字列（例 `"1"`）。
- 値: **セグメントの配列の配列** `PathPoint[][]`。通常は **長さ 1 の配列**（単一ポリライン）で、中身が `[{x,y}, ...]`。
- 初期状態 `emptyPaths` では、各 ID について **2 セグメント** `[[start], [end]]` のように端点だけが分離された形から始まり、描画中にマージされる（UI 実装詳細は `PairLinkGame.tsx`）。

---

## 3. クリア条件（実装どおり）

`validatePaths(paths, pairs, gridSize)`（`src/lib/puzzle-engine/pair-link.ts`）が **唯一のサーバー側正解定義** として使われる。

1. 各ペア `p` について、`paths[String(p.id)]` が存在し、**ちょうど 1 本** のパス（`pathList.length === 1`）であること。
2. そのパスの **先頭セル** が `(start,end)` のどちらかと一致し、**末尾セル** がもう一方と一致すること（向きはどちらでも可）。
3. 全ペアのパスに現れるマス `(x,y)` を集合に入れたとき、**ユニークなマス数が `gridSize * gridSize` に等しい**こと（全マス覆い＋重複なしを同時に満たす）。

**注意**: この関数は「隣接マスへの正交移動のみ」などを **明示的には検証しない**。クライアントの描画ロジックで正交のみに制限されているが、理論上は歪んだパスが送られれば別判定が必要になる。

クリア時: `PairLinkGame` から `recordPuzzleClear("pairLink")` と任意で `userSync.saveProgressAndSync` が呼ばれる。

---

## 4. クライアント：ゲームモードと出題経路

### 4.1 `useLegacyMode`

- **`true`（レガシー）**: `usePuzzleStock` + `initGame(gridSize, numPairs, seed?)`。ストックキーは `gridSize`×`numPairs`（Edge-Swap 利用時は `scoreThreshold` 等もキーに含む場合あり）。
- **`false`（グレード）**: `usePuzzleStockByGrade` + `initGameByGrade(currentGrade, seed?)`。グレード定数に従い **常に `generationMode: "edgeSwap"`** で Worker を呼ぶ。

### 4.2 Worker 呼び出し

- `useBoardWorker` が `new Worker("/workers/board-worker.js")` を共有し、`GENERATE` メッセージで `gridSize`, `seed`, `numPairs`, `config` を渡す。
- 返却の `board` に `numbers`, `pairs`, `solutionPaths`, `postMutationScoreBreakdown`, `debugEnclosures` 等が含まれる場合がある。

### 4.3 ABC スコア（表示・バッチ用）

- 盤ロード時やデバッグのバッチ処理で、`solutionPaths` があれば `computeABCScore(pairs, solutionPaths, gridSize)` を実行（`PairLinkGame.tsx`）。
- **これは Worker の `enclosureCount` や `finalScore` とは別物**（定義は §9.2）。

### 4.4 デバッグ機能（抜粋）

- `postMutationScoreBreakdown` をコンソールに出す、`EDGE_SWAP_SCORE_DEFAULTS` のスライダでパラメータマージ、`devtj=true` で出題メタ表示、囲い込みデバッグ描画（`debugEnclosures`）など。

---

## 5. 盤面生成：エントリポイント `generatePairLinkPuzzle`

場所: `public/workers/board-worker.js`

### 5.1 パラメータ処理

- `pairCount`: 引数 `numPairs` があれば `max(2, min(maxPairs, numPairs))`。  
  `maxPairs = gridSize >= 7 ? 10 : gridSize`。
- `config.generationMode`:
  - **`"edgeSwap"`** かつ **`4 <= gridSize <= 10`** → **Edge-Swap 経路**（§6）。
  - それ以外 → **デフォルト経路**（§7）。

### 5.2 Edge-Swap 経路（要約）

1. シードから `createRandom(attemptSeed)`。
2. `targetPairCount = clamp(pairCount, minPairs, maxPairsEdge)`（§6.1 と `PAIR_LINK_GRADE_GENERATION_CONDITIONS.md` の Worker クランプ表）。
3. `generateByEdgeSwap(gridSize, targetPairCount, random, edgeMutationOpts)` を実行。
4. **`applyThreshold`**: シードが **空でない** 場合は `false`。シードなしかつ `scoreThreshold >= 0` のとき `true`。
   - `applyThreshold === true` のとき、**`finalScore >= scoreThreshold` になるまで最大 200 回** ループ。満たさなければ `null`。
5. 成功時、`numbers` / `pairs` を着色して返す。`solutionPaths`, `postMutationScoreBreakdown`, `debugEnclosures` を付与。

### 5.3 デフォルト経路（要約）

1. 全体タイムアウト **50s**、試行を繰り返す。
2. `generateCandidate(gridSize, pairCount, ...)`:
   - **`gridSize <= 6`**: `generateCandidate6x6`（ビームサーチで全域覆い → 一意解チェック）。
   - **`gridSize > 6`**: `generateCandidate8x8`（端点配置 + SAT/制約で辺選択）。
3. **`gridSize <= 6`** かつ `candidate.difficultyScore < baseThreshold`（既定 `gridSize * pairCount * 10`）なら棄却して再試行。
4. `solutionPaths` は `candidate.grid` から `solutionGridToPaths` で DFS 抽出。

---

## 6. Edge-Swap 生成パイプライン（`generateByEdgeSwap`）

### 6.1 Phase 1：タイリング（全セル埋め）

- `solutionGrid`（パス ID）と隣接リスト `adj` を初期化。
- 行優先で空セル `(r,c)` を見る:
  - **空き隣がある場合**: ランダムに隣を選び、**新しい `pathId`** でドミノ状に 2 マス塗る（辺を追加）。
  - **空き隣がない場合**: 既存の塗りマスから（可能なら次数 1 の「端」優先）ドナーを選び、同じ `pid` で現在セルを接続。
- 全セルが非ゼロであること、初期パス数 `pathCount >= targetPairCount` を満たさなければ **再帰的にやり直し**。

### 6.2 Phase 2：パス統合（ペア数を `targetPairCount` まで）

- `pathCount > targetPairCount` のあいだ:
  - 次数 1 のセル同士が **正接** するペア `(a,b)` を列挙。
  - **同じパス ID に到達可能**な端同士（グラフ上で繋がっている）はマージ不可（ループになるためスキップ）。
  - 選んだ端同士に辺を追加し、`b.pid` の全セルを `a.pid` に統合。`pathCount--`。
- 合流候補が無ければ再生成。

### 6.3 グラフ検証

- 全セル次数が **1 または 2**。
- 次数 1 のセル数 = `2 * targetPairCount`、次数 2 = `n*n - 2*targetPairCount`。  
  不一致なら再生成。

### 6.4 ミューテーション：2×2 エッジスワップ（最大 1000 試行）

- ランダムな 2×2 ブロックで 4 マスが **同一 `pid`** のとき、パターン A/B（縦2本↔横2本）で辺を入れ替え。
- 入替後、`checkPidAfterSwap` で **連結・単一路・サイクルなし** を確認。失敗は戻す。
- `computeMutationScoreBreakdown` の **`finalScore` が上がったときだけ採用**。

### 6.5 クロールフェーズ（`CRAWL_EXCHANGE_ITERS = 1000`）

- 確率 0.5 で `tryZeroSumBoundaryCrawl`（端点隣接セルのゼロサム奪取でマンハッタン和を増やす／タイブレークでランダム採択）。
- それ以外は、**異なるペアの端点同士が正接**しているペアをランダム選び、**2 パスのラベル（`solutionGrid` 上の ID）とセル集合・端点情報をスワップ**。

### 6.6 出力用 ID の付け直しと `pairs`

- 内部 `pid` から表示用 `1..N` へ `pathToOutId` でマッピングした `outGrid` を構築。
- 各パスについて、次数 1 の端点のうち **マンハッタン距離が最大** なペアを `start`/`end` として `pairs` に格納（コメント上は「葉↔葉」）。

### 6.7 `solutionPaths` 構築

- `buildSolutionPathsFromAdj`: 葉が 2 つなら BFS 距離で数字 `pairs.start` に近い葉から向きを決め、`buildSolutionPathDirected` で **終点からの BFS 深度に沿って** 一本道を復元。
- 最後に `computeMutationScoreBreakdown(..., mutationAttemptIndex: null)` を **再実行** し、**`postMutationScoreBreakdown` はこの最終値**（コメント上「クロール後に上書き」）。

---

## 7. 小盤デフォルト生成（`generateCandidate6x6`）

1. `generateFullCoverByBeam` で森林状の全域ラベリング（ビーム幅付き探索、詳細は同ファイル内）。
2. 各 ID のセルから次数を計算し、端点から 2 つ選んで `pairs` の `start`/`end` を決定。
3. 端点のみ埋めたグリッドに対し `countSolutions(..., maxSolutions: 2)` で **解の個数がちょうど 1** であることを要求。それ以外は失敗。

---

## 8. 大盤デフォルト生成（`generateCandidate8x8` 概要）

- セルをシャッフルし、ペアごとに 2 マスを端点として取る。
- 縦辺・横辺変数とセルラベル変数から CNF を構築し、DPLL 風ソルバで解く（`solveSat`）。
- 成功すれば `grid` と `pairs` を返す（`difficultyScore` 等は Edge-Swap と異なるスキーム）。

---

## 9. スコア体系

### 9.1 Worker：`postMutationScoreBreakdown`（Edge-Swap 採用・難易度指標）

関数: `computeMutationScoreBreakdown(solutionGrid, adj, n, mutationAttemptIndex, scoreParams)`  
パラメータ既定: `mergeEdgeSwapScoreParams`（`src/lib/pair-link-edge-swap-score.ts` の `EDGE_SWAP_SCORE_DEFAULTS` と同一キー）。

#### 9.1.1 隣接密度 `adjRate` と段階ペナルティ

- 各パス（内部 `pid`）について、グラフ上の次数 1 の端点を列挙し、**同じ `pid` 内でマンハッタン距離が最大**な端点対 `(a,b)` を代表端点とする（`epList`）。
- 各代表端点対について、距離 `m <= 2` なら `adjCount++`、`m === 3` なら `semiAdjCount++`（重み `semiDist3Weight`、既定 0.5）。
- `pathCount = epList.length`  
  `weightedAdjSum = adjCount + semiAdjCount * semiDist3Weight`  
  `adjRate = weightedAdjSum / pathCount`
- `adjacencyRateTierPenalty(adjRate)`（6×6 以下は `size6AdjRateT3` / `size6AdjPenaltyScale` で緩和）:
  - `adjRate < adjRateT1` (0.15) → 0
  - `< adjRateT2` (0.3) → 200
  - `< t3` (大盤 0.45、小盤は `size6AdjRateT3` 既定 0.65) → 1000
  - それ以上 → `5000 + adjRate * 10000`
- **ミューテーション中**（`mutationAttemptIndex != null`）は `adjacentPenaltyScale`: 試行 500 未満は **0.5**、それ以降 **1**。最終盤面（`null`）は **1**。

#### 9.1.2 カバレッジ `coverageScore`

- 各 `pid` のセル集合の **バウンディングボックス面積 A** とセル数 L に対し `A/L` を足し合わせる。
- `coverageWeighted = coverageScore * coverageMult`（既定 1.5）。

#### 9.1.3 干渉 `interferenceScore`

- **Endpoint**: 他ペアの端点（次数 1）との **キング距離 1**（8 近傍）にあるセル数を、自パスの各セルについてカウントし合算（`wEndpoint` 既定 2）。
- **Parallel**: 4 近傍に **他 `pid` の「内部セル」（次数 2）** があるセル数に `wParallel`（既定 7）を掛けた重み和。
- `interferenceWeighted = wEndpoint * interferenceEndpoint + wParallel * interferenceParallel`  
  `base = coverageWeighted + interferenceWeighted`（コメントでは `coverage * 1.5 + InterferenceW`）。

#### 9.1.4 囲い込み `enclosureCount`

- `countPairLinkEnclosures(solutionGrid, adj, n)`:
  - 次数 1 のセル（端点）を走査し、他パスの **順序付きパス** に対する **縦ラップ / 横ラップ** 判定（`checkVerticalWrapEnclosure` / `checkHorizontalWrapEnclosure`）で「厳格な囲い込み」を数える。
  - ペア `(囲うパス p, 囲まれる端点のパス q)` は **重複カウント防止** のため `pairCounted` で 1 回のみ。

#### 9.1.5 中間スコアとペナルティ

- `finalScore = base * (1 + enclosureCount * enclosureMult) - adjacencyPenaltyApplied`（`enclosureMult` 既定 1.5）

**直線・支配ペナルティ**（減算）:

- 各パスで端点間マンハッタン 1 または `straightRunRatio >= 0.8` を「直線に近い」とみなし、その割合 `straightPairRatio` が `straightRatioThreshold` (0.4) を超えた分に線形ペナルティ（`straightPenaltyBase`, `straightPenaltySlope`）。
- パス長を降順に並べた上位 2 本の和 / `n*n` を `dominanceRatio` とし、閾値超えでペナルティ（6×6 以下は `size6DominanceThreshold` / `size6DominancePenaltyScale` で調整）。

**囲い込みボーナス**（加算）:

- `enclosureBonus = enclosureBonusPerCount * enclosureCount`（既定 80 × 件数）。

最終的な **`finalScore`** は上記をすべて反映した値。返却オブジェクトには `coverageScore`, `interferenceEndpoint`, `interferenceParallel`, `straightPairRatio`, `dominanceRatio`, `adjRate`, 生のペナルティ各種などが含まれる。

### 9.2 クライアント：ABC スコア（分析表示用）

`computeABCScore`（`src/lib/pair-link-abc-score.ts`）:

- **A: detourScore** — 各ペアのパス長 / 端点マンハッタン距離 の平均。
- **B: enclosureScore** — 各ペアのパスを多角形（閉じた折れ線）とみなし、**他ペアの両端点** がその多角形の内部に入る回数を ray casting で数えた **合計**（Worker の `enclosureCount` とは **定義が異なる**）。
- **C: junctionComplexity** — 解グリッド上で、各パスの各セルについて 4 近傍に **別 ID のセル** がある方向数を足し、セルあたり平均。

`computeStats` でバッチ時の min/max/avg/std を算出可能。

---

## 10. サーバーアクション（`src/app/games/pair-link/actions.ts`）

| 関数 | 役割 |
|------|------|
| `generatePuzzleAction(gridSize, seed?)` | `generatePairLinkPuzzle`（**サーバー専用エンジン** `src/lib/puzzle-engine/pair-link.ts`）を呼ぶ。クライアントの Worker とは **別実装**（ペア数は `getPairCount(gridSize)` 固定など）。 |
| `validatePathsAction` | `validatePaths` をそのまま公開。 |
| `solvePathsAction` | `solvePathsForPairs` — デバッグ用に解の paths を返す。 |

本番プレイの盤生成は通常 **Worker** 経由である点に注意。

---

## 11. 補助スクリプト・既存ドキュメント

- `scripts/run-pairlink-grade-adoption-benchmark.mjs` — グレード採用率などのベンチマーク用。
- `scripts/run-pairlink-score-simulation.mjs` — スコア分布シミュレーション。
- `scripts/board-gen-standalone.js` — Worker と近いロジックのスタンドアロン生成。
- `docs/PAIR_LINK_ALGORITHM_ANALYSIS.md`, `docs/PAIR-LINK-HANDOVER.md` — 過去の分析・引き継ぎメモ（本書と矛盾する場合は **コード優先**）。

---

## 12. 変更時の注意

- グレード閾値・囲い条件 → `pair-link-grade-constants.ts` と **`PAIR_LINK_GRADE_GENERATION_CONDITIONS.md`** を同期すること。
- Worker 内の `computeMutationScoreBreakdown` を変えた場合、`pair-link-edge-swap-score.ts` の既定値やデバッグ UI の意味も合わせて確認すること。
- ABC スコアは **表示・分析専用** でグレードフィルタには使われない。

---

*本書はリポジトリ実装のスナップショットとして記述している。行為や式の詳細は各ファイルのコメント・実装を参照。*
