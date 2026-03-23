# 6x6 5ペア盤面の高スコア評価案

## 対象シードの現状スコア

| シード | Coverage | Enclosures | AdjRate | AdjPenalty | DomPenalty | finalScore |
|--------|----------|-------------|---------|------------|------------|------------|
| mn321dvk-cz0dws5va | 8.39 | 2 | 50.0% | 10,000 | 1,217 | **-10,258** |
| mn32eext-2pj99sayi | 7.59 | **5** | 50.0% | 10,000 | 1,300 | **-9,350** |

共通して **AdjacencyPenalty 10,000** と **DominancePenalty 1,200 前後** が大きく効いている。

---

## 現状スコアが低い要因

### 1. AdjacencyPenalty（隣接率）が過大
- **AdjRate 50%** → 第3しきい値 0.45 超過 → ペナルティ 5000 + 0.5×10000 = **10,000**
- 6x6・5ペアではマス数が少なく、端点間マンハッタン距離が小さくなりやすい
- Dist2(距離≤2) が 1 本、Dist3(距離=3) が 3 本 → adjRate = (1 + 3×0.5)/5 = 0.5 になりやすい

### 2. DominancePenalty（上位2ペア支配）が過大
- 経路長: 12+11=23, 14+10=24 → 上位2本で 64〜67%
- 36 マス / 5 本 ≈ 7.2 マス/本 → 2 本で 14〜15 マスは自然
- 30% しきい値では、ほぼすべての 6x6 5ペアでペナルティが発生する

### 3. Interference による底上げ不足
- 227〜218 程度の Interference で、Coverage ベースの正の寄与を大きく下回る

---

## 提案: 6x6 専用の緩和パラメータ

6x6 以下の盤面では、既存パラメータを以下のように緩和する。

### 案 A: しきい値・ペナルティのサイズ別設定

```
if (gridSize <= 6) {
  // 隣接率: 6x6 では 0.6 超でようやく最大ペナルティ
  adjRateT1 = 0.25, adjRateT2 = 0.45, t3 = 0.6
  // または段階ペナルティ額を 1/5 に: 200→40, 1000→200, 5000+→1000+
  
  // 上位2支配: 6x6 5ペアでは 70% 超でペナルティ開始
  dominanceRatioThreshold = 0.7
  dominancePenaltyBase = 50
  dominancePenaltySlope = 500
}
```

### 案 B: 新評価軸の追加（6x6 向けボーナス）

| 評価軸 | 計算方法 | 効果 |
|--------|----------|------|
| **Enclosure ボーナス** | enclosureCount × 150 を加点 | 囲い込みが多い盤面を優遇（mn32eext は 5 で +750） |
| **迂回率 (Detour) ボーナス** | detourAvg ≥ 1.5 のとき (detourAvg - 1.2) × 100 | 2.0 前後の迂回を評価 |
| **経路長バランス** | 上位2本の割合が 50〜75% のとき小幅加点 | 「極端に偏らない」分布を優遇 |

### 案 C: 隣接率の「サイズ正規化」（新規）

現在の adjRate = weightedAdjSum / pathCount は、盤面サイズを考慮していない。

```
// 6x6: 最短経路で埋めると各ペア 2〜10 マス。端点が近いと「必然的」に adj になりやすい
// 正規化: adjRateNormalized = adjRate / (1 + 0.3 * (36 / pathCount))
// 5 ペアなら 36/5=7.2 → 約 0.5 で割る → 実質 adjRate を半分に
```

または **絶対数のみ** でペナルティ:

```
if (gridSize <= 6 && adjCount + semiAdjCount <= 4) {
  adjacencyPenaltyApplied = 0  // 5 ペアで 4 以下なら許容
}
```

---

## 推奨: 案 A + Enclosure ボーナス

### 1. 6x6 専用パラメータ（gridSize ≤ 6 のとき）

| パラメータ | 通常 | 6x6 |
|------------|------|-----|
| adjRateT2 | 0.3 | 0.45 |
| 第3しきい値 t3 | 0.45（固定） | **0.65** |
| 段階ペナルティ | 200/1000/5000+ | **40/200/1000+** |
| dominanceRatioThreshold | 0.3 | **0.65** |
| dominancePenaltyBase | 200 | **50** |
| dominancePenaltySlope | 3000 | **800** |

### 2. Enclosure ボーナス（全サイズ）

```
enclosureBonus = enclosureCount * 80
finalScore += enclosureBonus
```

例: mn32eext（Enclosures 5）→ +400 点。

### 3. 試算（上記を適用した場合）

**mn321dvk-cz0dws5va**  
- AdjRate 0.5 < t3(0.65) → 中段階 200 のみ（または 40）
- Dominance 63.9% < 65% → ペナルティ 0
- base は現状のまま（Coverage 12.6 + Interference の影響）
- Enclosures 2 → +160

**mn32eext-2pj99sayi**  
- 同様に Adj・Dominance ペナルティを縮小
- Enclosures 5 → +400

---

## 実装方針

1. **`computeMutationScoreBreakdown`** に `gridSize` を渡す（既に渡している）
2. **`gridSize <= 6` の分岐** を追加し、上記パラメータで計算
3. **EdgeSwapScoreParams** に `size6AdjScale`（隣接ペナルティ倍率 0.2 など）や `size6DominanceThreshold` を追加するか、worker 内で固定で分岐するかを選択
4. **Enclosure ボーナス** を `finalScore` に加算（`enclosureBonusMult` で調整可能にする）

---

## パラメータ追加案（EdgeSwapScoreParams）

```ts
// 6x6 以下用（未指定時は通常パラメータを使用）
size6AdjPenaltyScale?: number;      // 0.2 → 隣接ペナルティを 1/5 に
size6AdjRateT3?: number;            // 0.65 → 第3しきい値を緩和
size6DominanceThreshold?: number;   // 0.65
size6DominancePenaltyScale?: number; // 0.3 → 支配ペナルティを 30% に
enclosureBonusPerCount?: number;     // 80 → 囲い込み 1 件あたりの加点
```
