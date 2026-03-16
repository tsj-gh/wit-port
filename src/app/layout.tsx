import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://wit-port.vercel.app"),
  title: {
    default: "Wit-Spot（ウィスポ）| 知育スポーツの拠点",
    template: "%s | Wit-Spot",
  },
  description:
    "Wit-Spot（ウィスポ）は、知育スポーツの拠点。直感と論理を交差させるペアリンクやビルパズルなど、洗練された知育ロジックゲームを無料でお楽しみください。",
  keywords: ["知育", "パズル", "無料", "ロジックパズル", "ナンバーリンク", "スカイスクレイパー", "脳トレ"],
  openGraph: { type: "website" },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen flex flex-col overflow-x-hidden bg-gradient-to-br from-wit-bg to-wit-bg-2 text-wit-text font-sans antialiased">
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5383262801288621"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
        {children}
        <Footer />
      </body>
    </html>
  );
}
