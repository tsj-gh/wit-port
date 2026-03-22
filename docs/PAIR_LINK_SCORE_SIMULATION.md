# Pair-link スコア分布シミュレーション

## 実行方法

```bash
npm run sim:pairlink-scores
```

- 6 パターン（7×7 でペア 7/8/9、8×8 で 8/9/10）× **1000** 試行（計 6000）
- 各試行はミューテーション（スワップ）完了直後の `postMutationScoreBreakdown` を記録（評価式の変更なし）
- 試行間は `setImmediate` でイベントループに譲る（既定: 5 試行ごと）

## 環境変数

| 変数 | 説明 |
|------|------|
| `SIM_RUNS` | パターンあたりの試行数（既定 `1000`） |
| `SIM_OUT` | 出力 JSON パス（既定 リポジトリ直下 `simulation_results.json`） |
| `SIM_YIELD_EVERY` | 何試行ごとに `setImmediate` するか（既定 `5`） |

## 出力 JSON

- `overall`: TotalScore の平均・中央値・標準偏差・最大・最小、生成時間 ms の min/max/mean/P95、`adjRate` の平均
- `top3ByTotalScore`: 全体で TotalScore 上位 3 件の詳細と `boardHash`（端点座標から SHA-256）
- `trials`: 全試行の行（各試行に TotalScore, Coverage, Interference, Enclosures, AdjRate, Dist2, Dist3, 時間 ms, ハッシュ）  
  ※ Dist2/Dist3・AdjRate は**同一数字ペアの2端点間**のマンハッタン距離に基づく（他ペアの端点同士は含めない）

`simulation_results.json` は `.gitignore` に含めています（サイズ大）。必要ならローカルで生成してください。

## 実装ファイル

- `scripts/run-pairlink-score-simulation.mjs` — Node + `vm` で `public/workers/board-worker.js` を読み込み（末尾の `onmessage` のみ除去）
- `generateByEdgeSwap` の戻り値に `postMutationScoreBreakdown` を付与（観測用。`computeMutationScoreBreakdown` 本体は未変更）
