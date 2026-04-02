"use client";

import { useEffect, useRef, useState } from "react";
import { AD_REFRESH_EVENT } from "@/lib/ads";

/** 既定は本番発行者。ステージング用に `NEXT_PUBLIC_ADSENSE_CLIENT_ID` で上書き可 */
const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "ca-pub-5383262801288621";
const SLOT_1 = process.env.NEXT_PUBLIC_ADSENSE_SLOT_REFLEC_SHOT_1 || "";
const SLOT_2 = process.env.NEXT_PUBLIC_ADSENSE_SLOT_REFLEC_SHOT_2 || "";

/** Layout Shift 防止のための最小高さ（px） */
const AD_MIN_HEIGHT_PX = 100;

/** レスポンシブ対応の広告サイズ（[320,50], [336,280], [728,90], [300,250]） — Pair-link と同一 */
const AD_SIZES: [number, number][] = [
  [320, 50],
  [336, 280],
  [728, 90],
  [300, 250],
];

type ReflecShotAdSlotProps = {
  slotIndex: 1 | 2;
  isDebugMode: boolean;
};

function getDebugSlotLabel(slotIndex: number): string {
  return `広告スペース #${slotIndex}（Reflec-Shot）`;
}

function AdPlaceholder({ slotIndex, isFlashing }: { slotIndex: number; isFlashing: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded-lg border border-dashed border-white/30 bg-slate-700/40 text-wit-muted text-xs font-mono transition-all duration-200 ${
        isFlashing ? "opacity-100 ring-2 ring-emerald-400/80 scale-[1.01]" : "opacity-70"
      }`}
      style={{ minHeight: AD_MIN_HEIGHT_PX }}
      aria-label={`広告スペース ${slotIndex}（Reflec-Shot・デバッグ表示）`}
    >
      {getDebugSlotLabel(slotIndex)}
    </div>
  );
}

/**
 * Reflec-Shot ラボ用広告ユニット（GPT）
 * slotIndex=2 のマウント時に両スロットを defineSlot／display（Pair-link / Pres-Sure Judge と同型）
 */
export function ReflecShotAdSlot({ slotIndex, isDebugMode }: ReflecShotAdSlotProps) {
  const initializedRef = useRef(false);
  const [isFlashing, setIsFlashing] = useState(false);

  const slotId = slotIndex === 1 ? SLOT_1 : SLOT_2;
  const divId = `ad-reflecshot-${slotIndex}`;
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

        const s1 = googletag.defineSlot(path1, AD_SIZES, "ad-reflecshot-1");
        const s2 = googletag.defineSlot(path2, AD_SIZES, "ad-reflecshot-2");

        if (s1 && s2) {
          googletag.enableServices();
          googletag.display("ad-reflecshot-1");
          googletag.display("ad-reflecshot-2");
        }
      } catch {
        // AdBlock 等: ゲームの進行を妨げない
      }
    });
  }, [isDebugMode, slotIndex]);

  if (showPlaceholder) {
    return (
      <div className="my-4">
        <AdPlaceholder slotIndex={slotIndex} isFlashing={isFlashing} />
      </div>
    );
  }

  if (!slotId) {
    return (
      <div className="my-4" style={{ minHeight: AD_MIN_HEIGHT_PX }} aria-hidden="true" />
    );
  }

  return (
    <div className="my-4" aria-label={`広告スペース ${slotIndex}（Reflec-Shot）`}>
      <div
        id={divId}
        style={{ minHeight: AD_MIN_HEIGHT_PX }}
        className="flex min-h-[100px] items-center justify-center"
      />
    </div>
  );
}

export function ReflecShotAdSlots({ isDebugMode }: { isDebugMode: boolean }) {
  return (
    <>
      <ReflecShotAdSlot slotIndex={1} isDebugMode={isDebugMode} />
      <ReflecShotAdSlot slotIndex={2} isDebugMode={isDebugMode} />
    </>
  );
}
