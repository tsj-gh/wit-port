# Pair-link 生成アルゴリズム 詳細解析レポート

## 1. 生成プロセスの詳細解説

### 1.1 コールスタック（エントリーポイント → 盤面完成）

```
[クライアント] postMessage({ type: 'GENERATE', gridSize, seed?, numPairs? })
    │
    ▼
board-worker.js: self.onmessage
    │
    ▼
generatePairLinkPuzzle(gridSize, seed, numPairs)
    │
    ├─► [ループ] 以下を timeLimitMs 超過まで繰り返し
    │       │
    │       ├─► createRandom(attemptSeed)  // Mulberry32 PRNG
    │       │
    │       ├─► generateCandidate(gridSize, pairCount, profile, random, logFailure)
    │       │       │
    │       │       ├─ [gridSize ≤ 6] generateCandidate6x6(...)
    │       │       │       │
    │       │       │       ├─► generateFullCoverByBeam(n, pairCount, random)
    │       │       │       │       │
    │       │       │       │       ├─ cells を Fisher-Yates シャッフル
    │       │       │       │       ├─ initGrid: 各 id の初期セルを cells[0..pairCount-1] に配置
    │       │       │       │       └─ [ビームループ] maxSteps 回
    │       │       │       │               ├─ computeDegreesAndEndpoints(state.grid)
    │       │       │       │               ├─ 全マス埋め & 全ペア端点2個 → 成功 return
    │       │       │       │               ├─ 各 beam 状態 × 各 id × 各端点 × 4方向
    │       │       │       │               │   → 空きマスへ拡張した newGrid を nextStates に追加
    │       │       │       │               ├─ evaluateForestGrid(newGrid) でスコア付け
    │       │       │       │               ├─ nextStates.sort((a,b) => b.score - a.score)
    │       │       │       │               └─ beam = nextStates.slice(0, beamWidth)
    │       │       │       │
    │       │       │       ├─ 各 id のセル集合から degree 計算 → 端点2個を start/end として pairs 抽出
    │       │       │       ├─ countSolutions(solveGrid, pairs, 0, 2, stats, random)
    │       │       │       └─ solCount === 1 でなければ null
    │       │       │
    │       │       └─ [gridSize > 6] generateCandidate8x8(...)
    │       │               ├─ cells シャッフル → 先頭から2セルずつ terminals に割当
    │       │               ├─ SAT 制約構築（グリッドグラフ + ラベル変数）
    │       │               ├─ solveSat(numVars, clauses, 2000)
    │       │               └─ 解があれば pairs 返却（grid は null）
    │       │
    │       ├─ difficultyScore < baseThreshold なら再試行（6x6 のみ）
    │       │
    │       └─ 成功時: numbers 整形 → return
    │
    └─► solutionGridToPaths(candidate.grid, candidate.pairs)  // 6x6 のみ
```

### 1.2 パスを1マス伸ばす際のロジック（Beam Search）

**「次のマス」の選択は、単一の拡張ではなく、ビーム全体の状態空間探索で行われる。**

#### 拡張候補の生成

各ステップで、以下を**すべて**列挙する:

1. **対象**: `beam` 内の各状態 `state`
2. **端点**: `computeDegreesAndEndpoints(state.grid)` で得た `endpointsPerId`
   - 端点 = その id のセルのうち、隣接同 id セル数が 1 または 0 のセル
3. **拡張**: 各 id の各端点 `(r, c)` について、4方向 `(dr, dc) ∈ {(0,1),(0,-1),(1,0),(-1,0)}` の隣接セル `(nr, nc)` を調べる
4. **条件**: `state.grid[nr][nc] === 0`（空きマス）の場合のみ有効
5. **新状態**: `newGrid = state.grid` のコピーで `newGrid[nr][nc] = id` としたものを `nextStates` に追加

**重要**: 方向の優先順位や「この端点からこの方向を選ぶ」といった局所的な選択は行わない。すべての「端点→空き隣接」の組み合わせを候補として生成する。

#### スコアリングと絞り込み

各候補 `newGrid` に対して `evaluateForestGrid(newGrid)` を呼び、スコアを付与する。

```
evaluateForestGrid(grid):
  score = 0
  filled = 0
  emptyIsolatedPenalty = 0

  for each cell (r, c):
    if grid[r][c] ≠ 0:
      filled += 1
    else:
      emptyNeighbors = 隣接4方向のうち grid[nr][nc]==0 の数
      if emptyNeighbors ≤ 1:
        emptyIsolatedPenalty += 5

  score = filled × 10 - emptyIsolatedPenalty
  return score
```

**選ばれる状態**:
- `nextStates` を `score` の**降順**でソート
- 上位 `beamWidth` 件のみを次の `beam` とする

**数式**:
```
score(G) = 10 × |{ (r,c) : G[r][c] ≠ 0 }| - 5 × |{ (r,c) : G[r][c]=0 ∧ #{隣接空き} ≤ 1 }|
```

高いスコア = 埋まっているマスが多く、かつ「空きマスで隣接空きが1以下」のセル（袋小路になりうるセル）が少ない状態を優先する。

---

## 2. 内部パラメータの全羅列

### 2.1 PRNG（Mulberry32）

