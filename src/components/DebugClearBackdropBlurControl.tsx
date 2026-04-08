"use client";

import { useSearchParams } from "next/navigation";
import {
  CLEAR_BACKDROP_BLUR_MAX,
  CLEAR_BACKDROP_BLUR_MIN,
  CLEAR_BACKDROP_BLUR_STEP,
  useDebugClearBackdropBlurPx,
} from "@/lib/debugClearBackdropBlur";

export function DebugClearBackdropBlurControl() {
  const params = useSearchParams();
  const isDevTj = params.get("devtj") === "true";
  const { blurPx, setBlurPx } = useDebugClearBackdropBlurPx();

  if (!isDevTj) return null;

  return (
    <div className="mt-2 border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] pt-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-[var(--color-muted)] text-[10px]">クリア背景ぼかし（px）</span>
        <span className="tabular-nums text-[10px] text-[color-mix(in_srgb,var(--color-text)_88%,var(--color-bg))]">
          {blurPx.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={CLEAR_BACKDROP_BLUR_MIN}
        max={CLEAR_BACKDROP_BLUR_MAX}
        step={CLEAR_BACKDROP_BLUR_STEP}
        value={blurPx}
        onChange={(e) => setBlurPx(Number(e.target.value))}
        className="w-full accent-[var(--color-primary)]"
      />
      <div className="flex justify-between text-[9px] text-[var(--color-muted)]">
        <span>{CLEAR_BACKDROP_BLUR_MIN.toFixed(1)}px</span>
        <span>{CLEAR_BACKDROP_BLUR_MAX.toFixed(1)}px</span>
      </div>
    </div>
  );
}
