# AdSense 周りの引き継ぎ要約

## 概要

- **プロジェクト**: Wit-Spot（wispo）
- **状態**: スクリプト読み込み・ads.txt・ペアリンク用広告2箇所配置・動的リフレッシュまで完了。

---

## ファイル構成

```
src/app/layout.tsx              # AdSense + GPT スクリプト読み込み（head 内）
src/lib/ads.ts                   # refreshAds() 共通関数（30秒Cooldown付き）
src/components/PairLinkAdSlots.tsx  # ペアリンク用広告ユニット（GPT 版）
src/app/games/pair-link/PairLinkGame.tsx  # 広告配置・トリガー呼び出し
public/ads.txt                   # 発行者検証（ルート直下）
```

---

## 実装内容

### 1. AdSense スクリプト（layout.tsx）

- **場所**: `src/app/layout.tsx` の `<head>` 内
- **読み込み方式**: `next/script` の `Script` コンポーネント
- **URL**: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5383262801288621`
- **オプション**:
  - `strategy="afterInteractive"`: ページインタラクティブ後に読み込み
  - `crossOrigin="anonymous"`: CORS 設定

```tsx
<Script
  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5383262801288621"
  strategy="afterInteractive"
  crossOrigin="anonymous"
/>
```

- **発行者 ID**: `ca-pub-5383262801288621`（本番用。環境変数での切り替えなし）

### 2. ads.txt（public/ads.txt）

- **パス**: `public/ads.txt` → 本番では `https://{ドメイン}/ads.txt` で配信
- **内容**:

```
google.com, pub-5383262801288621, DIRECT, f08c47fec0942fa0
```

- **用途**: プログラムmatic広告の不正利用防止、発行者の正規性検証。Google 推奨。

---

## 現状の広告表示

- **明示的な広告ユニット**: なし（`ins` 要素や専用コンポーネントは未使用）
- **自動広告**: AdSense 管理画面で「自動広告」を有効にしている場合は、スクリプト読み込みにより自動で広告が挿入される
- **手動配置**: 今後広告を増やす場合は、`data-ad-client` と `data-ad-slot` を持った `ins` 要素をページに追加する必要あり

---

## 注意点・制約

1. **発行者 ID**: 現状ハードコード。本番・検証環境を分ける場合は環境変数化を検討。
2. **ads.txt**: デプロイ先ドメインで `/ads.txt` が 200 で返ること、内容が正しいことを確認すること。
3. **Next.js**: `next/script` の `strategy` により、AdSense はインタラクティブ後に読み込まれ、LCP への影響を抑えている。
4. **環境**: `NEXT_PUBLIC_SITE_URL` は `metadataBase` などに使用。AdSense 自体は `NEXT_PUBLIC_SITE_URL` に依存していない。

---

## 今後の拡張例

広告ユニットを手動で配置する場合の例:

```tsx
<ins
  className="adsbygoogle"
  style={{ display: "block" }}
  data-ad-client="ca-pub-5383262801288621"
  data-ad-slot="xxxxxxxxxx"
  data-ad-format="auto"
  data-full-width-responsive="true"
/>
```

- `data-ad-slot`: AdSense 管理画面で作成した広告ユニットのスロット ID を指定
- 複数配置時は各ページやコンポーネントで適切なスロット ID を割り当てる

---

## 開発時の参照先

- スクリプト読み込み: `src/app/layout.tsx` L27–32
- ads.txt: `public/ads.txt`
- [AdSense コードの取得方法](https://support.google.com/adsense/answer/7477845)
- [ads.txt とは](https://support.google.com/adsense/answer/7532444)
