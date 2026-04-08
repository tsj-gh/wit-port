"use client";

import type { CSSProperties } from "react";
import { useSyncExternalStore } from "react";

/** 本番クリアオーバーレイと一致する初期値（テーマの --color-bg に連動するシート濃さ） */
export const CLEAR_MODAL_DEBUG_DEFAULTS = {
  debugBlur: 1,
  debugBrightness: 1.3,
  debugOpacity: 0.25,
} as const;

export type ClearModalBackdropDebugState = {
  debugBlur: number;
  debugBrightness: number;
  debugOpacity: number;
};

const STORAGE_BLUR = "wispo-debug-clear-modal-blur-v2";
const STORAGE_BRIGHTNESS = "wispo-debug-clear-modal-brightness-v2";
const STORAGE_OPACITY = "wispo-debug-clear-modal-opacity-v2";

export const CLEAR_MODAL_BLUR_RANGE = { min: 0, max: 20, step: 1 } as const;
export const CLEAR_MODAL_BRIGHTNESS_RANGE = { min: 0.1, max: 1.5, step: 0.1 } as const;
export const CLEAR_MODAL_OPACITY_RANGE = { min: 0, max: 1, step: 0.05 } as const;

const BLUR_MIN = CLEAR_MODAL_BLUR_RANGE.min;
const BLUR_MAX = CLEAR_MODAL_BLUR_RANGE.max;
const BRIGHTNESS_MIN = CLEAR_MODAL_BRIGHTNESS_RANGE.min;
const BRIGHTNESS_MAX = CLEAR_MODAL_BRIGHTNESS_RANGE.max;
const OPACITY_MIN = CLEAR_MODAL_OPACITY_RANGE.min;
const OPACITY_MAX = CLEAR_MODAL_OPACITY_RANGE.max;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeBlur(n: number): number {
  return Math.round(clamp(n, BLUR_MIN, BLUR_MAX));
}

function normalizeBrightness(n: number): number {
  const v = Math.round(clamp(n, BRIGHTNESS_MIN, BRIGHTNESS_MAX) * 10) / 10;
  return clamp(v, BRIGHTNESS_MIN, BRIGHTNESS_MAX);
}

function normalizeOpacity(n: number): number {
  const v = Math.round(clamp(n, OPACITY_MIN, OPACITY_MAX) * 20) / 20;
  return clamp(v, OPACITY_MIN, OPACITY_MAX);
}

let state: ClearModalBackdropDebugState = { ...CLEAR_MODAL_DEBUG_DEFAULTS };
const listeners = new Set<() => void>();
let hydrated = false;

function emit() {
  listeners.forEach((l) => l());
}

function readPersisted(): ClearModalBackdropDebugState {
  if (typeof window === "undefined") return { ...CLEAR_MODAL_DEBUG_DEFAULTS };
  try {
    const b = Number(localStorage.getItem(STORAGE_BLUR));
    const br = Number(localStorage.getItem(STORAGE_BRIGHTNESS));
    const o = Number(localStorage.getItem(STORAGE_OPACITY));
    return {
      debugBlur: Number.isFinite(b) ? normalizeBlur(b) : CLEAR_MODAL_DEBUG_DEFAULTS.debugBlur,
      debugBrightness: Number.isFinite(br)
        ? normalizeBrightness(br)
        : CLEAR_MODAL_DEBUG_DEFAULTS.debugBrightness,
      debugOpacity: Number.isFinite(o) ? normalizeOpacity(o) : CLEAR_MODAL_DEBUG_DEFAULTS.debugOpacity,
    };
  } catch {
    return { ...CLEAR_MODAL_DEBUG_DEFAULTS };
  }
}

function persist(next: ClearModalBackdropDebugState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_BLUR, String(next.debugBlur));
    localStorage.setItem(STORAGE_BRIGHTNESS, String(next.debugBrightness));
    localStorage.setItem(STORAGE_OPACITY, String(next.debugOpacity));
  } catch {
    /* ignore */
  }
}

function ensureHydrated() {
  if (typeof window === "undefined" || hydrated) return;
  hydrated = true;
  state = readPersisted();
}

export function subscribeClearModalBackdropDebug(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function getClearModalBackdropDebugSnapshot(): ClearModalBackdropDebugState {
  if (typeof window !== "undefined") ensureHydrated();
  return state;
}

export function getClearModalBackdropDebugServerSnapshot(): ClearModalBackdropDebugState {
  return { ...CLEAR_MODAL_DEBUG_DEFAULTS };
}

export function setClearModalBackdropDebug(partial: Partial<ClearModalBackdropDebugState>) {
  ensureHydrated();
  const next: ClearModalBackdropDebugState = {
    debugBlur: partial.debugBlur !== undefined ? normalizeBlur(partial.debugBlur) : state.debugBlur,
    debugBrightness:
      partial.debugBrightness !== undefined
        ? normalizeBrightness(partial.debugBrightness)
        : state.debugBrightness,
    debugOpacity:
      partial.debugOpacity !== undefined ? normalizeOpacity(partial.debugOpacity) : state.debugOpacity,
  };
  state = next;
  persist(next);
  emit();
}

/** devtj 時のオーバーレイ用インラインスタイル（テーマ背景のシート濃さは opacity で表現） */
export function clearModalBackdropOverlayStyle(v: ClearModalBackdropDebugState): CSSProperties {
  const pct = Math.round(v.debugOpacity * 100);
  return {
    backdropFilter: `blur(${v.debugBlur}px) brightness(${v.debugBrightness})`,
    backgroundColor: `color-mix(in srgb, var(--color-bg) ${pct}%, transparent)`,
  };
}

export function useClearModalBackdropDebugValues(): ClearModalBackdropDebugState {
  return useSyncExternalStore(
    subscribeClearModalBackdropDebug,
    getClearModalBackdropDebugSnapshot,
    getClearModalBackdropDebugServerSnapshot,
  );
}
