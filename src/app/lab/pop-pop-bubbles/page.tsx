import type { Metadata } from "next";
import { PopPopBubblesLabShell } from "@/components/lab/PopPopBubblesLabShell";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";

export const metadata: Metadata = {
  title: "はじけて！バブル（Pop-Pop Bubbles）",
  description: "ふわふわ漂うバブルをタップして弾ける、Kids向けの直感ミニゲーム。",
  robots: { index: false, follow: false },
  alternates: { canonical: `${BASE_URL}/lab/pop-pop-bubbles` },
};

export default function PopPopBubblesPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-4 md:py-6">
      <PopPopBubblesLabShell />
    </main>
  );
}
