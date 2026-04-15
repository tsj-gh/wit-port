"use client";

import { PairLinkAdSlot } from "@/components/PairLinkAdSlots";
import { GamePageHeader } from "@/components/GamePageHeader";
import { ColoringCanvas } from "@/components/lab/ColoringCanvas";
import { GameQuickInfoNote } from "@/components/lab/GameQuickInfoNote";
import {
  GAME_AD_GAP_BEFORE_SLOT_2_PX,
  GAME_AD_SLOT_MIN_HEIGHT_PX,
  GAME_COLUMN_CLASS,
} from "@/lib/gameLayout";

/**
 * 他ラボゲームと同型のヘッダー・列幅。広告#1 は出さず、#2 のみ Pair-Link と同一コンポーネントで配置（GPT 用に #1 は DOM のみ非表示）。
 */
export function TapColoringLabShell() {
  return (
    <div className={GAME_COLUMN_CLASS}>
      <GamePageHeader titleEn="Tap Coloring" titleJa="タップ塗り絵" />
      <div className="hidden" aria-hidden>
        <PairLinkAdSlot slotIndex={1} />
      </div>
      <section className="relative z-[1] mb-4 w-full rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] px-4 pb-4 pt-4 backdrop-blur sm:px-5 sm:pb-5 sm:pt-4">
        <ColoringCanvas />
        <GameQuickInfoNote
          goal="色彩認知・原因と結果の理解・手眼協調の向上"
          target="幼児〜小学校低学年"
          operation="タップ中心の直感操作"
        />
      </section>
      <div
        className="relative z-0 w-full"
        style={{ minHeight: GAME_AD_SLOT_MIN_HEIGHT_PX, marginTop: GAME_AD_GAP_BEFORE_SLOT_2_PX }}
      >
        <PairLinkAdSlot slotIndex={2} />
      </div>
    </div>
  );
}
