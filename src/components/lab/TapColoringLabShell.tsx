"use client";

import { useEffect, type CSSProperties } from "react";
import { PairLinkAdSlot } from "@/components/PairLinkAdSlots";
import { GamePageHeader } from "@/components/GamePageHeader";
import { ColoringCanvas } from "@/components/lab/ColoringCanvas";
import { GameQuickInfoNote } from "@/components/lab/GameQuickInfoNote";
import {
  GAME_AD_GAP_BEFORE_SLOT_2_PX,
  GAME_AD_SLOT_MIN_HEIGHT_PX,
  GAME_COLUMN_CLASS,
  GAME_NO_TOP_AD_LAYOUT_OFFSET_PX,
} from "@/lib/gameLayout";

/**
 * 他ラボゲームと同型のヘッダー・列幅。広告#1 は出さず、#2 のみ Pair-Link と同一コンポーネントで配置（GPT 用に #1 は DOM のみ非表示）。
 */
export function TapColoringLabShell() {
  useEffect(() => {
    const onLoad = () => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        })
      );
    };
    if (typeof document === "undefined") return;
    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
    }
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return (
    <div className={`${GAME_COLUMN_CLASS} flex min-h-0 flex-1 flex-col lg:max-w-none`}>
      <GamePageHeader titleEn="Tap Coloring" titleJa="タップ塗り絵" />
      <div className="hidden" aria-hidden>
        <PairLinkAdSlot slotIndex={1} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-start lg:gap-5">
        <div
          className="flex min-h-0 w-full flex-1 flex-col lg:max-h-[calc(100dvh-var(--tap-wrap-off)-80px)] lg:min-w-0 lg:justify-center"
          style={{ "--tap-wrap-off": `${GAME_NO_TOP_AD_LAYOUT_OFFSET_PX}px` } as CSSProperties}
        >
          <section className="relative z-[1] mb-0 w-full rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] px-4 pb-4 pt-4 backdrop-blur sm:px-5 sm:pb-5 sm:pt-4 lg:mb-0">
            <div className="max-h-none lg:max-h-[min(680px,calc(100dvh-var(--tap-wrap-off)-96px))] lg:overflow-y-auto">
              <ColoringCanvas />
            </div>
          </section>
        </div>

        <aside className="order-2 w-full shrink-0 lg:sticky lg:top-5 lg:max-h-[calc(100dvh-20px)] lg:w-[360px] lg:self-start lg:overflow-y-auto">
          <div className="mb-2 flex flex-col gap-2 lg:hidden">
            <details className="rounded-xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] text-[var(--color-text)]">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--color-text)]">
                あそびかた・ねらい（要約）
              </summary>
              <div className="border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] px-3 pb-3 pt-2 text-xs leading-relaxed text-[var(--color-muted)]">
                <p className="m-0">【ねらい】色彩認知・原因と結果の理解・手眼協調の向上</p>
                <p className="mt-2 m-0">【対象】幼児〜小学校低学年</p>
                <p className="mt-2 m-0">【操作】タップ中心の直感操作</p>
              </div>
            </details>
          </div>
          <section className="mb-3 hidden rounded-xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] px-3 py-2 lg:block">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">あそびかた（要約）</h3>
            <p className="mt-2 m-0 text-xs leading-relaxed text-[var(--color-muted)]">
              タップで塗りつぶし、色と領域の因果を直感的に確かめます。
            </p>
          </section>
          <div
            className="relative z-0 w-full"
            style={{ minHeight: GAME_AD_SLOT_MIN_HEIGHT_PX, marginTop: GAME_AD_GAP_BEFORE_SLOT_2_PX }}
          >
            <PairLinkAdSlot slotIndex={2} />
          </div>
        </aside>
      </div>

      <section className="mx-auto mt-6 w-full max-w-3xl">
        <GameQuickInfoNote
          goal="色彩認知・原因と結果の理解・手眼協調の向上"
          target="幼児〜小学校低学年"
          operation="タップ中心の直感操作"
        />
      </section>
    </div>
  );
}
