# Skyscraper（空の上から・ビルパズル）開発 引き継ぎ要約

## プロジェクト概要

- **正式名**: 空の上から（スカイスクレイパー / ビルパズル）
- **場所**: `c:\Users\g2yu\Documents\home\wispo`
- **ゲーム**: 外枠の数字（手がかり）をヒントに、各行・各列に 1〜N が1つずつ入るようにビルの高さを推理する知育ロジックパズル。メイビーモードで仮入力が可能。

---

## ファイル構成

```
src/app/games/skyscraper/
├── page.tsx           # ページ＋メタデータ＋JSON-LD＋知育効果セクション
├── SkyscraperGame.tsx # メインコンポーネント（約450行）
└── actions.ts         # Server Actions（生成・検証・ヒント・解答）

src/lib/puzzle-engine/
└── skyscrapers.ts     # パズルエンジン（サーバー専用、約300行）
```

※ Pair Link にある `usePuzzleStock` 等の在庫管理フックは使っていない。生成は都度 Server Action で行う。

---

## 主要な型・定数

### 型（skyscrapers.ts）

```typescript
type Clues = {
  top: (number | null)[];
  bottom: (number | null)[];
  left: (number | null)[];
  right: (number | null)[];
};
type Puzzle = { solution: number[][]; clues: Clues };
type Difficulty = "easy" | "normal" | "hard";
```

### 型（SkyscraperGame.tsx）

```typescript
type MaybeHistoryEntry = { r: number; c: number; prevVal: number };
```

### 定数

```typescript
const PUZZLE_COOKIE = "skyscraper_puzzle";  // 解答保存（1時間有効）
const COOKIE_MAX_AGE = 60 * 60;            // 1 hour
const STORAGE_KEY = "skyscraper_completed"; // クリア履歴（localStorage）
```

---

## アーキテクチャ概要

### 1. パズル生成（サーバー専用）

- **場所**: `src/lib/puzzle-engine/skyscrapers.ts`
- **流れ**:
  1. `latinBase(n)`: ラテン方陣のベース生成
  2. `permuteGrid()`: 行・列・数字の置換で解候補をランダム生成
  3. `computeClues()`: 解答から4辺の手がかり（可視数）を計算
  4. 難易度に応じて手がかりを削っていき、唯一解になるまで探索
- **難易度**:
  - easy: 手がかり残存率 75%（多め）
  - normal: 50%
  - hard: 35%（少なめ）
- **サイズ**: 4×4（入門）、5×5（標準）、6×6（上級）

### 2. Server Actions（actions.ts）

- `generatePuzzleAction(n, difficulty)`: パズル生成、解答を Cookie に保存
- `validateAnswerAction(grid, n)`: 解答が正解と一致するか検証
- `checkProgressAction(grid, clues, n)`: 途中判定（重複・手がかりとの整合）
- `hintAction(grid, n)`: ランダムに空マス1つを正解で埋める
- `solveAction(n)`: 正解を返す（解答表示用）

### 3. Cookie による解答管理

- 解答は Cookie（`skyscraper_puzzle`）に Base64 JSON で保持
- 検証・ヒント・自動解答はすべて Cookie の解答を参照
- 有効期限 1時間。期限切れ・不一致時は「新規生成してください」と案内

### 4. ゲームロジック（SkyscraperGame）

- **マス操作**:
  - クリック/タップ: 1→2→…→N→空白 と巡回（`cycleCell`）
  - 数字キー（1〜N）・Backspace: 選択マスに直接入力
  - 上スワイプ: インクリメント、下スワイプ: デクリメント
- **メイビーモード**: 仮の入力が可能。「入る」でスナップショット保存、「巻き戻し」で入る前の状態に戻す。「確定」で通常モードに戻る。
- **クリア判定**: 全マス埋まりかつ `validateAnswerAction` で正解確認

---

## メイビーモードの仕様

| 状態 | 説明 |
|------|------|
| maybeMode | メイビーモード中か |
| maybeGridSnapshot | メイビー入る時の盤面スナップショット |
| sinceMaybeHistory | メイビー中に変更したマスの履歴 |
| firstDeterminedCell | メイビー時点で最初に数字が入っていたマス（ピン表示） |

- 「入る」: `cloneGrid(grid)` でスナップショット保存、`firstDeterminedCell` を行優先で探索
- 「巻き戻し」: スナップショットで盤面を復元し、メイビー関連状態をクリア
- `isRewinding`: 巻き戻し時に UI の透明度を下げるフラグ（200ms でリセット）

---

## 状態一覧

| 状態 | 説明 |
|------|------|
| n | グリッドサイズ（4, 5, 6） |
| difficulty | easy / normal / hard |
| clues | 4辺の手がかり |
| grid | プレイヤー入力盤面 |
| solved, showClearOverlay | クリア判定・ポップアップ |
| maybeMode, maybeGridSnapshot, sinceMaybeHistory | メイビーモード関連 |
| firstDeterminedCell, isRewinding | メイビー時のピン表示・巻き戻し演出 |
| loading, status | 読み込み中・ステータスメッセージ |
| timeSeconds, timerActive | タイマー |
| selectedCellRef | 選択中のマス（キーボード入力先） |
| touchStartYRef, swipeHandledRef | スワイプ時の開始位置・二重処理防止 |

---

## スワイプ・ポインター処理

- **マウス**: `onMouseDown` で開始 Y、`onMouseUp` で delta 計算。delta > 15 で上スワイプ、delta < -15 で下スワイプ。
- **タッチ**: `onTouchStart` / `onTouchEnd` で同様。
- `swipeHandledRef`: スワイプ処理が行われた場合、続く `onClick` の `cycleCell` をスキップして二重反応を防止。

---

## 検証・ヒント・解答の流れ

1. **途中判定** (`checkProgressAction`): 行/列の重複チェック、手がかりとの可視数整合チェック。ルールベースで解答は不要。
2. **正解検証** (`validateAnswerAction`): Cookie の解答と1マスずつ比較。
3. **ヒント** (`hintAction`): 空マスをランダムに1つ選び、正解の値を返す。
4. **自動解答** (`solveAction`): Cookie の解答をそのまま返し、盤面に反映。

---

## 注意点・制約

1. **skyscrapers エンジン**: サーバー専用。クライアントにはインポートしない。
2. **パズル生成**: 唯一解探索の `countSolutionsWithClues` はノード数上限 5,000,000。maxTries=40 で試行。
3. **Cookie 有効期限**: 1時間。開発時はブラウザを開きっぱなしだと期限切れになり得る。
4. **クリア履歴**: `localStorage` の `skyscraper_completed` に `{ n, difficulty, timeSeconds, completedAt }` を配列で追加。
5. **メイビー中の cycleCell/setCellValue**: 変更時に `sinceMaybeHistory` に履歴を追加（巻き戻し用。現在は巻き戻しで一括復元するため未使用の可能性あり）。

---

## 開発時の参照先

- パズル生成・唯一解探索: `generateUniquePuzzle`, `countSolutionsWithClues`（skyscrapers.ts）
- メイビー入る/巻き戻し: `handleMaybeEnter`, `handleMaybeRewind`
- スワイプとクリックの分離: `swipeHandledRef` の利用箇所
- 可視数計算: `visibleCount`, `computeClues`
