# タップぬりえ（Tap Coloring）仕様書

本書は Wispo 知育ラボ「タップぬりえ」の**実装に基づく**機能仕様・データ仕様・画面構成・関連ファイル一覧を 1 ファイルにまとめたものです。バージョンはリポジトリ現行実装を指します。

---

## 1. 概要

| 項目 | 内容 |
|------|------|
| 正式名称（UI） | タップぬりえ（英語ヘッダ: Tap Coloring） |
| ルート | `/lab/tap-coloring` |
| 目的 | パレットから色を選び、線画の領域をタップで塗る。達成後は次の線画へ遷移。作品はローカル履歴・高解像度エクスポートで保存・共有可能。 |
| 主要技術 | Next.js 14（App Router）、React 18、Canvas 2D、Framer Motion、`localStorage` |

---

## 2. ページ構成・SEO

### 2.1 エントリ

- **ページコンポーネント**: `src/app/lab/tap-coloring/page.tsx`
- **ラッパー UI**: `TapColoringLabShell`（`Suspense` 内）
- **誤操作防止**: ページ先頭に `SmartGuardLock`（ダブルタップでスクロールロック解除。ロック中は `body` のオーバーフロー制御・コンテキストメニュー等を抑制）
- **知育解説**: `TapColoringEducationalI18n`（折りたたみ。文言は `locales/ja.json` / `locales/en.json` の `educational.tapColoring`）
- **他ゲーム誘導**: `OtherPuzzlesSection`（`currentId="tap-coloring"`）

### 2.2 メタデータ

- `metadata` は `src/lib/gameLabPageSeo.ts` の `gameLabPageSeo.tapColoring` を参照
- `robots`: **index: false, follow: false**（検索インデックス対象外）
- `alternates.canonical`: `NEXT_PUBLIC_SITE_URL` ベースの `/lab/tap-coloring`
- **JSON-LD**: `buildGameSoftwareApplicationJsonLd("tap-coloring", SITE_URL)` を `<script type="application/ld+json">` で埋め込み

### 2.3 レイアウト（Shell）

`TapColoringLabShell`（`src/components/lab/TapColoringLabShell.tsx`）

- **ブレークポイント**: `max-width: 1023px` をモバイル、`lg`（1024px〜）を PC 相当として `isMobileLayout` を切替
- **1 行目**: `GamePageHeader`（タイトル）
- **メイン列**（`GAME_COLUMN_CLASS`、大画面では `lg:flex-row`）:
  - **左**: 角丸 `section` 内に `ColoringCanvas`
    - モバイル: `deferSceneBackgroundToShell` によりシーン背景色は **Shell の `section` の `style.backgroundColor`** に同期（1s linear）。Canvas 側は透過アニメ
    - PC: 同 `section` の**右上**に条件付き「編集終了」ボタン（履歴編集かつ終了可能時）
  - **モバイルのみ**: `section` の直下・ギャラリー直上に全幅の強調「編集終了」ボタン（同上条件）
  - **ギャラリー**: `TapColoringGallery` を **モバイルは主列下（`lg:hidden`）**、**PC は右 `aside` 内（`hidden lg:block`）** に二重配置（同一 props 系だがクラスで表示切替）
- **`aside`（PC）**: モバイル用「あそびかた」`<details>`、PC 用「あそびかた」常設ブロック、広告スロット #2、デスクトップ用ギャラリー
- **ページ下部**: `GameQuickInfoNote`（ねらい・対象・操作の固定短文）

### 2.4 開発者向け（devtj）

- URL クエリ `?devtj=true` のとき、固定位置に「DEBUG OFF」ボタン → `coloringRef.setDebugMode(true)`。デバッグ中はボタンを視覚的に隠す等の制御あり

---

## 3. コアゲーム仕様（ColoringCanvas）

実装: `src/components/lab/ColoringCanvas.tsx`（巨大コンポーネント。以下は仕様の要約）

