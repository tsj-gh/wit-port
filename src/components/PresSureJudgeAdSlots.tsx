"use client";

import { useEffect, useRef, useState } from "react";
import { AD_REFRESH_EVENT } from "@/lib/ads";

const ADSENSE_CLIENT = "ca-pub-5383262801288621";
const SLOT_1 = process.env.NEXT_PUBLIC_ADSENSE_SLOT_PRESSURE_1 || "";

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
  isDebugMode: boolean;
};

function AdPlaceholder({ isFlashing }: { isFlashing: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded-lg border border-dashed border-white/30 bg-slate-700/40 text-wit-muted text-xs font-mono transition-all duration-200 ${
        isFlashing ? "opacity-100 ring-2 ring-emerald-400/80 scale-[1.01]" : "opacity-70"
      }`}
      style={{ minHeight: AD_MIN_HEIGHT_PX }}
      aria-label="広告スペース（Pres-Sure Judge・デバッグ表示）"
    >
      [AD-UNIT]
    </div>
  );
}

/**
 * Pres-Sure Judge 用広告ユニット
 * devtj 時はプレースホルダー表示、本番では AdSense GPT スロット
 */
export function PresSureJudgeAdSlot({ isDebugMode }: PresSureJudgeAdSlotProps) {
  const initializedRef = useRef(false);
  const [isFlashing, setIsFlashing] = useState(false);

  const divId = "ad-pressure-1";
  const showPlaceholder = isDebugMode || !SLOT_1;

  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!showPlaceholder) return;
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
  }, [showPlaceholder]);

  useEffect(() => {
    if (isDebugMode || !SLOT_1) return;

    const googletag = window.googletag;
    if (!googletag || initializedRef.current) return;

    initializedRef.current = true;

    googletag.cmd = googletag.cmd || [];
    googletag.cmd.push(() => {
      try {
        const path = `/${ADSENSE_CLIENT}/${SLOT_1}`;
        const slot = googletag.defineSlot(path, AD_SIZES, divId);
        if (slot) {
          googletag.enableServices();
          googletag.display(divId);
        }
      } catch {
        // AdBlock 等: ゲームの進行を妨げない
      }
    });
  }, [isDebugMode]);

  if (showPlaceholder) {
    return (
      <div className="my-4" style={{ minHeight: AD_MIN_HEIGHT_PX }}>
        <AdPlaceholder isFlashing={isFlashing} />
      </div>
    );
  }

  if (!SLOT_1) {
    return (
      <div
        className="my-4"
        style={{ minHeight: AD_MIN_HEIGHT_PX }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="my-4" aria-label="広告スペース（Pres-Sure Judge）" style={{ minHeight: AD_MIN_HEIGHT_PX }}>
      <div
        id={divId}
        style={{ minHeight: AD_MIN_HEIGHT_PX }}
        className="flex min-h-[100px] items-center justify-center"
      />
    </div>
  );
}
