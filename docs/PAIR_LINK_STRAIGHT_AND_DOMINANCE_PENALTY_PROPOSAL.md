# Pair-link 直線ペア・上位2ペア支配ペナルティ提案

## 要約（質問への直接回答）

### 直線ペア割合ペナルティ
- **しきい値**: 40%（直線ペアが全体の 4 割超で適用）
- **推奨ペナルティ量**: 基本 150 + 超過分 × 2500  
  - 40% ちょうど → 約 150（他ペナルティがなければ 0 付近〜負）
  - 50% → 400、60% → 650
- 他ペナルティがなくても 40% 超で負になりやすい量

### 上位2ペア経路長支配ペナルティ
- **しきい値**: 40%（上位2ペアの経路長合計が全マス n² の 4 割超で適用）
- **推奨ペナルティ量**: 基本 200 + 超過分 × 3000  
  - 40% ちょうど → 約 200（他で加点があっても負に寄る）
  - 50% → 500、60% → 800
- 他で加点があっても 40% 超で負になりやすい量

---

## 前提: 現行スコア構造

`computeMutationScoreBreakdown` (board-worker.js) の Total スコア:

```
base = coverageScore × coverageMult + interferenceWeighted
finalScore = base × (1 + enclosureCount × enclosureMult) - adjacencyPenaltyApplied
```

- **正の寄与**: Coverage（面積/経路長）、Enclosures（乗数）
- **負の寄与**: Interference（端点近傍・並走）、Adjacency 段階ペナルティ

シミュレーション結果: Total はおおよそ -数百〜500+ の範囲。上位は 300〜600 程度。

---

## 1. 直線ペア割合ペナルティ

### 条件
- **直線ペア**: 経路の 80% 以上が直線（同一方向の連続セグメント）であるペア
- **隣接点ペア**（マンハッタン距離 1）も直線とみなす
- **直線ペア割合** = 直線ペア数 / 総ペア数
- しきい値 40% を超えたらペナルティ

### 直線判定アルゴリズム

パスを端点から順に辿り、各辺の方向（水平 dx≠0 or 垂直 dy≠0）を記録。
同一方向の連続区間の最大長を求める。

```js
function straightRunRatio(cells, adj, n) {
  if (cells.length < 2) return 0;
  const sorted = topologicalSortPath(cells, adj);  // 端点から一方向に並べ替え
  let maxRun = 1, curRun = 1;
  let prevDir = null;  // 0=horizontal, 1=vertical
  for (let i = 1; i < sorted.length; i++) {
    const dr = sorted[i].r - sorted[i-1].r;
    const dc = sorted[i].c - sorted[i-1].c;
    const dir = Math.abs(dr) > 0 ? 1 : 0;
    if (dir === prevDir) curRun++; else { maxRun = Math.max(maxRun, curRun); curRun = 1; prevDir = dir; }
  }
  maxRun = Math.max(maxRun, curRun);
  return maxRun / sorted.length;
}
```

- `straightRunRatio >= 0.8` → 直線ペア
- マンハッタン距離 1 のペア（隣接）は pathLen=2 で常に 100% 直線 → 直線に含める

### ペナルティ量の試算

| 直線ペア割合 | 他ペナルティなし時 | 推奨ペナルティ | 備考 |
|-------------|-------------------|----------------|------|
| 40%         | 0 になる           | 150            | しきい値ちょうどで総合 0 付近 |
| 50%         | 負になる           | 250            | |
| 60%+        | 大きく負           | 350 + (ratio-0.4)*1000 | 線形に増加 |

**推奨式**（40% 超で適用、他ペナルティなしでも負に寄せる）:

```js
// straightPairRatio > 0.4 のとき
straightPenalty = 150 + (straightPairRatio - 0.4) * 2500
```

例:
- ratio=0.4 → penalty=150（ちょうどゼロ付近）
- ratio=0.5 → penalty=400
- ratio=0.6 → penalty=650

Coverage ベースが 20〜40、Enclosure 乗数で 1.5〜2 倍と仮定すると、正の寄与はおおよそ 30〜100。ペナルティ 150 で多くの盤面が負になる。

