# Pres-Sure Judge 開発 引き継ぎ要約

## プロジェクト概要

- **場所**: `c:\Users\g2yu\Documents\home\wispo`
- **メインコンポーネント**: `src/app/games/pres-sure-judge/PresSureJudgeGame.tsx`（約2000行）
- **ゲーム**: 天秤バランス型ゲーム。在庫から重りをドラッグして右の器へ投げ、10秒以内に均衡を保つ

---

## 直近セッションでの主な実装・修正

### 1. 在庫コンテナの改良

- **高さ固定（Layout Shift防止）**  
  - モバイル: `h-[96px]`（2段）  
  - PC: `h-[56px]`（1段）  

- **横スクロール**  
  - `overflow-x-auto`, `flex-nowrap`（PC） / `flex-wrap`（モバイル）  

- **ジェスチャー分離**  
  - `onPointerDownCapture` で「アイテム」vs「デッドスペース」を判定  
  - アイテム: `data-inventory-item` 属性を持つ要素＋`itemHitAreaMarginPx`（デバッグ可変）  
  - デッドスペース: 横スライドのみ（ベジエ発射を完全無効化）  

- **慣性スクロール**  
  - リリース後、速度減衰（`v *= 0.92`）でスムーズに停止  

- **右側フェード（Affordance）**  
  - `inventoryHasMoreRight` 時に右端にグラデーション表示  

### 2. デバッグモード（`?devtj=true`）

- **DEBUG OFF ボタン**  
  - `isDebugMode === false` 時も表示し、クリックで再表示  

- **ビューポート疑似変更**  
  - PC / Mobile (375) / Tablet (768) ボタン  
  - `forcedWidth` でアーム長・コンテナ幅を変化  

- **モバイル版アーム長比率**  
  - LayoutParams に `armLengthRatio`（デフォルト 0.8）  
  - 「値を反映」で反映  

- **アイテム当たり判定マージン**  
  - `itemHitAreaMarginPx`（デフォルト 8）  
  - アイテムタッチ判定を微調整  

- **次のラウンドの在庫を2倍にする**  
  - `debugDoubleInventory` で `generateRoundInventory(INVENTORY_COUNT * 2)` を呼ぶ  

- **境界枠表示**  
  - 秒数表示も枠表示対象（赤点線）  

- **デバッグモード時レイアウト**  
  - `forcedWidth === 375` のときも在庫を2段表示（`flex-wrap`, `h-[96px]`）  

### 3. 支点座標の修正

- `SCALE_CONTAINER_PADDING_X = 10`  
- `fulcrumPos` を `scaleRect.left + PADDING` 基準で計算  
- 左右のアーム長を等しく、器の位置を揃えている  

### 4. スタートシーケンスの変更

- 左器に直接置くのをやめ、ラウンド跨ぎと同様に「在庫枠 → ベジエ発射 → 左器」で開始  

### 5. その他

- `scaleContainerWidth` 初期値は `Math.min(576, window.innerWidth)`  
- `forcedWidth` があるときは `effectiveScaleWidth` で座標計算  
- 「↓You +XX」「↑NPC +YY」のオフスクリーン表示を削除  

---

## 重要定数・型

```typescript
// LayoutParams (DEBUG_LAYOUT_DEFAULTS)
armLengthRatio: 0.8       // アーム長比率
itemHitAreaMarginPx: 8   // アイテムタッチ判定マージン
scaleWrapperTopOffset, scaleWrapperMaxOffset, armHeight, 等

// その他
INVENTORY_COUNT = 8
PAN_WIDTH = 128
SCALE_CONTAINER_PADDING_X = 10
ARM_HALF_MAX_PX = 186
```

---

## 主要な状態・参照

- `phase`: "ready" | "transition" | "user" | "gameover" | "result"
- `forcedWidth`: null | 375 | 768
- `inventoryContainerRef`, `dragConstraintRef`
- `layoutParams` / `layoutParamsDraft`（「値を反映」で同期）
- `isDebugMode`, `isDebugPanelExpanded`, `debugDoubleInventory`

---

## ファイル構成

```
src/app/games/pres-sure-judge/
├── PresSureJudgeGame.tsx  # メイン（天秤・在庫・ジェスチャー）
└── page.tsx              # ページラッパー
```

---

## 開発時の注意点

1. **ジェスチャー分離**: デッドスペースの `preventDefault` / `stopPropagation` を外すと、アイテムのベジエ発射と競合する  
2. **座標系**: スケールコンテナは `contentLeft = scaleRect.left + 10` を基準にしている  
3. **メディアクエリ**: `forcedWidth` があるときは `forcedWidth` を条件に含める（例: `forcedWidth === 375`）  
4. `.cursorrules` に従い、コミットメッセージは日本語で記載  

---

## 直近コミット履歴（参考）

```
fix(pres-sure-judge): デバッグMobileモード(forcedWidth=375)時も在庫を2段表示に
fix(pres-sure-judge): モバイル版アーム長比率のデフォルト値を0.8に変更
feat(pres-sure-judge): モバイル在庫2段表示・デバッグで在庫2倍テスト用チェックボックス追加
feat(pres-sure-judge): 在庫コンテナの高さ固定・横スライド・ジェスチャー分離を実装
...
```
