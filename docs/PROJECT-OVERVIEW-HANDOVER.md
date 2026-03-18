# Wispo / Wit-Spot プロジェクト概要・全体構成 引き継ぎ要約

## プロジェクト概要

- **プロジェクト名**: Wispo（リポジトリ名: wispo）
- **製品名**: Wit-Spot（ウィスポ）— 知育スポーツの拠点
- **場所**: `c:\Users\g2yu\Documents\home\wispo`
- **コンセプト**: 直感と論理を交差させる知育ロジックゲームを無料提供。ペアリンク、スカイスクレイパー、Pres-Sure Judge の3ゲームを収録。

---

## サイト構成（ルーティング）

```
/                 # トップページ（ゲーム一覧）
/games/pair-link  # ペアリンク（ナンバーリンク）
/games/skyscraper # 空の上から（スカイスクレイパー・ビルパズル）
/games/pres-sure-judge  # Pres-Sure Judge（天秤サバイバル）
/privacy          # プライバシーポリシー
/contact          # お問い合わせ（Google Forms 埋め込み）
```

---

## ファイル構成（全体）

```
src/
├── app/
│   ├── layout.tsx        # ルートレイアウト（メタデータ、AdSense Script、Footer）
│   ├── template.tsx      # 全ページ共通の PageTransition ラップ
│   ├── globals.css       # グローバルスタイル、wit- CSS 変数
│   ├── page.tsx          # トップページ
│   ├── privacy/page.tsx  # プライバシーポリシー
│   ├── contact/page.tsx  # お問い合わせ
│   └── games/
│       ├── pair-link/    # ペアリンク
│       ├── skyscraper/   # スカイスクレイパー
│       └── pres-sure-judge/  # Pres-Sure Judge
├── components/
│   ├── Footer.tsx            # フッター（トップ / プライバシー / お問い合わせ）
│   ├── PageTransition.tsx    # ページ遷移アニメーション（framer-motion）
│   └── PuzzleStockPrefetcher.tsx  # トップ表示時にペアリンク在庫を prefetch
├── hooks/
│   └── usePuzzleStock.ts    # ペアリンク用パズル在庫管理
└── lib/
    └── puzzle-engine/       # pair-link.ts, skyscrapers.ts（サーバー専用）

public/
├── ads.txt         # AdSense 発行者証明
├── manifest.json   # PWA manifest
└── icons/          # PWA アイコン（icon-512.png）
```

---

## トップページ（`src/app/page.tsx`）

### 構成

- **ヘッダー**: Wit-Spot ロゴ（グラデーションスパン）リンク
- **ヒーロー**: 「知育スポーツの拠点」キャッチコピー、サブコピー
- **ゲームカード**: 3枚グリッド（md:grid-cols-3）
  - ペアリンク: `/games/pair-link`、青アクセント
  - 空の上から: `/games/skyscraper`、エメラルドアクセント
  - Pres-Sure Judge: `/games/pres-sure-judge`、アンバーアクセント
- **AD スペース**: `aria-label="広告スペース"` のプレースホルダ（現状は「AD」テキストのみ）

### カード共通の挙動

- `hover:-translate-y-2`、`hover:shadow-wit-*-hover`、`after:` のラジアルグラデーション
- 「出航する（Play）」/「挑戦する（Play）」ボタン＋矢印 SVG
- `animate-float` で絵文字が浮遊アニメーション

### プリフェッチ

- `PuzzleStockPrefetcher`: トップ表示時に `usePuzzleStock({ gridSize: 6 })` でペアリンクを prefetch
- ペアリンク遷移時の初回待ち時間を短縮するため

---

## ルートレイアウト（`src/app/layout.tsx`）

- **metadata**: title template `%s | Wit-Spot`、metadataBase、keywords、openGraph
- **AdSense Script**: `strategy="afterInteractive"`、client=`ca-pub-5383262801288621`
- **body**: `bg-gradient-to-br from-wit-bg to-wit-bg-2`、min-h-screen flex flex-col
- **Footer**: 全ページ共通で末尾に配置