| パラメータ | 値 | 場所 |
|-----------|-----|------|
| 加算定数 | `0x6d2b79f5` | mulberry32 |
| hash 乗数 | `31` | hashString |

### 2.2 ビーム探索（generateFullCoverByBeam）

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| `beamWidth` | `20` | ビーム幅（保持する状態数） |
| `maxSteps` | `n × n × 8` | 最大ステップ数（6x6 なら 288） |

### 2.3 評価関数（evaluateForestGrid）

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| 埋まりボーナス | `10` | 1マス埋まるごとに +10 |
| 孤立空きペナルティ | `5` | 空きマスで隣接空き ≤ 1 のとき 1マスあたり -5 |

### 2.4 一意解チェック（countSolutions）

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| `maxSolutions` | `2` | 2解見つけた時点で打ち切り |
| `nodeLimit` | `n × n × pairCount × 40` | DFS ノード数上限（6x6/5 なら 7200） |

### 2.5 難易度フィルタ（generatePairLinkPuzzle）

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| `baseThreshold` | `gridSize × pairCount × 10` | difficultyScore がこれ未満なら破棄（6x6/5 なら 300） |
| `timeLimitMs` | `50000` | 全体タイムアウト（50秒） |

### 2.6 SAT ソルバー（8x8 以上）

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| `timeLimitMs` | `2000` | solveSat のタイムアウト（2秒） |

### 2.7 その他

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| 方向ベクトル | `[[0,1],[0,-1],[1,0],[-1,0]]` | 右・左・下・上（順序固定、countSolutions 内でシャッフル） |
| `getPairCount` | 4→3, 6→5, 8→7, 10→9 | デフォルトペア数 |

---

## 3. 介入ポイント候補（実装は行わない）

難易度や盤面の性質を操作するために変更を検討できる箇所を列挙する。

### 3.1 ビーム探索

| 介入ポイント | 現状 | 変更による効果 |
|-------------|------|----------------|
| `beamWidth` | 20 | 増やすと多様な経路を探索しやすく、迂回や囲い込みのバリエーションが増える可能性 |
| `maxSteps` | n²×8 | 増やすと全マス埋めの成功率向上の可能性（計算量増） |

### 3.2 評価関数（evaluateForestGrid）

| 介入ポイント | 現状 | 変更による効果 |
|-------------|------|----------------|
| 埋まりボーナス | 10 | 相対的な重みの調整 |
| 孤立空きペナルティ | 5 | 袋小路を避ける強さの調整。弱めると分岐的な経路が選ばれやすくなる可能性 |
| **迂回ペナルティ** | なし | 経路長やマンハッタン距離との比をペナルティにすると、直線寄りの経路を優先できる |
| **囲い込みボーナス/ペナルティ** | なし | 他ペアの端点を囲む経路を評価に含めると、囲い込みの多寡を制御できる |

### 3.3 拡張候補の生成順序

| 介入ポイント | 現状 | 変更による効果 |
|-------------|------|----------------|
| id の処理順 | 1..pairCount の固定順 | 順序を変えると、どのペアを先に伸ばすかが変わり、経路の絡み方が変わる可能性 |
| 方向の優先 | 4方向を均等に列挙 | 特定方向を優先すると、直線的・規則的な経路が増える可能性 |

### 3.4 一意解チェック

| 介入ポイント | 現状 | 変更による効果 |
|-------------|------|----------------|
| `nodeLimit` | n²×pairCount×40 | 増やすと厳密な一意解判定の精度向上（計算量増） |
| `maxSolutions` | 2 | 1 にすると「解の有無」のみの判定になる（現状は2解目で打ち切り） |

### 3.5 難易度フィルタ

| 介入ポイント | 現状 | 変更による効果 |
|-------------|------|----------------|
| `baseThreshold` | gridSize×pairCount×10 | 下げると簡単な盤面も許容、上げると「難しい」盤面のみ採用 |
| `difficultyScore` の定義 | countSolutions の DFS ノード数 | 別の難易度指標（例: ABC スコア）に差し替えることで、難易度の意味を変更可能 |

### 3.6 初期配置

| 介入ポイント | 現状 | 変更による効果 |
|-------------|------|----------------|
| 初期セル位置 | シャッフルした cells の先頭 pairCount 個 | 初期配置を制約（例: 端寄り、中央寄り）すると、経路の広がり方に偏りを持たせられる |

### 3.7 SAT 経路（8x8 以上）

| 介入ポイント | 現状 | 変更による効果 |
|-------------|------|----------------|
| 端点の決定 | シャッフル後の先頭 2×pairCount セル | 端点の分布を制御すると、難易度や経路の複雑さに影響 |
| 制約の追加 | 現行のグラフ＋ラベル制約 | 迂回や囲い込みを制約に組み込むことで、SAT 解の性質を制御できる可能性 |

---

## 4. 補足: 2系統の生成方式

| 条件 | 方式 | 特徴 |
|------|------|------|
| gridSize ≤ 6 | Beam Search | 全マス埋めの「森」を段階的に構築。評価関数で候補を絞り込み。解の grid を保持。 |
| gridSize > 6 | SAT | 端点を先に決め、グリッドグラフ上で経路が存在するか SAT で判定。解の grid は返さない（solutionPaths は null）。 |

---

*解析日: 2026-03-20*
