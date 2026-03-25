# ペアリンク：グレード別・盤面生成・採用条件

本書は **グレードに紐づく盤面の生成・採用条件のみ** をまとめたものです。  
実装の一次ソースは `src/lib/pair-link-grade-constants.ts` と `src/hooks/usePuzzleStockByGrade.ts`、および `public/workers/board-worker.js` の Edge-Swap 分岐です。

---

## 1. 定数テーブル（`PAIR_LINK_GRADE_CONSTANTS`）

| グレード | 盤面サイズ N（N×N） | ペア数 | 囲い込み件数条件 `enclosureReq` | Worker へ渡す `scoreThreshold`（-1=無効） | テーマ（UI） |
|---------|---------------------|--------|-----------------------------------|---------------------------------------------|--------------|
| G1 | 4 | 3 | **ちょうど 0**（`eq: 0`） | **-1**（閾値なし） | 【超入門】まずはつないでみよう |
| G2 | 4 | 3 | **1 以上**（`gte: 1`） | **0** | 【導入】最短以外のルートを意識 |
| G3 | 5 | 4 | **ちょうど 0** | **100** | 【初級】空間を埋める楽しさ |
| G4 | 5 | 4 | **1 以上** | **400** | 【初級】回り込みの概念を知る |
| G5 | 6 | 5 | **ちょうど 0** | **200** | 【中級】効率的なルート設計 |
| G6 | 6 | 5 | **1 以上** | **800** | 【中級】回り込みを使いこなす |
| G7 | 7 | 7 | **1 以下**（`lte: 1`） | **0** | 【難関への扉】高密度な盤面の整理 |
| G8 | 8 | 8 | **1 以下** | **300** | 【上級】広い盤面でのルート俯瞰 |
| G9 | 8 | 9 | **2 以上** | **1500** | 【特級】複雑な干渉を解き明かす |
| G10 | 9 | 10 | **1 以上** | **2500** | 【達人】AIが選んだ迷宮に挑む |
| G11 | 10 | 10 | **2 以上** | **3500** | 【神・隠し】極限の思考の先へ |

- **囲い込み件数**は Worker が返す `postMutationScoreBreakdown.enclosureCount`（`computeMutationScoreBreakdown` / `countPairLinkEnclosures` と一致）。
- **`scoreThreshold >= 0` のグレード**では、Worker 側でも `finalScore >= scoreThreshold` になるまで最大 **200 回** 別シードで再試行する（`board-worker.js` の `applyThreshold`）。

---

## 2. 全グレード共通の追加採用条件（クライアント）

`usePuzzleStockByGrade` の `fetchOneForGrade` で、Worker が成功しても次を満たさなければ **棄却（null）** する。

### 2.1 囲い込み条件 `matchesEnclosure`

`postMutationScoreBreakdown.enclosureCount`（未定義時は 0 扱い）に対し:

- `any` … 常に OK（現行定数では未使用）
- `eq` … 件数が指定値と一致
- `gte` … 件数が指定値以上
- `lte` … 件数が指定値以下

### 2.2 Final Board スコア下限（`def.scoreThreshold >= 0` のとき）

`postMutationScoreBreakdown.finalScore >= def.scoreThreshold`  
（`scoreThreshold === -1` のグレードではこのチェックをスキップ）

### 2.3 隣接密度上限（`GRADE_ADOPTION_MAX_ADJ_RATE`）

- 定数: **`GRADE_ADOPTION_MAX_ADJ_RATE = 0.4`**
- 条件: `adjRate < 0.4`（**未満**。ちょうど 0.4 は不合格）
- `adjRate` は Worker の `postMutationScoreBreakdown.adjRate`（各ペアの「同じパス上の 2 端点間マンハッタン距離」に基づく隣接カウントを正規化した値。詳細はメイン仕様書「Edge-Swap スコア」節）

### 2.4 重複排除

同一グレード内で、同一 `seed` または同一盤面ハッシュ（`boardHash`）の問題はストックに積まない。

---

## 3. Worker 側：Edge-Swap モードでのペア数クランプ

グレードから `def.pairs` を渡す前に、`generatePairLinkPuzzle` 内で次の範囲に収まるよう **クランプ** される。

```text
pairCount = clamp(def.pairs, minPairs, maxPairsEdge)
```

- `maxPairsEdge` = `gridSize <= 6 ? gridSize : 10`
- `minPairs` =
  - `gridSize <= 6` → `max(2, gridSize - 2)`
  - `gridSize === 7` → `7`
  - `gridSize === 8` → `8`
  - `gridSize >= 9` → `8`

現行の各グレードの `(size, pairs)` はいずれもこの範囲内に収まっている。

---

## 4. シード指定時・保険フォールバック時の扱い

| 状況 | Worker `scoreThreshold` | クライアント側のグレードフィルタ |
|------|-------------------------|----------------------------------|
| 通常の `getPuzzleByGrade(grade)`（シードなし） | グレード定義どおり（-1 または正の値） | §2 すべて適用 |
| `getPuzzleByGrade(grade, seed)`（ハッシュ再生） | **常に -1**（閾値で切らない） | **適用しない**（生成結果をそのまま返す） |
| 保険アセットのシードで `generate` | **-1** | 出題は保険シードの盤（フィルタは掛けない） |

---

## 5. ストック・補填・フォールバック（グレード周りの数値）

| 定数 | 値 | 意味 |
|------|-----|------|
| `STOCK_PER_GRADE_MIN` | 3 | （定義のみ、主ロジックは MAX/REFILL で制御） |
| `STOCK_PER_GRADE_MAX` | 5 | グレードごとのストック上限 |
| `STOCK_REFILL_THRESHOLD` | 2 | ストックがこれ未満なら補填をスケジュール |
| `MAX_RETRIES_PER_PUZZLE` | 1000 | 補填ループ 1 回あたりの Worker 試行上限 |
| `MAX_RETRIES_BEFORE_INSURANCE` | 1000 | ストック空き時の即時生成で保険へ行く前の試行上限（時間条件と併用） |
| `DEFAULT_WORKER_PHASE_MAX_MS_BEFORE_INSURANCE` | 100 ms | 連続 Worker 試行の累計時間がこれを超えたら保険を試す |

保険シードは `public/puzzle_insurance_assets.json`（`getInsuranceEntriesForGrade`）から読み込み、直近 5 件の重複を避けてランダム選択する。

---

## 6. 実装ファイル対応表

| 内容 | ファイル |
|------|----------|
| グレード定数・`GRADE_ADOPTION_MAX_ADJ_RATE` | `src/lib/pair-link-grade-constants.ts` |
| 採用フィルタ・ストック・保険 | `src/hooks/usePuzzleStockByGrade.ts` |
| Edge-Swap 生成・`postMutationScoreBreakdown` | `public/workers/board-worker.js` |
| 保険 JSON | `public/puzzle_insurance_assets.json`（リポジトリに無い場合はデプロイ資産） |

---

*最終更新: リポジトリ実装に基づくスナップショット（`pair-link-grade-constants.ts` / `usePuzzleStockByGrade.ts` / `board-worker.js`）。*
