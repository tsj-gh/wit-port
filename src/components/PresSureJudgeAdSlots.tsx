"use client";

import { useEffect, useRef, useState } from "react";
import { AD_REFRESH_EVENT } from "@/lib/ads";

const ADSENSE_CLIENT = "ca-pub-5383262801288621";
const SLOT_1 = process.env.NEXT_PUBLIC_ADSENSE_SLOT_PRESSURE_1 || "";
const SLOT_2 = process.env.NEXT_PUBLIC_ADSENSE_SLOT_PRESSURE_2 || "";

/** Layout Shift 防止のための最小高さ（px） */
const AD_MIN_HEIGHT_PX = 100;

/** レスポンシブ対応の広告サイズ */
const AD_SIZES: [number, number][] = [
  [320, 50],
  [336, 280],
  [728, 90],
  [300, 250],
];

type PresSureJudgeAdSlotProps = {
  slotIndex: 1 | 2;
  isDebugMode: boolean;
};

/** デバッグ時のみ表示するラベル（本番ではプレースホルダー自体を出さない） */
function getDebugSlotLabel(slotIndex: number): string {
  return `広告スペース #${slotIndex}`;
}

function AdPlaceholder({ slotIndex, isFlashing }: { slotIndex: number; isFlashing: boolean }) {
  return (
    <div
      className={`flex w-full items-center justify-center rounded-lg border border-dashed border-[color-mix(in_srgb,var(--color-text)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_70%,var(--color-bg))]/40 px-3 py-2 text-center text-[var(--color-muted)] text-xs font-mono transition-all duration-200 ${
        isFlashing ? "opacity-100 ring-2 ring-[color-mix(in_srgb,var(--color-primary)_55%,transparent)] scale-[1.01]" : "opacity-70"
      }`}
      style={{ minHeight: AD_MIN_HEIGHT_PX }}
      aria-label={`広告スペース ${slotIndex}（Pres-Sure Judge・デバッグ表示）`}
    >
      {getDebugSlotLabel(slotIndex)}
    </div>
  );
}

/**
 * Pres-Sure Judge 用広告ユニット
 * slotIndex=2 が両スロットの GPT 初期化を担当（Pair-link と同様）
 */
export function PresSureJudgeAdSlot({ slotIndex, isDebugMode }: PresSureJudgeAdSlotProps) {
  const initializedRef = useRef(false);
  const [isFlashing, setIsFlashing] = useState(false);

  const slotId = slotIndex === 1 ? SLOT_1 : SLOT_2;
  const divId = `ad-pressure-${slotIndex}`;
  const showPlaceholder = isDebugMode || (!slotId && process.env.NODE_ENV !== "production");

  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDebugMode) return;
    const onRefresh = () => {
      setIsFlashing(true);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => {
        setIsFlashing(false);
        flashTimeoutRef.current = null;
      }, 200);
    };
    window.addEventListener(AD_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(AD_REFRESH_EVENT, onRefresh);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, [isDebugMode]);

  useEffect(() => {
    if (isDebugMode || !SLOT_1 || !SLOT_2) return;
    if (slotIndex !== 2) return;

    const googletag = window.googletag;
    if (!googletag || initializedRef.current) return;

    initializedRef.current = true;

    googletag.cmd = googletag.cmd || [];
    googletag.cmd.push(() => {
      try {
        const path1 = `/${ADSENSE_CLIENT}/${SLOT_1}`;
        const path2 = `/${ADSENSE_CLIENT}/${SLOT_2}`;
        const s1 = googletag.defineSlot(path1, AD_SIZES, "ad-pressure-1");
        const s2 = googletag.defineSlot(path2, AD_SIZES, "ad-pressure-2");
        if (s1 && s2) {
          googletag.enableServices();
          googletag.display("ad-pressure-1");
          googletag.display("ad-pressure-2");
        }
      } catch {
        // AdBlock 等: ゲームの進行を妨げない
      }
    });
  }, [isDebugMode, slotIndex]);

  if (showPlaceholder) {
    return (
      <div className="mx-auto w-full max-w-full" style={{ minHeight: AD_MIN_HEIGHT_PX }}>
        <AdPlaceholder slotIndex={slotIndex} isFlashing={isFlashing} />
      </div>
    );
  }

  if (!slotId) {
    return (
      <div
        className="mx-auto w-full max-w-full"
        style={{ minHeight: AD_MIN_HEIGHT_PX }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-full"
      aria-label={`広告スペース ${slotIndex}（Pres-Sure Judge）`}
      style={{ minHeight: AD_MIN_HEIGHT_PX }}
    >
      <div
        id={divId}
        style={{ minHeight: AD_MIN_HEIGHT_PX }}
        className="mx-auto flex min-h-[100px] w-full max-w-full items-center justify-center"
      />
    </div>
  );
}
