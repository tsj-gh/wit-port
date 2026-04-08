"use client";

import {
  CLEAR_BACKDROP_BLUR_MAX,
  CLEAR_BACKDROP_BLUR_MIN,
  useDebugClearBackdropBlurPx,
} from "@/lib/debugClearBackdropBlur";

export function DebugClearBackdropBlurControl() {
  const { blurPx, setBlurPx } = useDebugClearBackdropBlurPx();

  return (
    <div className="mt-2 border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] pt-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-[var(--color-muted)] text-[10px]">クリア背景ぼかし（px）</span>
        <span className="tabular-nums text-[10px] text-[color-mix(in_srgb,var(--color-text)_88%,var(--color-bg))]">
          {blurPx.toFixed(1)}
        </span>
      </div>
      <input
        type="range"
        min={CLEAR_BACKDROP_BLUR_MIN}
        max={CLEAR_BACKDROP_BLUR_MAX}
        step={0.5}
        value={blurPx}
        onChange={(e) => setBlurPx(Number(e.target.value))}
        className="w-full accent-[var(--color-primary)]"
      />
      <div className="flex justify-between text-[9px] text-[var(--color-muted)]">
        <span>0px</span>
        <span>{CLEAR_BACKDROP_BLUR_MAX}px</span>
      </div>
    </div>
  );
}

