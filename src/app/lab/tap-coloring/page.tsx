import type { Metadata } from "next";
import { ColoringCanvas } from "@/components/lab/ColoringCanvas";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";

export const metadata: Metadata = {
  title: "タップぬりえ（実験）",
  description: "タップで色が広がる幼児向けぬりえプロトタイプ（実験ページ）",
  robots: { index: false, follow: false },
  alternates: { canonical: `${BASE_URL}/lab/tap-coloring` },
};

export default function TapColoringLabPage() {
  return (
    <main className="min-h-dvh bg-stone-50 text-stone-800">
      <ColoringCanvas />
    </main>
  );
}
