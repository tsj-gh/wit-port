# Pair-link 生成統計シミュレーション

## 実行方法

```bash
npm run sim:pairlink-scores
```

- 6 パターン（7×7 でペア 7/8/9、8×8 で 8/9/10）× **1000** 試行（計 **6000**）
- スコアは **Final Board** 時点（`postMutationScoreBreakdown`＝クロール・`buildSolutionPathsFromAdj` 後の再計算）
- 試行間は `setImmediate` でイベントループに譲る（既定: 5 試行ごと）
- **100 試行ごと**にコンソールへ進捗（`SIM_PROGRESS_EVERY` で変更可）

## 環境変数

| 変数 | 説明 |
|------|------|
| `SIM_RUNS` | パターンあたりの試行数（既定 `1000`） |
| `SIM_OUT_DIR` | 出力先ディレクトリ（既定: リポジトリルート） |
| `SIM_YIELD_EVERY` | 何試行ごとに `setImmediate` するか（既定 `5`） |
| `SIM_PROGRESS_EVERY` | 進捗ログ間隔（既定 `100`） |

## 出力ファイル（パターン別）

ファイル名: **`simulation_results_{N}x{N}_p{M}_fixed.json`**

例: `simulation_results_8x8_p10_fixed.json`

各ファイルに含まれる内容:

- `basicStatistics.totalScore`: 平均・中央値・標準偏差・最大・最小
- `generationEfficiency.timeMs`: 平均、**P95**
- `qualityDistribution`:
  - `totalScoreGreaterThan500Percent`: TotalScore > 500 の出現率（%）
  - `enclosuresAtLeast1Percent`: Enclosures ≥ 1 の出現率（%）
- `top5ByTotalScore`: 当該パターンで TotalScore 上位 **5** 件（指標・`boardHash`・`seed` 等）
- `trials`: 全試行（TotalScore, Coverage, Interference, Enclosures, AdjRate, Dist2, Dist3, 生成 ms, ハッシュ、`scoreTiming: "finalBoard"`）

※ Dist2/Dist3・AdjRate は**同一 ID ペア内の 2 端点間**マンハッタン距離に基づく。

これらの JSON は `.gitignore` 対象（サイズ大）。ローカルで生成してください。

## 実装

- `scripts/run-pairlink-score-simulation.mjs` — Node + `vm` で `public/workers/board-worker.js` を読み込み
