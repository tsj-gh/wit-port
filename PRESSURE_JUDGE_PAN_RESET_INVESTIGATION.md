# 調査: Judge押下時に器のサイズが初期値に戻る原因

## 現象
Judgeボタンを押した直後、器（pan）の高さが初期値（PAN_MAX_VISIBLE_HEIGHT = 120px）に戻ってしまう。

## 器の高さの算出箇所
- 1364-1371行目（左器）、1395-1401行目（右器）
- `height: leftDisplay.length > 0 ? Math.max(PAN_MAX_VISIBLE_HEIGHT, max(y+height)) : PAN_MAX_VISIBLE_HEIGHT`

## データフロー
1. **leftDisplay** = applySinkIfNeeded(leftDisplayRaw)
2. **leftDisplayRaw** = [...leftPlaced, ...leftCurrent].sort()
3. **leftPlaced** = placedWeights.filter(side==="left")
4. **leftCurrent** = leftPanWeights から変換（逆順で y を割り当て）

## Judge押下時の処理順（performResolution）
1. setPlacedWeights(prev => [...prev, ...newPlaced])  // 新アイテムを追加
2. setLeftPanWeights([])   // クリア
3. setRightPanWeights([])  // クリア
4. setPhase("transition")

## 想定される原因

### 原因1: React の state 更新タイミング
- 上記4つの setState がバッチされ、1回のレンダーで反映される想定
- しかし **setPlacedWeights のコールバック内で prev を使う処理と、その後の setPhase などが同じイベント内で実行される**
- React 18 の自動バッチでは同一イベント内の更新はまとまるが、何らかの理由で `placedWeights` の更新が次のレンダーに回る場合、一時的に「新アイテムが追加される前の placedWeights」でレンダーされる可能性がある

### 原因2: 更新後のデータ状態
Judge 後の想定状態:
- placedWeights: 前ラウンド分 + 今回の newPlaced（leftItems, rightItems）
- leftPanWeights: []
- rightPanWeights: []

このとき:
- leftDisplayRaw = leftPlaced のみ（leftCurrent は空）
- rightDisplayRaw = rightPlaced のみ（rightCurrent は空）

**もし placedWeights に newPlaced がまだ含まれていない**と:
- leftPlaced / rightPlaced に今回のアイテムが含まれない
- 器の高さは前ラウンド時点の値になり、積み上がり分が反映されず「初期値に戻った」ように見える

### 原因3: Framer Motion の layout アニメーション
- PlacedWeightBlock に `layout` が指定されている（167行目）
- 子要素の変化時にレイアウトアニメーションが走る
- その際、親（器の div）の高さが一瞬古い値で計算される可能性は低いが、挙動次第ではあり得る

## 推奨する確認・修正

1. **setPlacedWeights を確実に先に反映させる**
   - `flushSync` で setPlacedWeights を同期的に適用してから、他の setState を行う
   - または、performResolution 内で「今回追加するアイテム」を別 state で保持し、表示用の組み合わせを常に「placedWeights + pendingPlaced」として計算する

2. **pendingPlaced 方式（推奨）**
   - Judge 時に newPlaced を `pendingPlacedWeights` などの一時 state に格納
   - leftDisplay / rightDisplay の算出で `placedWeights` に加えて `pendingPlacedWeights` も使う
   - transition 開始時（または completeTransition 内）で placedWeights にマージし、pending をクリア
   - これにより、Judge 直後から「今回積んだ分」も確実に表示に含めることができる