### 3.1 アセット

- **線画 SVG（Canvas 用）**: `public/assets/tap-coloring/Pictures/SVG/Picture_*.svg` を `Image` で読み込み `drawImage`（拡大・回転でもボケにくい）
  - どうぶつ `Picture_Animal_01`〜`12`（12）、やさい・くだもの `Picture_Produce_01`〜`10`（10）、のりもの `Picture_Vehicle_01`〜`12`（12）。計 **34**。従来 PNG は `Pictures/` に残置可
- **スプラッター（インク粒）**: 質感維持のため **PNG** `public/assets/tap-coloring/Splatter/splatter_01.png`〜`09.png`。既塗り領域への重ねは乗算に近いブレンド後に色相ステップ
- **額縁（エクスポート用）**: **SVG** `public/assets/tap-coloring/Frame/SVG/frame_01.svg`〜`03.svg`（`tapColoringExport.ts` の `FRAME_CONFIG`）
- **書き出し**: `TAP_COLORING_EXPORT_SUPER_SCALE`（既定 2）で合成後に拡大焼き込み。WebP 対応端末は `image/webp`、それ以外は PNG

### 3.2 解像度・表示

- 表示キャンバスはレイアウトに応じた論理サイズ `size`（初期 360 付近、リサイズで更新）
- **内部ビットマップ倍率**: `TAP_COLOR_INTERNAL_SCALE = 2`（ジャギー抑制）
- **塗り判定**: マスク＋塗りレイヤー。領域内の塗り占有率が閾値（既定 0.9）で「完成」扱いへ
- **スプラッター半径・線タップ探索半径** 等は定数化。`devtj` + デバッグ UI から一部を上書き可能

### 3.3 パレット

- 基盤は **12 色相環**（純赤 H0 はランダム三つ組パレットから除外しやすい設計）
- **新規プレイ**: `pickTriadPalette()` で 3 色
- **履歴から再開**: 保存済み `paletteSwatches`（3 色・hex 検証済み）があれば復元、なければ三つ組を生成

#### 3.3.1 色の重ね合わせ（「色相環を選択色側へ寄せる」離散モデル）

重ね塗りは **顔料の減法混色でも、RGBA の線形アルファ合成でもない**。実装は次のとおり。

1. 画面上の「混ざり」を **12 個の固定色相アンカー**（HSL 色相 \(h \in \{0^\circ,30^\circ,\ldots,330^\circ\}\)、**彩度 100%・明度 50%** に相当する `hslToHex` 変換）の RGB ベクトル集合 \(\{P_0,\ldots,P_{11}\}\) 上の **離散ランダムウォーク**として表現する。
2. 既に塗られたピクセルに、新しいスプラッターが重なると、ピクセル RGB を **現在色に最も近いアンカー**に量子化し、そのインデックスから **選択色に最も近いアンカー**の方向へ、**環上の最短弧に沿って 1〜2 ステップ**（場合によっては即ジャンプ）だけ進める。

以下、実装 `ColoringCanvas.tsx` の `paintAt` 内ループ（`getImageData` ピクセル処理）に対応する数式化である。

##### アンカー色の定義

色相インデックス \(i \in \{0,\ldots,11\}\) に対し、コード上の色相角は

\[
\phi_i = 30^\circ \times i
\]

