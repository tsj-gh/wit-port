"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "wispo-debug-clear-backdrop-blur-px";
const CSS_VAR = "--clear-backdrop-blur-px";

export const CLEAR_BACKDROP_BLUR_DEFAULT = 2;
export const CLEAR_BACKDROP_BLUR_MIN = 0;
export const CLEAR_BACKDROP_BLUR_MAX = 16;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function applyBlurToCss(px: number) {
  document.documentElement.style.setProperty(CSS_VAR, `${px}px`);
}

function readStoredBlurPx(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = Number(raw);
    if (!Number.isFinite(v)) return null;
    return clamp(v, CLEAR_BACKDROP_BLUR_MIN, CLEAR_BACKDROP_BLUR_MAX);
  } catch {
    return null;
  }
}

/** クリア画面の背景 blur 強度をデバッグ用に調整（localStorage 永続化）。 */
export function useDebugClearBackdropBlurPx() {
  const [blurPx, setBlurPxState] = useState<number>(CLEAR_BACKDROP_BLUR_DEFAULT);

  useEffect(() => {
    const init = readStoredBlurPx() ?? CLEAR_BACKDROP_BLUR_DEFAULT;
    setBlurPxState(init);
    applyBlurToCss(init);
  }, []);

  const setBlurPx = useCallback((next: number) => {
    const v = clamp(next, CLEAR_BACKDROP_BLUR_MIN, CLEAR_BACKDROP_BLUR_MAX);
    setBlurPxState(v);
    applyBlurToCss(v);
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      /* ignore */
    }
  }, []);

  return useMemo(() => ({ blurPx, setBlurPx }), [blurPx, setBlurPx]);
}

