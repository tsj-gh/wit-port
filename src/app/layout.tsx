import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Footer from "@/components/Footer";
import { I18nProvider } from "@/lib/i18n-context";
import { UserSyncProvider } from "@/components/UserSyncProvider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app"),
  title: {
    default: "Wispo（ウィスポ）| 知育スポーツの拠点",
    template: "%s | Wispo",
  },
  description:
    "Wispo（ウィスポ）は、知育スポーツの拠点。直感と論理を交差させる Pair-Link・Skyscraper・Reflec-Shot・Pres-Sure Judge など、洗練された知育ロジックゲームを無料でお楽しみください。",
  keywords: ["知育", "パズル", "無料", "ロジックパズル", "ナンバーリンク", "スカイスクレイパー", "脳トレ"],
  openGraph: { type: "website", siteName: "Wispo" },
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  verification: {
    google: "PLAqEwb4uR64kDIAlUfM9VpPr35AFWwMTrGd4nYlobU",
  },  
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        {process.env.NODE_ENV === "production" && (
          <>
            <Script
              src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5383262801288621"
              strategy="afterInteractive"
              crossOrigin="anonymous"
            />
            {/* GPT: googletag.pubads().refresh() 用（ペアリンク等の動的リフレッシュに必要） */}
            <Script
              src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"
              strategy="afterInteractive"
              crossOrigin="anonymous"
            />
          </>
        )}
      </head>
      <body className="min-h-screen flex flex-col overflow-x-hidden bg-gradient-to-br from-wit-bg to-wit-bg-2 text-wit-text font-sans antialiased">
        <UserSyncProvider>
          <I18nProvider>
            {children}
            <Footer />
          </I18nProvider>
        </UserSyncProvider>
      </body>
    </html>
  );
}