で、`hslToHex(\phi_i,\,100\%,\,50\%)\) により sRGB へ写像される（内部は HSL→RGB の区分的線形変換。実装は `ColoringCanvas.tsx` 先頭付近の `hslToHex`）。

アンカー RGB を \(P_i=(R_i,G_i,B_i)\) と書く（`FULL_PALETTE_RGB[i]` と同一）。

##### 任意 RGB → 最寄りアンカー（量子化）

ピクセル色 \(X=(R,G,B)\) に対し、**ユークリッド距離の二乗**が最小となるインデックスを採用する。

\[
k(X)=\arg\min_{i\in\{0,\ldots,11\}} \; D^2(X,P_i),\qquad
D^2(X,P_i)=(R-R_i)^2+(G-G_i)^2+(B-B_i)^2
\]

同率タイのときは、実装は単純な `for` ループで **小さい \(i\) が優先**される（先勝ち）。

**注**: 知覚的には CIELAB 上の \(\Delta E\) の方が自然だが、本実装は **sRGB 直空間の距離**であり、等色相線上の知覚的一様性は保証しない。

##### 環上の距離（12 分割トーラス）

インデックス差の「最短歩数」を

\[
\delta(i,j)=\min\bigl(|i-j|,\;12-|i-j|\bigr)
\]

と定める。隣接色は \(\delta=1\)、対極は \(\delta=6\)。

##### 1 歩だけ「\(j\) 側へ」進める写像 \(S(i,j)\)

\(i=j\) なら \(S=i\)。そうでなければ、時計回りに進む歩数 \(d_{\mathrm{cw}}\) と反時計回りに進む歩数 \(d_{\mathrm{ccw}}\) を

\[
d_{\mathrm{cw}}(i,j) = (j-i) \bmod 12,\qquad
d_{\mathrm{ccw}}(i,j) = (i-j) \bmod 12
\]

として（いずれも \(0,\ldots,11\) の整数）、**短い方の弧**へ 1 ステップ進む。

\[
S(i,j)=
\begin{cases}
(i+1)\bmod 12 & \text{if } d_{\mathrm{cw}} \le d_{\mathrm{ccw}} \\[4pt]
(i+11)\bmod 12 & \text{otherwise}
\end{cases}
\]

**タイブレーク**: \(\delta(i,j)=6\)（対極）では \(d_{\mathrm{cw}}=d_{\mathrm{ccw}}=6\) となり、**常に時計回り**（\(i+1\)）が選ばれる。

これがコメントにある「最短弧、同距離は時計回り」に対応する。

##### 重ね塗り 1 タップあたりの適応ステップ数 \(H(i,j)\)

`hueStepAdaptive(i,j)` は、現在のアンカー \(i=k(X_{\mathrm{cur}})\) と、タップで選ばれた色の最寄りアンカー \(j=k(P_{\mathrm{sel}})}\) に対し次を返す（\(i\neq j\) のとき）。

- \(\delta(i,j)=1\) のとき: **即座に** \(j\) へ飛ぶ（\(\;H(i,j)=j\;\)）。隣接色相なら 1 タップで「選択側のアンカー色」にスナップする。
- \(\delta(i,j)\in\{2,3\}\): **1 回**だけ \(S\) を適用（\(\;H(i,j)=S(i,j)\;\)）。
- \(\delta(i,j)\in\{4,5,6\}\): **2 回** \(S\) を連鎖（\(\;H(i,j)=S(S(i,j),j)\;\)）。遠い色相ほど、1 タップで複数ステップ分「自分（選択色）側」へ寄せる。

\(i=j\) のときは \(H(i,j)=i\)。

##### ピクセル更新ルール（スプラッター重ね合わせ）

1 タップで、スプラッター形状に対応するバウンディング矩形内の各ピクセルについて、スプラッターアルファを \(s_a\)、既存ペイントアルファを \(a\) とする（実装は 8bit チャンネル）。

- **スプラッターが実質無い**ピクセル: \(s_a < 24\) のときはスキップ（変更なし）。
- **未塗り領域**（\(a < 28\)）: 選択色の RGB \(C_{\mathrm{sel}}\) をそのまま代入し、\(a\leftarrow 255\)。
- **既塗り**（\(a \ge 28\)）: 「重ね合わせ」として
  \[
  i \leftarrow k\bigl(X_{\mathrm{cur}}\bigr),\quad
  j \leftarrow k(C_{\mathrm{sel}}),\quad
  i' \leftarrow H(i,j),\quad
  X_{\mathrm{new}} \leftarrow P_{i'}
  \]
  とし、\(a\leftarrow 255\)。

ここで \(j\) は **パレット上の任意の #rrggbb**（三つ組の微妙な色）でもよく、まず \(k(C_{\mathrm{sel}})\) で **12 分割環上の「ターゲット頂点」**に射影される。その後 \(H\) が **現在ピクセルを環上で \(j\) 方向へ引き寄せる**ので、ユーザー向けコピーでいう「重なった部分は鮮やかに混ざる」は、厳密には **離散色相の中間色（アンカー間の補間）を複数タップで段階的に通過する**挙動として実現している。

##### スプラッター描画との関係

スプラッター形状は PNG を着色したあとシャドウを付け `getImageData` しており、重ね判定は **アルファの閾値**で行う。色の更新は上記の離散ルールのみで、**アルファブレンドによる連続混色は行わない**（常に不透明 \(a=255\) へ正規化）。

##### 実装上の関数対応表

| 数式 | 実装名 |
|------|--------|
| \(k(X)\) | `nearestHueIndexFromRgb` |
| \(\delta(i,j)\) | `circularHueDistance` |
| \(S(i,j)\) | `hueStepOnceToward` |
| \(H(i,j)\) | `hueStepAdaptive` |

### 3.4 ゲームフェーズ（概念）

型 `ColoringPhase`: `play` | `success` | `transition` | `setup` | `resume`

- **play / resume**: 通常塗り
- **success**: 達成演出（スプラッシュ等）後、一定時間経過で次ステージの `transition` へ
- **transition**: 次の線画へのスライド等
- **setup**: 新しい線画の初期化
- 次の線画インデックスは **`pickRandomPictureIndex`** により、**直前と異なるカテゴリ**を優先してランダム選択

### 3.5 シーン背景色

- Canvas 内で `sceneBgColor` を更新（パステルランダム等のロジックあり）
- Shell へ `onSceneBgColorChange` で通知し、モバイル時は外枠 `section` の背景として表示

### 3.6 履歴編集フロー（深さ演出）

- **再開**: `loadHistoryEntry` が成功すると、現在の表示をスタッシュし、**enter オーバーレイ**（縮小→履歴拡大）経由で履歴の絵・パレットへ切替
- **編集中**: `editingHistoryId` と ref による `editingHistoryEntryRef`。ペイント読み込み完了後に **`showHistoryExitButton` 相当の状態**が true になり、Shell の「編集終了」・ギャラリーカードの「編集終了」が有効化
- **終了**: `exitHistoryEditing` / `handleHistoryExitClick` — 表示からプレビュー・ペイント PNG を生成し `updateTapColoringHistoryEntry`、**exit オーバーレイ**（外向き縮小→スタッシュ拡大）の後 `completeHistoryExit` で元セッション復帰
- シーケンス中は `onHistorySequenceInteractionChange(false)` により Shell 側 **`isLocked`** が true → ギャラリー・モーダルの操作を無効化

### 3.7 公開 API（Imperative Handle）

型: `ColoringCanvasHandle`（`ColoringCanvas.tsx` エクスポート）

| メソッド | 役割 |
|----------|------|
| `loadHistoryEntry(entry)` | 履歴をキャンバスに読み込み編集開始。オーバーレイ中・既に編集中は false |
| `exitHistoryEditing()` | 履歴編集を終了（保存更新＋退出アニメ）。内部は `handleHistoryExitClick` |
| `saveCurrentWorkToHistory()` | 現在の塗りを履歴先頭に追加（簡易プレビュー経路） |
| `saveCurrentWorkToHistoryWithPreview(previewDataUrl)` | 合成済みプレビュー data URL を付けて履歴追加（モーダル「いまの塗りを保存」用） |
| `composeHighResExport(options)` | 表示キャンバスを `redrawDisplay` した上で `composeTapColoringExport(display, options)` を実行し PNG data URL |
| `setDebugMode(enabled)` | デバッグパネル表示 |

### 3.8 Shell 連携コールバック

| コールバック | 用途 |
|--------------|------|
| `onHistoryUpdated` | 履歴件数・内容が変わった通知 |
| `onHistoryEntryReplaced(id)` | 履歴 1 件の差し替え直後（Shell でサムネ揺れ `shakeEntryId`） |
| `onHistorySequenceInteractionChange(allowed)` | `allowed === false` で作品履歴まわりロック |
| `onSceneBgColorChange(color)` | モバイル外枠背景色 |
| `onHistoryEditChromeChange({ editingId, exitReady })` | 編集中履歴 ID と「編集終了」ボタン表示可否 |
| `onDebugModeChange` | Shell の DEBUG ボタン表示制御 |
| `deferSceneBackgroundToShell` | モバイル true で Canvas 背景アニメを透過化 |

---

## 4. 作品履歴（ギャラリー）

### 4.1 データモデル・永続化

実装: `src/lib/tapColoringHistory.ts`

- **ストレージキー**: `wispo:tap-coloring:gallery:v1`
- **最大件数**: **5**（`MAX_ENTRIES`）
- **プレビュー長辺上限**: 512px 相当で縮小（`PREVIEW_MAX_SIDE`）
- **エントリ型 `TapColoringHistoryEntry`**
  - `id`, `createdAt`, `pictureId`, `savedBitmapSize`
  - `paintDataUrl`（ペイント層のみ・PNG data URL）
  - `previewDataUrl`（一覧・エクスポート用の縮小合成）
  - 任意: `isPinned`, `paletteSwatches`（3 色）, `paletteSelectedColor`
- **トリム方針**: 超過時は**末尾から未ピンを優先削除**。未ピンが無い場合のみ末尾削除
- **主要 API**: `readTapColoringHistory`, `prependTapColoringHistory`, `updateTapColoringHistoryEntry`, `toggleTapColoringHistoryPinned`, `buildPreviewDataUrlFromDisplay`

### 4.2 UI（TapColoringGallery）

実装: `src/components/lab/TapColoringGallery.tsx`

- グリッドで最大 5 件を表示（`grid-cols-2` → ブレークポイントで 3 列等）
- **ピン留め**: カード左上。`toggleTapColoringHistoryPinned`。ピン時はリング色に `TAP_COLORING_VIVID_YELLOW_HEX`（`src/lib/tapColoringPalette.ts`）
- **再開**: サムネクリック → `coloringRef.loadHistoryEntry`
- **保存・共有**: フッターボタン → `TapColoringExportModal`（`mode: "history"`）
- **編集中の該当カード**: `editingHistoryEntryId === entry.id` のときフッターを **「編集終了」** に差し替え → `exitHistoryEditing()`
- **`isLocked`**: オーバーレイ・シーケンス中はトーストで拒否し、ボタン disabled

---

## 5. 保存・エクスポートモーダル

実装: `src/components/lab/TapColoringExportModal.tsx`

### 5.1 モード

- **`current`**: タイトル「作品を保存」。プレビューは `coloringRef.composeHighResExport(exportOptions)`。確定で `saveCurrentWorkToHistoryWithPreview(preview)` → 履歴更新コールバック
- **`history`**: タイトル「作品を保存・共有」。履歴の `previewDataUrl` を画像として読み込み `composeTapColoringExport(historyArt, options)`。確定で **ファイルダウンロード**（`tap-coloring-{pictureId}-{createdAt}.png`）

### 5.2 ユーザー調整項目

- 絵のスケール（0.5〜1.5）、回転（-180〜180°）、ロゴ余白（2〜8%、既定 3%）
- 額縁のオンオフ、日付のオンオフ、額縁バリアント（01〜03）、背景色プリセット（`EXPORT_SURFACE_PRESETS`）

### 5.3 共有

- `navigator.share` + `canShare({ files })` が使える場合、PNG ファイルとカスタム文言で共有。不可時はトーストで案内

### 5.4 合成パイプライン（tapColoringExport）

実装: `src/lib/tapColoringExport.ts`

- **入力**: アートソース（表示キャンバスまたは履歴プレビュー画像）＋ `TapColoringExportOptions`
- **手順概要**:
  1. 額縁 PNG を読み込み、**透明領域の flood fill** から**内枠（額縁の窓）矩形**を検出（失敗時はフレームごとのフォールバック余白率）
  2. 全キャンバスを背景色で塗る
  3. アートを正方形化し flood fill で**外周の白**を背景色に置換（額縁内の白は保持しやすい）
  4. 内枠へ cover 配置＋回転
  5. オプションで額縁 PNG を上乗せ
  6. **ロゴ**（`/assets/logo/logo_wispo.png`）＋任意で**日付**（`Zen Maru Gothic` 系フォントスタック）。背景輝度に応じ `pickExportUiStyle` で**ロゴのピクセル反転**（iOS の `filter` 不具合回避）と日付色を切替
  7. ロゴ＋日付ブロックの位置は内枠右側で **BR / TR / RM** のスコア最小（絵との被り率低）を選択
- **出力**: 額縁画像の**自然画素寸法**に一致する PNG data URL

---

## 6. 国際化・固定コピー

- **知育折りたたみ**: `locales/ja.json` / `en.json` の `educational.tapColoring`（summary / h3_dev / p_dev …）
- **Shell 内「あそびかた」**: 現状 **コンポーネント内の日本語固定**（モバイル `details` / PC `section` で同一文）
- **GameQuickInfoNote**: 日本語固定（ねらい・対象・操作）

---

## 7. 依存・関連ファイル一覧

| 種別 | パス |
|------|------|
| ページ | `src/app/lab/tap-coloring/page.tsx` |
| Shell | `src/components/lab/TapColoringLabShell.tsx` |
| Canvas | `src/components/lab/ColoringCanvas.tsx` |
| ギャラリー | `src/components/lab/TapColoringGallery.tsx` |
| エクスポート UI | `src/components/lab/TapColoringExportModal.tsx` |
| 履歴 lib | `src/lib/tapColoringHistory.ts` |
| 合成 lib | `src/lib/tapColoringExport.ts` |
| 定数（黄など） | `src/lib/tapColoringPalette.ts` |
| SEO 定数 | `src/lib/gameLabPageSeo.ts` |
| レイアウト定数 | `src/lib/gameLayout.ts`（`GAME_COLUMN_CLASS` 等） |
| JSON-LD | `src/lib/gameSoftwareApplicationJsonLd.ts` |
| 知育 i18n | `src/components/educational/GameEducationalI18n.tsx`、`src/components/educational/EducationalValueSection.tsx` |
| 誤操作ロック | `src/components/lab/SmartGuardLock.tsx` |
| ヘッダー | `src/components/GamePageHeader.tsx` |
| 脚注 | `src/components/lab/GameQuickInfoNote.tsx` |
| 文言 | `locales/ja.json`, `locales/en.json`（`educational.tapColoring`） |
| 静的アセット | `public/assets/tap-coloring/**`、`public/assets/logo/logo_wispo.png` |

---

## 8. 既知の運用・制約

- 履歴は **ブラウザの `localStorage` のみ**。端末・ブラウザを変えると共有されない。容量超過時は `writeAll` が失敗しても握りつぶし
- ラボページは **noindex** のため、検索流入は想定していない設計
- `SmartGuardLock` はページ全体のスクロール挙動に影響するため、他セクションとの併用時は挙動に注意

---

## 9. 変更履歴（ドキュメント）

| 日付 | 内容 |
|------|------|
| 2026-04-18 | 初版作成（実装ベースの仕様整理） |
| 2026-04-18 | §3.3.1 重ね塗りの 12 色環・距離・適応ステップの数式追記 |
