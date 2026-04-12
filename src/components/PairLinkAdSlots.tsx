"use client";

import { useEffect, useRef, useState } from "react";
import { GameAdSlotFrame } from "@/components/ads/GameAdSlotFrame";
import { AD_REFRESH_EVENT } from "@/lib/ads";

const ADSENSE_CLIENT = "ca-pub-5383262801288621";
const SLOT_1 = process.env.NEXT_PUBLIC_ADSENSE_SLOT_PAIRLINK_1 || "";
const SLOT_2 = process.env.NEXT_PUBLIC_ADSENSE_SLOT_PAIRLINK_2 || "";

/** Layout Shift 防止のための最小高さ（px） */
const AD_MIN_HEIGHT_PX = 100;

/** レスポンシブ対応の広告サイズ（[320,50], [336,280], [728,90], [300,250]） */
const AD_SIZES: [number, number][] = [
  [320, 50],
  [336, 280],
  [728, 90],
  [300, 250],
];

type PairLinkAdSlotProps = {
  slotIndex: 1 | 2;
};

function getReserveSlotLabel(slotIndex: number): string {
  return `広告スペース #${slotIndex}`;
}

function AdPlaceholder({ slotIndex, isFlashing }: { slotIndex: number; isFlashing: boolean }) {
  return (
    <div
      className={`flex w-full items-center justify-center rounded-lg border border-dashed border-[color-mix(in_srgb,var(--color-text)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_70%,var(--color-bg))]/40 px-3 py-2 text-center text-[var(--color-muted)] text-xs font-mono transition-all duration-200 ${
        isFlashing ? "opacity-100 ring-2 ring-[color-mix(in_srgb,var(--color-primary)_55%,transparent)] scale-[1.01]" : "opacity-70"
      }`}
      style={{ minHeight: AD_MIN_HEIGHT_PX }}
      aria-label={`広告スペース ${slotIndex}`}
    >
      {getReserveSlotLabel(slotIndex)}
    </div>
  );
}

/**
 * ペアリンク用広告ユニット（1箇所）
 * slotIndex=2 のコンポーネントが GPT の両スロット初期化を担当
 */
export function PairLinkAdSlot({ slotIndex }: PairLinkAdSlotProps) {
  const initializedRef = useRef(false);
  const [isFlashing, setIsFlashing] = useState(false);

  const divId = `ad-pairlink-${slotIndex}`;
  const showPlaceholder = !SLOT_1 || !SLOT_2;

  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!SLOT_1 || !SLOT_2) return;
    if (slotIndex !== 2) return;

    const googletag = window.googletag;
    if (!googletag || initializedRef.current) return;

    initializedRef.current = true;

    googletag.cmd = googletag.cmd || [];
    googletag.cmd.push(() => {
      try {
        const path1 = `/${ADSENSE_CLIENT}/${SLOT_1}`;
        const path2 = `/${ADSENSE_CLIENT}/${SLOT_2}`;

        const s1 = googletag.defineSlot(path1, AD_SIZES, "ad-pairlink-1");
        const s2 = googletag.defineSlot(path2, AD_SIZES, "ad-pairlink-2");

        if (s1 && s2) {
          googletag.enableServices();
          googletag.display("ad-pairlink-1");
          googletag.display("ad-pairlink-2");
        }
      } catch {
        // AdBlock 等: ゲームの進行を妨げない
      }
    });
  }, [slotIndex]);

  if (showPlaceholder) {
    return (
      <GameAdSlotFrame>
        <AdPlaceholder slotIndex={slotIndex} isFlashing={isFlashing} />
      </GameAdSlotFrame>
    );
  }

  return (
    <GameAdSlotFrame>
      <div className="mx-auto w-full max-w-full" aria-label={`広告スペース ${slotIndex}`}>
        <div
          id={divId}
          style={{ minHeight: AD_MIN_HEIGHT_PX }}
          className="mx-auto flex min-h-[100px] w-full max-w-full items-center justify-center"
        />
      </div>
    </GameAdSlotFrame>
  );
}

/** 2箇所配置用のエクスポート（後方互換） */
export function PairLinkAdSlots() {
  return (
    <>
      <PairLinkAdSlot slotIndex={1} />
      <PairLinkAdSlot slotIndex={2} />
    </>
  );
}
