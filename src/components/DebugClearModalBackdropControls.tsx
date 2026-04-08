"use client";

import { useSearchParams } from "next/navigation";
import {
  CLEAR_MODAL_BLUR_RANGE,
  CLEAR_MODAL_BRIGHTNESS_RANGE,
  CLEAR_MODAL_OPACITY_RANGE,
  setClearModalBackdropDebug,
  useClearModalBackdropDebugValues,
} from "@/lib/debugClearModalBackdrop";

const wrapClass =
  "mt-2 border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] pt-2";
const labelClass = "font-semibold text-[var(--color-muted)] text-[10px]";
const valueClass =
  "tabular-nums text-[10px] text-[color-mix(in_srgb,var(--color-text)_88%,var(--color-bg))]";
const hintClass = "flex justify-between text-[9px] text-[var(--color-muted)]";

export function DebugClearModalBackdropControls() {
  const params = useSearchParams();
  const isDevTj = params.get("devtj") === "true";
  const { debugBlur, debugBrightness, debugOpacity } = useClearModalBackdropDebugValues();

  if (!isDevTj) return null;

  return (
    <details className={wrapClass}>
      <summary
        className={`${labelClass} cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden`}
      >
        <span className="mr-1 inline-block opacity-70">▸</span>
        クリア画面レイアウト設定
      </summary>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className={labelClass}>クリア背景 blur（px）</span>
          <span className={valueClass}>{debugBlur}</span>
        </div>
        <input
          type="range"
          min={CLEAR_MODAL_BLUR_RANGE.min}
          max={CLEAR_MODAL_BLUR_RANGE.max}
          step={CLEAR_MODAL_BLUR_RANGE.step}
          value={debugBlur}
          onChange={(e) => setClearModalBackdropDebug({ debugBlur: Number(e.target.value) })}
          className="w-full accent-[var(--color-primary)]"
        />
        <div className={hintClass}>
          <span>{CLEAR_MODAL_BLUR_RANGE.min}px</span>
          <span>{CLEAR_MODAL_BLUR_RANGE.max}px</span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={labelClass}>brightness</span>
          <span className={valueClass}>{debugBrightness.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={CLEAR_MODAL_BRIGHTNESS_RANGE.min}
          max={CLEAR_MODAL_BRIGHTNESS_RANGE.max}
          step={CLEAR_MODAL_BRIGHTNESS_RANGE.step}
          value={debugBrightness}
          onChange={(e) => setClearModalBackdropDebug({ debugBrightness: Number(e.target.value) })}
          className="w-full accent-[var(--color-primary)]"
        />
        <div className={hintClass}>
          <span>{CLEAR_MODAL_BRIGHTNESS_RANGE.min}</span>
          <span>{CLEAR_MODAL_BRIGHTNESS_RANGE.max}</span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={labelClass}>背景シート濃さ（テーマ色）</span>
          <span className={valueClass}>{debugOpacity.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={CLEAR_MODAL_OPACITY_RANGE.min}
          max={CLEAR_MODAL_OPACITY_RANGE.max}
          step={CLEAR_MODAL_OPACITY_RANGE.step}
          value={debugOpacity}
          onChange={(e) => setClearModalBackdropDebug({ debugOpacity: Number(e.target.value) })}
          className="w-full accent-[var(--color-primary)]"
        />
        <div className={hintClass}>
          <span>{CLEAR_MODAL_OPACITY_RANGE.min}</span>
          <span>{CLEAR_MODAL_OPACITY_RANGE.max}</span>
        </div>
      </div>
    </details>
  );
}
