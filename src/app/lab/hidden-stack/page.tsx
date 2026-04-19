import type { Metadata } from "next";
import { Suspense } from "react";
import { SmartGuardLock } from "@/components/lab/SmartGuardLock";
import HiddenStackGame from "./HiddenStackGame";
import { gameLabAlternates, gameLabPageSeo } from "@/lib/gameLabPageSeo";
import { buildGameSoftwareApplicationJsonLd } from "@/lib/gameSoftwareApplicationJsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";
const hiddenStackJsonLd = buildGameSoftwareApplicationJsonLd("hidden-stack", SITE_URL);

export const metadata: Metadata = {
  title: gameLabPageSeo.hiddenStack.title,
  description: gameLabPageSeo.hiddenStack.description,
  keywords: ["知育", "パズル", "3D", "空間認知", "Hidden Stack", "かくれつみき", "積み木"],
  applicationName: "Wispo",
  alternates: gameLabAlternates("/lab/hidden-stack"),
  other: {
    "application:category": "EducationalGame",
    "application:operating-system": "Windows, macOS, Android, iOS",
  },
};

export default function HiddenStackPage() {
  return (
    <>
      <SmartGuardLock />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hiddenStackJsonLd) }} />
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-1 flex-col px-4 py-2 md:py-3 lg:max-w-[1400px] lg:px-6">
        <Suspense
          fallback={
            <div className="flex min-h-[40dvh] flex-1 items-center justify-center bg-[var(--color-bg)] text-[var(--color-muted)]">読み込み中…</div>
          }
        >
          <div className="flex min-h-0 flex-[1_1_0%] flex-col">
            <HiddenStackGame />
          </div>
        </Suspense>
      </main>
    </>
  );
}
