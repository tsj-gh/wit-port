"use client";

import type { ReactNode } from "react";
import { GAME_AD_SLOT_FRAME_PADDING_Y_PX } from "@/lib/gameLayout";

const sponsorLabelStyle = {
  fontSize: 10,
  color: "#999",
  textAlign: "center" as const,
  marginBottom: 4,
};

/**
 * 広告枠の共通ラッパー（スポンサーラベル + 固定内側余白）。
 * AdSense 審査用のコンテンツ分離表示と、空枠時のレイアウト安定用。
 */
export function GameAdSlotFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="mx-auto w-full max-w-full"
      style={{
        paddingTop: GAME_AD_SLOT_FRAME_PADDING_Y_PX,
        paddingBottom: GAME_AD_SLOT_FRAME_PADDING_Y_PX,
      }}
    >
      <p style={sponsorLabelStyle}>スポンサーリンク</p>
      {children}
    </div>
  );
}
