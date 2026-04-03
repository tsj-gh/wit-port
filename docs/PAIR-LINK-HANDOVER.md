# Pair Link（ナンバーリンク）開発 引き継ぎ要約

## プロジェクト概要

- **正式名**: ペアリンク（ナンバーリンク）
- **場所**: `c:\Users\g2yu\Documents\home\wispo`
- **ゲーム**: 同じ数字を線で繋ぎ、盤面の全マスを埋める知育ロジックパズル。ドラッグでスムーズに線を引く。

---

## ファイル構成

```
src/app/lab/pair-link/
├── page.tsx           # ページ＋メタデータ＋説明セクション
├── PairLinkGame.tsx   # メインコンポーネント（約580行）
└── actions.ts         # Server Actions（生成・検証）

src/lib/puzzle-engine/
└── pair-link.ts       # パズルエンジン（サーバー専用、約500行）

src/hooks/
└── usePuzzleStock.ts  # パズルプリフェッチ・在庫管理
```

---

## 主要な型・定数

### 型（pair-link.ts）

```typescript
type Pair = { id: number; start: [number, number]; end: [number, number] };
type NumberCell = { x: number; y: number; val: number; color: string };
type PuzzleResult = { numbers: NumberCell[]; pairs: Pair[]; gridSize: number; pairCount: number };
```

### 型（PairLinkGame.tsx）

```typescript
type PathPoint = { x: number; y: number };
type HitTarget =
  | { type: "endpoint"; val: string; pathIdx: number; point: PathPoint; isFirst: boolean }
  | { type: "number"; x: number; y: number; val: number };
```

### 定数

```typescript
const PADDING = 50;                    // キャンバス余白
const HIT_RADIUS_FACTOR = 0.55;       // 当たり判定（spacingに対する倍率）
const STORAGE_KEY = "pair-link_completed";  // クリア履歴（localStorage）
const STOCK_MAX = 3;                   // パズル在庫上限（usePuzzleStock）
const STOCK_REFILL_THRESHOLD = 2;     // 在庫切れで補充開始
```

---

## アーキテクチャ概要

### 1. パズル生成（サーバー専用）

- `src/lib/puzzle-engine/pair-link.ts`: 唯一解パズル生成
- DFS＋解の個数制限で一意解を探索
- SAT solver（`solveSat`）による検証
- gridSize: 4, 6, 8, 10 対応
- pairCount: 4→3, 6→5, 8→7, 10→9

### 2. Server Actions（actions.ts）

- `generatePuzzleAction(gridSize)`: パズル生成
- `validatePathsAction(paths, pairs, gridSize)`: 線の正当性検証

### 3. 在庫管理（usePuzzleStock）

- sessionStorage でパズル在庫（最大3個）をキャッシュ
- `getPuzzle(size)`: 在庫から取得、空なら生成
- `prefetch()`: 背景でプリフェッチ
- `PuzzleStockPrefetcher`: トップページで事前プリフェッチ

### 4. ゲームロジック（PairLinkGame）

- **paths**: `Record<string, PathPoint[][]>` — 数字ごとに複数経路（開始〜終了前は2本）
- **線の描画**: 数字・端点タップで開始、隣接マスへドラッグで延伸
- **マージ**: 2本の経路が同じマスで交差したとき、数字-数字で繋がっていれば1本にマージ
- **戻し**: 直前のマスに戻るドラッグで経路を短縮
- **クリア判定**: `validatePathsAction` でサーバー検証、全マス埋まりかつルール違反なし

---

## 座標系・当たり判定

- `getGridPos(clientX, clientY)`: クライアント座標→グリッド座標（拡縮対応）
- `getCanvasPos(clientX, clientY)`: クライアント座標→キャンバスピクセル座標
- `findNearestHit(clientX, clientY)`: 端点・数字の当たり判定（`HIT_RADIUS_FACTOR * spacing`）
- `rect` と `scaleX/scaleY` で表示サイズと内部座標の差異を吸収

---

## ポインターイベント

- `onPointerDown`: 端点または数字をタップで描画開始、`setPointerCapture`
- `onPointerMove`: window リスナー（キャンバス外でも継続）
- `onPointerUp`: 描画終了、孤立した数字の経路復元、`checkClear` 実行
- 描画中は `activeVal`, `activePathIdx`, `isDrawing` で状態管理
- `mergeJustHappenedRef`, `mergeIndexRef` でマージ直後の二重処理を防止

---

## 状態一覧

| 状態 | 説明 |
|------|------|
| gridSize | 4, 6, 8, 10 |
| numbers | 数字マスの配置・色 |
| pairs | 開始・終了座標 |
| paths | 線の経路データ |
| loading, status | 生成中・エラー表示 |
| solved, showClearOverlay | クリア判定・ポップアップ |
| timeSeconds, timerActive | タイマー |
| isDrawing, activeVal, activePathIdx | 描画中の経路 |
| puzzleKey | 再マウント用 |

---

## 描画（Canvas）

- `paths` に基づいて線・端点円・数字を描画
- アクティブ経路はやや細く、半透明
- `numbers` の色で線・円・数字を統一
- `spacing` と `canvasPixelSize` でレスポンシブ対応

---

## 注意点・制約

1. **pair-link エンジン**: サーバー専用。クライアントにインポートしない。
2. **パズル生成**: 10×10 は時間がかかる場合がある（数秒程度）。
3. **マージ条件**: 両端点が数字で、かつ異なる数字から伸びた経路のときだけマージ可能。
4. **経路の分離**: 同じ数字から2本出る場合、pathList が2要素（[経路A, 経路B]）になる。
5. **クリア履歴**: `localStorage` の `pair-link_completed` に保存。

---

## 開発時の参照先

- 線の延伸ロジック: `handlePointerMove` 内の `setPaths`
- マージ処理: `oPath` との終点一致判定ブロック
- クリア検証: `validatePaths`（pair-link.ts）
- 当たり判定: `findNearestHit`, `HIT_RADIUS_FACTOR`