---

## 2. 上位2ペア経路長支配ペナルティ

### 条件
- **全マス（盤面-端点）**: `n*n - 2*pathCount`（端点を除いたセル数）  
  ※ 全セルがパスで埋まる前提なら `n*n` でも可。端点重複はないので `n*n` 採用で単純化。
- **支配率** = (最長パス長 + 2番目に長いパス長) / (n*n)
- しきい値 40% を超えたらペナルティ

### 実装

```js
const lengths = [];
for (const [, cells] of byPid) {
  if (cells.length >= 2) lengths.push(cells.length);
}
lengths.sort((a, b) => b - a);
const top2Sum = (lengths[0] || 0) + (lengths[1] || 0);
const dominanceRatio = top2Sum / (n * n);
```

### ペナルティ量の試算

8×8 で上位2ペアが 40% 占める場合: 64×0.4=25.6 セル。  
上位2本で 26 セル以上 → 他 6 本程度で 38 セル。かなり偏った分布。

**推奨式**（40% 超で適用）:

```js
// dominanceRatio > 0.4 のとき
dominancePenalty = 200 + (dominanceRatio - 0.4) * 3000
```

例:
- ratio=0.4 → penalty=200
- ratio=0.5 → penalty=500
- ratio=0.6 → penalty=800

他で加点があっても 40% 超で確実に負に寄せるには、200 程度で十分な場合が多い。より厳しくするなら 250〜300 から開始。

---

## 3. FinalScore への組み込み

```js
// 既存
finalScore = base * (1 + enclosureCount * sp.enclosureMult) - adjacencyPenaltyApplied;

// 追加
finalScore -= straightPenalty;
finalScore -= dominancePenalty;
```

---

## 4. スコアパラメータへの追加案

`EdgeSwapScoreParams` に追加:

```ts
// 直線ペア割合ペナルティ
straightRatioThreshold: number;   // 0.4（しきい値）
straightPenaltyBase: number;       // 150（40%ちょうど時のペナルティ）
straightPenaltySlope: number;     // 2500（超過分の係数）

// 上位2ペア支配ペナルティ
dominanceRatioThreshold: number; // 0.4
dominancePenaltyBase: number;     // 200
dominancePenaltySlope: number;    // 3000
```

既定値で「40% 超→他がなくても負」程度の効果になるようチューニング。

---

## 5. 実装順序

1. `computeMutationScoreBreakdown` 内で:
   - `byPid` と `adj` から各パスの直線率を計算
   - 直線ペア割合・上位2パス長を算出
2. 上記のペナルティ式で `straightPenalty`, `dominancePenalty` を計算
3. `finalScore` から両方を減算
4. `return` オブジェクトに `straightPenalty`, `dominancePenalty`, `straightPairRatio`, `dominanceRatio` を追加（デバッグ・UI用）

---

## 6. パス整列（pathCellsInOrder）の実装

`byPid` のセル一覧は格子順であり、経路の連結順ではない。  
`adj[r][c]` は隣接セルの key (r*n+c) の配列。端点（`adj[r][c].length === 1`）から辿る。

```js
function pathCellsInOrder(cells, adj, n) {
  if (cells.length < 2) return cells;
  const cellSet = new Set(cells.map((c) => c.r * n + c.c));
  const endpoints = cells.filter(({ r, c }) => adj[r][c].length === 1);
  if (endpoints.length < 2) return cells;
  const start = endpoints[0];
  const out = [start];
  const seen = new Set([start.r * n + start.c]);
  let cur = start;
  while (out.length < cells.length) {
    let next = null;
    for (const nk of adj[cur.r][cur.c]) {
      const nr = Math.floor(nk / n);
      const nc = nk % n;
      if (cellSet.has(nk) && !seen.has(nk)) {
        next = { r: nr, c: nc };
        break;
      }
    }
    if (!next) break;
    out.push(next);
    seen.add(next.r * n + next.c);
    cur = next;
  }
  return out;
}
```