---

## ページ遷移（`template.tsx`）

- `PageTransition` で全子ページをラップ
- framer-motion: `hidden` → `visible`（opacity 0→1、y 12→0、0.4s ease-out）

---

## デザイントークン・テーマ

### Tailwind（tailwind.config.ts）

| 色 | 値 | 用途 |
|----|-----|------|
| wit-bg | #0b1020 | 背景 |
| wit-bg-2 | #111827 | グラデーション背景 |
| wit-text | #f8fafc | 本文 |
| wit-muted | #94a3b8 | サブテキスト |
| wit-accent | #3b82f6 | アクセント（青） |
| wit-emerald | #10b981 | スカイスクレイパーなど |

### globals.css

```css
--wit-card-bg: rgba(30, 41, 59, 0.7);
--wit-border: rgba(255, 255, 255, 0.1);
--wit-accent-glow: rgba(59, 130, 246, 0.5);
```

### アニメーション

- `animate-fade-in-up` / `animate-fade-in-up-delay` / `animate-fade-in-up-delay-more`: トップページの段階表示
- `animate-float`: 絵文字の浮遊（6s ease-in-out infinite）

---

## フッター（`Footer.tsx`）

- ナビ: ウィスポ（トップ）｜プライバシーポリシー｜お問い合わせ
- © 2026 Wit-Spot. All rights reserved.
- `border-t border-[var(--wit-border)]`

---

## 共通ページパターン（ゲーム以外）

- ヘッダー: Wit-Spot ロゴ + 「← トップへ戻る」リンク
- `mx-auto max-w-[720px]` または `max-w-[680px]` で中央寄せ
- ゲームページは各ゲームごとに独自レイアウト（引き継ぎ資料は個別参照）

---

## PWA manifest（`public/manifest.json`）

- name: Wit-Spot（ウィスポ）| 知育スポーツの拠点
- short_name: ウィスポ
- start_url: /
- background_color: #0b1020
- theme_color: #3b82f6
- icons: /icons/icon-512.png（192x192, 512x512）

---

## 主要依存関係

- **Next.js** 14.2.x（App Router）
- **React** 18.3.x
- **framer-motion** 12.x（ページ遷移アニメーション）
- **canvas-confetti**（ゲームクリア演出）
- **@dnd-kit**（Pres-Sure Judge のドラッグ＆ドロップ）

---

## 環境変数

- `NEXT_PUBLIC_SITE_URL`: 本番 URL（default: https://wit-spot.vercel.app）
- メタデータ・JSON-LD などで参照

---

## 注意点・制約

1. **games フォルダ**: 各ゲームは page.tsx + Game コンポーネント + 必要に応じて actions.ts の構成。
2. **パズルエンジン**: pair-link.ts / skyscrapers.ts はサーバー専用。クライアントにインポートしない。
3. **PuzzleStockPrefetcher**: ペアリンク専用。スカイスクレイパー・Pres-Sure Judge は都度 Server Action で生成。
4. **広告スペース**: トップの AD エリアはプレースホルダ。AdSense 自動広告または手動配置で利用可能（`docs/ADSENSE-HANDOVER.md` 参照）。

---

## 開発時の参照先

- トップページ構成: `src/app/page.tsx`
- ルートレイアウト・メタデータ: `src/app/layout.tsx`
- デザイントークン: `tailwind.config.ts`, `src/app/globals.css`
- フッター・ナビ: `src/components/Footer.tsx`
- ページ遷移: `src/components/PageTransition.tsx`
- 個別ゲーム: `docs/PAIR-LINK-HANDOVER.md`, `docs/SKYSCRAPER-HANDOVER.md`, `docs/PRES-SURE-JUDGE-HANDOVER.md`
