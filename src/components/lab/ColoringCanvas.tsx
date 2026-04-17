"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { MutableRefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import {
  buildPreviewDataUrlFromDisplay,
  prependTapColoringHistory,
  updateTapColoringHistoryEntry,
  type TapColoringHistoryEntry,
  type TapColoringSwatch,
} from "@/lib/tapColoringHistory";
import { composeTapColoringExport, type TapColoringExportOptions } from "@/lib/tapColoringExport";

export type { TapColoringSwatch } from "@/lib/tapColoringHistory";
export type { TapColoringExportOptions } from "@/lib/tapColoringExport";

/** HSB 色相環に沿った 12 色（S/B はビビッド寄り: HSL 100% / 50%） */
const HUE_RING = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as const;
const HUE_LABELS = [
  "H0 赤",
  "H30",
  "H60 黄",
  "H90",
  "H120 緑",
  "H150",
  "H180 シアン",
  "H210",
  "H240 青",
  "H270",
  "H300 マゼンタ",
  "H330",
] as const;
const NON_RED_HUE_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

function hslToHex(h: number, sPct: number, lPct: number): string {
  const s = sPct / 100;
  const l = lPct / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) {
    rp = c;
    gp = x;
  } else if (h < 120) {
    rp = x;
    gp = c;
  } else if (h < 180) {
    gp = c;
    bp = x;
  } else if (h < 240) {
    gp = x;
    bp = c;
  } else if (h < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  const r = Math.round((rp + m) * 255);
  const g = Math.round((gp + m) * 255);
  const b = Math.round((bp + m) * 255);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

const FULL_PALETTE_12: readonly TapColoringSwatch[] = HUE_RING.map((h, i) => ({
  label: HUE_LABELS[i]!,
  color: hslToHex(h, 100, 50),
}));

/** 12色環で基準を1つランダムに選び、+3/+4 と -3/-4 をそれぞれランダムに1つずつ取った3色 */
function pickTriadPalette(): TapColoringSwatch[] {
  const baseIdx = NON_RED_HUE_INDICES[Math.floor(Math.random() * NON_RED_HUE_INDICES.length)]!;
  const posStep = Math.random() < 0.5 ? 3 : 4;
  const negStep = Math.random() < 0.5 ? 3 : 4;
  let iPos = (baseIdx + posStep) % 12;
  let iNeg = (baseIdx - negStep + 12) % 12;

  // 純赤（H0）はパレット候補から除外する
  if (iPos === 0) iPos = 1;
  if (iNeg === 0) iNeg = 11;

  const indices = [baseIdx, iPos, iNeg];
  const used = new Set<number>();
  const resolved: number[] = [];
  for (const idx of indices) {
    if (idx !== 0 && !used.has(idx)) {
      used.add(idx);
      resolved.push(idx);
      continue;
    }
    const alt = NON_RED_HUE_INDICES.find((h) => !used.has(h)) ?? 1;
    used.add(alt);
    resolved.push(alt);
  }
  return resolved.map((idx) => FULL_PALETTE_12[idx]!);
}

function paletteForHistoryEntry(entry: TapColoringHistoryEntry): TapColoringSwatch[] {
  const sw = entry.paletteSwatches;
  if (sw && sw.length === 3) return sw.map((s) => ({ label: s.label, color: s.color.toLowerCase() }));
  return pickTriadPalette();
}

const DEFAULT_FILL_THRESHOLD = 0.9;
const DEFAULT_SPLATTER_RADIUS_VB = 12.5;
/** 黒枠内イラストの拡大（`createPictureFrame` の 0.76 に乗算。デバッグで変更可） */
const DEFAULT_ILLUSTRATION_SCALE = 1.25;
const SCAN_STRIDE = 2;
/** マスク干渉切り分け用（true で枠外でも描ける） */
const DEBUG_DISABLE_MASK = false;

const SPLATTER_IMAGE_COUNT = 9;
const SPLATTER_PUBLIC_PREFIX = "/assets/tap-coloring";
const PICTURE_PUBLIC_PREFIX = "/assets/tap-coloring/Pictures";
const ANIMAL_PICTURE_COUNT = 12;
const PRODUCE_PICTURE_COUNT = 10;
const VEHICLE_PICTURE_COUNT = 12;

/** 表示は CSS で論理サイズのまま、ビットマップを拡大して縮小表示のジャギーを抑える */
const TAP_COLOR_INTERNAL_SCALE = 2;

/** スプラッター元画像の長辺上限（メモリと縮小描画品質のバランス） */
const SPLATTER_SOURCE_MAX_SIDE_PX = 320;

/** 画面上のパーティクル半径の基準（論理 px 相当） */
const PARTICLE_RADIUS_LOGICAL_PX = 5;

/** インク輪郭のわずかな柔らかさ（ビットマップ座標。2 倍解像度時は画面上で約半分に見える） */
const INK_SPLAT_SHADOW_BLUR_BITMAP_PX = 3;
const SUCCESS_UI_FADE_MS = 300;
/** 塗り達成時の拡縮（Squash & Stretch）の再生時間（秒） */
const SUCCESS_SQUASH_DURATION_S = 0.54;
/** 拡縮アニメ終了後、退場（transition）へ入るまでのウェイト */
const SUCCESS_HOLD_AFTER_SQUASH_MS = 500;
const TRANSITION_BG_MS = 1000;
const TRANSITION_SLIDE_MS = 560;
const SETUP_ENTER_MS = 620;
const RESUME_UI_MS = 300;
/** 履歴編集の深度クロスフェード（スライド切替とは別） */
const HISTORY_DEPTH_OVERLAY_S = 0.48;

type PictureCategory = "animal" | "produce" | "vehicle";

type StashedPlaySession = {
  pictureIndex: number;
  paintDataUrl: string;
  previewDataUrl: string;
  activePalette: TapColoringSwatch[];
  selectedColor: string;
};

type HistoryOverlayState =
  | null
  | { kind: "enter"; phase: "stash-shrink" | "history-expand"; stashUrl: string; historyUrl: string }
  | { kind: "exit"; phase: "outgoing-shrink" | "stash-expand"; stashUrl: string; outgoingUrl: string };

type ColoringPictureAsset = {
  id: string;
  label: string;
  category: PictureCategory;
  src: string;
};

function buildPictureAssets(
  category: PictureCategory,
  prefix: "Animal" | "Produce" | "Vehicle",
  count: number,
  labelPrefix: string,
): ColoringPictureAsset[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const code = String(n).padStart(2, "0");
    return {
      id: `${category}-${code}`,
      label: `${labelPrefix} ${code}`,
      category,
      src: `${PICTURE_PUBLIC_PREFIX}/Picture_${prefix}_${code}.png`,
    };
  });
}

const COLORING_PICTURE_ASSETS: readonly ColoringPictureAsset[] = [
  ...buildPictureAssets("animal", "Animal", ANIMAL_PICTURE_COUNT, "どうぶつ"),
  ...buildPictureAssets("produce", "Produce", PRODUCE_PICTURE_COUNT, "やさい・くだもの"),
  ...buildPictureAssets("vehicle", "Vehicle", VEHICLE_PICTURE_COUNT, "のりもの"),
];

function pickRandomPictureIndex(previousIndex: number | null): number {
  if (COLORING_PICTURE_ASSETS.length <= 1) return 0;
  if (previousIndex == null) return Math.floor(Math.random() * COLORING_PICTURE_ASSETS.length);

  const prevCategory = COLORING_PICTURE_ASSETS[previousIndex]?.category;
  const candidates: number[] = [];
  for (let i = 0; i < COLORING_PICTURE_ASSETS.length; i++) {
    if (COLORING_PICTURE_ASSETS[i]!.category !== prevCategory) candidates.push(i);
  }
  if (candidates.length === 0) return Math.floor(Math.random() * COLORING_PICTURE_ASSETS.length);
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

function applyCanvasInkQuality(ctx: CanvasRenderingContext2D) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}

const canvasInkStyle = { imageRendering: "auto" } as const;

/**
 * インク用スプラッター PNG を、小さな drawImage に耐える解像度へ一度だけ整える
 */
function createInkOptimizedSplatterSource(img: HTMLImageElement): HTMLCanvasElement | HTMLImageElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w < 1 || h < 1) return img;
  const maxSide = Math.max(w, h);
  if (maxSide <= SPLATTER_SOURCE_MAX_SIDE_PX) return img;
  const scale = SPLATTER_SOURCE_MAX_SIDE_PX / maxSide;
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const c = document.createElement("canvas");
  c.width = nw;
  c.height = nh;
  const ctx = c.getContext("2d");
  if (!ctx) return img;
  applyCanvasInkQuality(ctx);
  ctx.drawImage(img, 0, 0, nw, nh);
  return c;
}

/**
 * PNG を黒シルエット化したうえで source-in 着色（アルファ形状は維持）
 */
function tintSplatterToCanvas(
  source: CanvasImageSource,
  tintRgb: { r: number; g: number; b: number },
  outW: number,
  outH: number,
  out: HTMLCanvasElement,
): void {
  const rw = Math.max(1, Math.round(outW));
  const rh = Math.max(1, Math.round(outH));
  out.width = rw;
  out.height = rh;
  const ctx = out.getContext("2d");
  if (!ctx) return;
  applyCanvasInkQuality(ctx);
  ctx.clearRect(0, 0, rw, rh);
  ctx.drawImage(source, 0, 0, rw, rh);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, rw, rh);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = `rgb(${tintRgb.r},${tintRgb.g},${tintRgb.b})`;
  ctx.fillRect(0, 0, rw, rh);
  ctx.globalCompositeOperation = "source-over";
}

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type ColoringPhase = "play" | "success" | "transition" | "setup" | "resume";

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const FULL_PALETTE_RGB = FULL_PALETTE_12.map((s) => parseHexRgb(s.color)!);

function colorDistanceSq(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function splatterSourceSize(src: HTMLImageElement | HTMLCanvasElement): { w: number; h: number } {
  if (src instanceof HTMLCanvasElement) return { w: src.width, h: src.height };
  return { w: src.naturalWidth, h: src.naturalHeight };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function randomPastel(): string {
  const h = Math.floor(Math.random() * 360);
  const s = 68;
  const l = 88;
  return `hsl(${h} ${s}% ${l}%)`;
}

function playSuccessPong(): void {
  if (typeof window === "undefined") return;
  const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(420, t0);
  osc.frequency.exponentialRampToValueAtTime(660, t0 + 0.07);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.2);
}

function playSlideWhoosh(): void {
  if (typeof window === "undefined") return;
  const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const t0 = ctx.currentTime;
  const bufferSize = ctx.sampleRate * 0.22;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    const env = (1 - t) * (1 - t);
    data[i] = (Math.random() * 2 - 1) * env * 0.2;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 520;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + 0.21);
}

/** 塗り絵シルエットの最大占有（canvas 一辺に対する比率）。`illustrationScale` で拡大（既定 ~1.25） */
function createPictureFrame(
  canvasSize: number,
  srcW: number,
  srcH: number,
  illustrationScale: number,
): { drawW: number; drawH: number; drawX: number; drawY: number } {
  const maxBox = canvasSize * Math.min(0.94, 0.76 * illustrationScale);
  const scale = Math.min(maxBox / srcW, maxBox / srcH);
  const drawW = Math.max(1, Math.round(srcW * scale));
  const drawH = Math.max(1, Math.round(srcH * scale));
  const drawX = Math.round((canvasSize - drawW) / 2);
  const drawY = Math.round((canvasSize - drawH) / 2);
  return { drawW, drawH, drawX, drawY };
}

function nearestHueIndexFromRgb(r: number, g: number, b: number): number {
  let bestIdx = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < FULL_PALETTE_RGB.length; i++) {
    const p = FULL_PALETTE_RGB[i]!;
    const d = colorDistanceSq({ r, g, b }, p);
    if (d < best) {
      best = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** 12色環上の最短弧の長さ（隣＝1、対極＝6） */
function circularHueDistance(fromIdx: number, toIdx: number): number {
  const d = Math.abs(fromIdx - toIdx);
  return Math.min(d, 12 - d);
}

/** 12色環上で from を to 方向へちょうど1ステップ（最短弧、同距離は時計回り） */
function hueStepOnceToward(fromIdx: number, toIdx: number): number {
  if (fromIdx === toIdx) return fromIdx;
  const cw = (toIdx - fromIdx + 12) % 12;
  const ccw = (fromIdx - toIdx + 12) % 12;
  if (cw <= ccw) return (fromIdx + 1) % 12;
  return (fromIdx + 11) % 12;
}

/**
 * 距離1: いきなり選択色へ
 * 距離2,3: 1ステップ
 * 距離4,5,6: 2ステップ（毎回 to 方向へ hueStepOnceToward）
 */
function hueStepAdaptive(fromIdx: number, toIdx: number): number {
  if (fromIdx === toIdx) return fromIdx;
  const dist = circularHueDistance(fromIdx, toIdx);
  if (dist === 1) return toIdx;
  const repeats = dist >= 4 ? 2 : 1;
  let cur = fromIdx;
  for (let s = 0; s < repeats; s++) {
    cur = hueStepOnceToward(cur, toIdx);
  }
  return cur;
}

/** マスク（白＝内側）とペイント層から、内側ピクセルに対する塗り率を算出（stride で間引きスキャン） */
function computeFillRatio(maskData: ImageData, paintData: ImageData, stride: number): number {
  let inside = 0;
  let filled = 0;
  const w = maskData.width;
  const h = maskData.height;
  for (let y = 0; y < h; y += stride) {
    for (let x = 0; x < w; x += stride) {
      const i = (y * w + x) * 4;
      const m = maskData.data[i]! + maskData.data[i + 1]! + maskData.data[i + 2]!;
      if (m < 380) continue;
      inside++;
      const a = paintData.data[i + 3]!;
      if (a > 28) filled++;
    }
  }
  if (inside === 0) return 0;
  return filled / inside;
}

export type ColoringCanvasHandle = {
  loadHistoryEntry: (entry: TapColoringHistoryEntry) => boolean;
  /** 現在の塗り状態を履歴に追加（ゲーム進行は変えない） */
  saveCurrentWorkToHistory: () => boolean;
  /** 高画質合成プレビュー用 PNG をプレビューとして履歴に保存 */
  saveCurrentWorkToHistoryWithPreview: (previewDataUrl: string) => boolean;
  /** 表示キャンバス＋背景色から 1024 出力用 data URL を生成 */
  composeHighResExport: (options: TapColoringExportOptions) => Promise<string | null>;
};

type ColoringCanvasProps = {
  onHistoryUpdated?: () => void;
  /** 履歴サムネの差し替え直後（揺れ演出用） */
  onHistoryEntryReplaced?: (entryId: string) => void;
  /** 履歴シーケンス中は false（作品履歴の操作を止める） */
  onHistorySequenceInteractionChange?: (interactionAllowed: boolean) => void;
};

export const ColoringCanvas = forwardRef<ColoringCanvasHandle, ColoringCanvasProps>(function ColoringCanvas(
  { onHistoryUpdated, onHistoryEntryReplaced, onHistorySequenceInteractionChange },
  ref,
) {
  const searchParams = useSearchParams();
  const isDevTj = searchParams.get("devtj") === "true";

  const containerRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLCanvasElement | null>(null) as MutableRefObject<HTMLCanvasElement | null>;
  const maskRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef<HTMLCanvasElement>(null);

  const [size, setSize] = useState(360);
  const [stageIndex, setStageIndex] = useState(0);
  const [pictureIndex, setPictureIndex] = useState(() => pickRandomPictureIndex(null));
  const [activePalette, setActivePalette] = useState<TapColoringSwatch[]>(() => pickTriadPalette());
  const [selected, setSelected] = useState<TapColoringSwatch>(() => activePalette[0]!);
  const [phase, setPhase] = useState<ColoringPhase>("play");
  const [sceneBgColor, setSceneBgColor] = useState("#fafaf9");

  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isDebugPanelExpanded, setIsDebugPanelExpanded] = useState(true);
  const [debugSplatterRadiusVb, setDebugSplatterRadiusVb] = useState(DEFAULT_SPLATTER_RADIUS_VB);
  const [debugFillThreshold, setDebugFillThreshold] = useState(DEFAULT_FILL_THRESHOLD);
  const [debugIllustrationScale, setDebugIllustrationScale] = useState(DEFAULT_ILLUSTRATION_SCALE);

  const splatterRadiusVb = isDevTj && isDebugMode ? debugSplatterRadiusVb : DEFAULT_SPLATTER_RADIUS_VB;
  const fillThreshold = isDevTj && isDebugMode ? debugFillThreshold : DEFAULT_FILL_THRESHOLD;
  const illustrationScale =
    isDevTj && isDebugMode ? debugIllustrationScale : DEFAULT_ILLUSTRATION_SCALE;

  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const pictureBaseRef = useRef<HTMLCanvasElement | null>(null);
  const pictureLineOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const clearTriggeredRef = useRef(false);
  /** ギャラリー再開中は 90% クリアを発動しない */
  const freePaintWithoutClearRef = useRef(false);
  const pendingHistoryEntryRef = useRef<TapColoringHistoryEntry | null>(null);
  const stashSessionRef = useRef<StashedPlaySession | null>(null);
  const editingHistoryEntryRef = useRef<TapColoringHistoryEntry | null>(null);
  const historyOverlayEnterTargetRef = useRef<TapColoringHistoryEntry | null>(null);
  const shouldShowExitAfterPendingPaintRef = useRef(false);
  /** 履歴編集でキャンバス key 切替時にスライドではなく奥行きのみ使う */
  const [canvasPresenceDepth, setCanvasPresenceDepth] = useState(false);
  /** オーバーレイ解除＋ペイント適用後、奥行き途中のキャンバスを一瞬で最終姿勢へ（二重拡大防止） */
  const [galleryHandoffSkipToRest, setGalleryHandoffSkipToRest] = useState(false);
  /** true の間はパレット・キャンバス塗り・（親経由で）作品履歴を無効化 */
  const [historyChromeInteractionLocked, setHistoryChromeInteractionLocked] = useState(false);
  /** 編集終了後スタッシュ復元時にパレットを戻す（`stashSessionRef` は completeHistoryExit で先に消す） */
  const stashPaletteRestoreRef = useRef<{ swatches: TapColoringSwatch[]; selectedColor: string } | null>(null);
  /** 履歴シーケンス直後のパレット表示だけフェードを切り、キャンバスとの合成チラつきを抑える */
  const paletteUnlockNoFadeRef = useRef(false);
  /**
   * 履歴の「編集開始でステージ更新」「編集終了でスタッシュ復元」のマウント時に
   * スライド／opacity 入場を掛けない（Framer の initial/exit を実質オフにする）。
   */
  const historyCanvasSuppressMountTransitionRef = useRef(false);

  const [historyOverlay, setHistoryOverlay] = useState<HistoryOverlayState>(null);
  const historyOverlayRef = useRef<HistoryOverlayState>(null);
  useEffect(() => {
    historyOverlayRef.current = historyOverlay;
  }, [historyOverlay]);

  useEffect(() => {
    if (!galleryHandoffSkipToRest) return;
    const id = requestAnimationFrame(() => setGalleryHandoffSkipToRest(false));
    return () => cancelAnimationFrame(id);
  }, [galleryHandoffSkipToRest]);

  useLayoutEffect(() => {
    if (!historyChromeInteractionLocked && paletteUnlockNoFadeRef.current) {
      const id = requestAnimationFrame(() => {
        paletteUnlockNoFadeRef.current = false;
      });
      return () => cancelAnimationFrame(id);
    }
  }, [historyChromeInteractionLocked]);

  const [showHistoryExitButton, setShowHistoryExitButton] = useState(false);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  /** キャンバスでポインタが押下中（この間にクリア→次ステージへ進んだら、離すまで塗りを止める） */
  const pointerDownOnCanvasRef = useRef(false);
  /** クリア後の新ステージで、直前のドラッグが続いているとき true。対応する pointerup まで塗り禁止 */
  const blockPaintUntilPointerUpRef = useRef(false);
  const activeCanvasPointerIdRef = useRef<number | null>(null);
  const splatterImagesRef = useRef<(HTMLImageElement | HTMLCanvasElement)[]>([]);
  const coloringPictureImagesRef = useRef<HTMLImageElement[]>([]);
  const [splatterImagesReady, setSplatterImagesReady] = useState(false);
  const [coloringPicturesReady, setColoringPicturesReady] = useState(false);
  const sequenceRunningRef = useRef(false);
  const bitmapSize = Math.round(size * TAP_COLOR_INTERNAL_SCALE);
  const paintScalePx = (bitmapSize * 0.82) / 100;
  const currentPictureAsset = COLORING_PICTURE_ASSETS[pictureIndex]!;

  const releaseCanvasPointer = useCallback((pointerId: number) => {
    if (pointerId !== activeCanvasPointerIdRef.current) return;
    activeCanvasPointerIdRef.current = null;
    pointerDownOnCanvasRef.current = false;
    blockPaintUntilPointerUpRef.current = false;
  }, []);

  useEffect(() => {
    const onWindowPointerEnd = (e: PointerEvent) => {
      releaseCanvasPointer(e.pointerId);
    };
    window.addEventListener("pointerup", onWindowPointerEnd);
    window.addEventListener("pointercancel", onWindowPointerEnd);
    return () => {
      window.removeEventListener("pointerup", onWindowPointerEnd);
      window.removeEventListener("pointercancel", onWindowPointerEnd);
    };
  }, [releaseCanvasPointer]);

  useEffect(() => {
    setSelected((prev) => {
      const still = activePalette.some((s) => s.color === prev.color);
      return still ? prev : activePalette[0]!;
    });
  }, [activePalette]);

  const redrawDisplay = useCallback(() => {
    const display = displayRef.current;
    const paint = paintRef.current;
    if (!display || !paint) return;

    const ctx = display.getContext("2d");
    if (!ctx) return;
    applyCanvasInkQuality(ctx);

    const w = display.width;
    const h = display.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#fafaf9";
    ctx.fillRect(0, 0, w, h);

    const pictureBase = pictureBaseRef.current;
    if (pictureBase) ctx.drawImage(pictureBase, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(paint, 0, 0);
    ctx.restore();

    const lineOverlay = pictureLineOverlayRef.current;
    if (lineOverlay) ctx.drawImage(lineOverlay, 0, 0);

    const parts = particlesRef.current;
    const pr = PARTICLE_RADIUS_LOGICAL_PX * TAP_COLOR_INTERNAL_SCALE;
    if (parts.length > 0) {
      for (const p of parts) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pr * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }, []);

  const runParticles = useCallback(() => {
    const step = () => {
      const parts = particlesRef.current;
      let alive = false;
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18;
        p.life *= 0.91;
        if (p.life > 0.04) alive = true;
      }
      particlesRef.current = parts.filter((p) => p.life > 0.04);
      redrawDisplay();
      if (alive) rafRef.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  }, [redrawDisplay]);

  const measureFill = useCallback(() => {
    const mask = maskRef.current;
    const paint = paintRef.current;
    if (!mask || !paint) return 0;
    const maskCtx = mask.getContext("2d", { willReadFrequently: true });
    const paintCtx = paint.getContext("2d", { willReadFrequently: true });
    if (!maskCtx || !paintCtx) return 0;
    const maskData = maskCtx.getImageData(0, 0, mask.width, mask.height);
    const paintData = paintCtx.getImageData(0, 0, paint.width, paint.height);
    return computeFillRatio(maskData, paintData, SCAN_STRIDE);
  }, []);

  const pushHistoryFromCanvas = useCallback(
    (previewDataUrl: string) => {
      const display = displayRef.current;
      const paint = paintRef.current;
      if (!display || !paint) return false;
      particlesRef.current = [];
      cancelAnimationFrame(rafRef.current);
      redrawDisplay();
      const paintDataUrl = paint.toDataURL("image/png");
      prependTapColoringHistory({
        pictureId: currentPictureAsset.id,
        savedBitmapSize: bitmapSize,
        paintDataUrl,
        previewDataUrl,
        paletteSwatches: activePalette.map((s) => ({ label: s.label, color: s.color.toLowerCase() })),
        paletteSelectedColor: selected.color.toLowerCase(),
      });
      onHistoryUpdated?.();
      return true;
    },
    [activePalette, bitmapSize, currentPictureAsset.id, redrawDisplay, onHistoryUpdated, selected.color],
  );

  const appendHistorySnapshot = useCallback(() => {
    const display = displayRef.current;
    const paint = paintRef.current;
    if (!display || !paint) return;
    const previewDataUrl = buildPreviewDataUrlFromDisplay(display);
    void pushHistoryFromCanvas(previewDataUrl);
  }, [pushHistoryFromCanvas]);

  const initStageCanvases = useCallback(() => {
    const display = displayRef.current;
    const mask = maskRef.current;
    const paint = paintRef.current;
    if (!display || !mask || !paint) return;
    const picture = coloringPictureImagesRef.current[pictureIndex];
    if (!picture || !picture.complete || picture.naturalWidth < 1 || picture.naturalHeight < 1) return;

    const w = bitmapSize;
    const h = bitmapSize;
    display.width = w;
    display.height = h;
    mask.width = w;
    mask.height = h;
    paint.width = w;
    paint.height = h;

    const mctx = mask.getContext("2d");
    const pctx = paint.getContext("2d");
    if (!mctx || !pctx) return;
    applyCanvasInkQuality(mctx);
    applyCanvasInkQuality(pctx);
    const { drawW, drawH, drawX, drawY } = createPictureFrame(
      bitmapSize,
      picture.naturalWidth,
      picture.naturalHeight,
      illustrationScale,
    );

    mctx.clearRect(0, 0, w, h);
    mctx.drawImage(picture, drawX, drawY, drawW, drawH);
    const maskImg = mctx.getImageData(0, 0, w, h);
    for (let i = 0; i < maskImg.data.length; i += 4) {
      const a = maskImg.data[i + 3]!;
      if (a < 12) {
        maskImg.data[i] = 0;
        maskImg.data[i + 1] = 0;
        maskImg.data[i + 2] = 0;
        maskImg.data[i + 3] = 0;
        continue;
      }
      const bright = maskImg.data[i]! + maskImg.data[i + 1]! + maskImg.data[i + 2]!;
      if (bright >= 690) {
        maskImg.data[i] = 255;
        maskImg.data[i + 1] = 255;
        maskImg.data[i + 2] = 255;
        maskImg.data[i + 3] = 255;
      } else {
        maskImg.data[i] = 0;
        maskImg.data[i + 1] = 0;
        maskImg.data[i + 2] = 0;
        maskImg.data[i + 3] = 0;
      }
    }
    mctx.putImageData(maskImg, 0, 0);

    const baseCanvas = document.createElement("canvas");
    baseCanvas.width = w;
    baseCanvas.height = h;
    const bctx = baseCanvas.getContext("2d");
    if (!bctx) return;
    applyCanvasInkQuality(bctx);
    bctx.clearRect(0, 0, w, h);
    bctx.drawImage(picture, drawX, drawY, drawW, drawH);
    pictureBaseRef.current = baseCanvas;

    const lineOverlayCanvas = document.createElement("canvas");
    lineOverlayCanvas.width = w;
    lineOverlayCanvas.height = h;
    const lctx = lineOverlayCanvas.getContext("2d");
    if (!lctx) return;
    applyCanvasInkQuality(lctx);
    lctx.clearRect(0, 0, w, h);
    lctx.drawImage(picture, drawX, drawY, drawW, drawH);
    const lineImage = lctx.getImageData(0, 0, w, h);
    for (let i = 0; i < lineImage.data.length; i += 4) {
      const a = lineImage.data[i + 3]!;
      const bright = lineImage.data[i]! + lineImage.data[i + 1]! + lineImage.data[i + 2]!;
      if (a < 12 || bright > 330) {
        lineImage.data[i + 3] = 0;
      } else {
        lineImage.data[i] = 0;
        lineImage.data[i + 1] = 0;
        lineImage.data[i + 2] = 0;
        lineImage.data[i + 3] = 255;
      }
    }
    lctx.putImageData(lineImage, 0, 0);
    pictureLineOverlayRef.current = lineOverlayCanvas;

    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, w, h);

    redrawDisplay();

    const pend = pendingHistoryEntryRef.current;
    if (pend && pend.pictureId === COLORING_PICTURE_ASSETS[pictureIndex]?.id) {
      pendingHistoryEntryRef.current = null;
      const img = new Image();
      img.onload = () => {
        const paintEl = paintRef.current;
        const maskEl = maskRef.current;
        if (!paintEl || !maskEl) return;
        const pctx2 = paintEl.getContext("2d");
        if (!pctx2) return;
        pctx2.setTransform(1, 0, 0, 1, 0, 0);
        pctx2.clearRect(0, 0, paintEl.width, paintEl.height);
        pctx2.drawImage(img, 0, 0, paintEl.width, paintEl.height);
        if (!DEBUG_DISABLE_MASK) {
          pctx2.save();
          pctx2.globalCompositeOperation = "destination-in";
          pctx2.drawImage(maskEl, 0, 0);
          pctx2.restore();
        }
        redrawDisplay();
        if (shouldShowExitAfterPendingPaintRef.current) {
          shouldShowExitAfterPendingPaintRef.current = false;
          setGalleryHandoffSkipToRest(true);
          setHistoryOverlay(null);
          setCanvasPresenceDepth(false);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              historyCanvasSuppressMountTransitionRef.current = false;
              paletteUnlockNoFadeRef.current = true;
              redrawDisplay();
              setShowHistoryExitButton(true);
              setHistoryChromeInteractionLocked(false);
              onHistorySequenceInteractionChange?.(true);
            });
          });
        } else if (pend.id === "__stash_restore__") {
          setGalleryHandoffSkipToRest(true);
          setHistoryOverlay(null);
          requestAnimationFrame(() => {
            setCanvasPresenceDepth(false);
            requestAnimationFrame(() => {
              const pr = stashPaletteRestoreRef.current;
              stashPaletteRestoreRef.current = null;
              if (pr) {
                setActivePalette(pr.swatches);
                const want = pr.selectedColor.toLowerCase();
                setSelected(pr.swatches.find((s) => s.color === want) ?? pr.swatches[0]!);
              }
              historyCanvasSuppressMountTransitionRef.current = false;
              paletteUnlockNoFadeRef.current = true;
              redrawDisplay();
              setHistoryChromeInteractionLocked(false);
              onHistorySequenceInteractionChange?.(true);
            });
          });
        }
      };
      img.onerror = () => {
        redrawDisplay();
        if (shouldShowExitAfterPendingPaintRef.current) {
          shouldShowExitAfterPendingPaintRef.current = false;
          setGalleryHandoffSkipToRest(true);
          setHistoryOverlay(null);
          setCanvasPresenceDepth(false);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              historyCanvasSuppressMountTransitionRef.current = false;
              paletteUnlockNoFadeRef.current = true;
              redrawDisplay();
              setShowHistoryExitButton(true);
              setHistoryChromeInteractionLocked(false);
              onHistorySequenceInteractionChange?.(true);
            });
          });
        } else if (pend.id === "__stash_restore__") {
          setGalleryHandoffSkipToRest(true);
          setHistoryOverlay(null);
          requestAnimationFrame(() => {
            setCanvasPresenceDepth(false);
            requestAnimationFrame(() => {
              const pr = stashPaletteRestoreRef.current;
              stashPaletteRestoreRef.current = null;
              if (pr) {
                setActivePalette(pr.swatches);
                const want = pr.selectedColor.toLowerCase();
                setSelected(pr.swatches.find((s) => s.color === want) ?? pr.swatches[0]!);
              }
              historyCanvasSuppressMountTransitionRef.current = false;
              paletteUnlockNoFadeRef.current = true;
              redrawDisplay();
              setHistoryChromeInteractionLocked(false);
              onHistorySequenceInteractionChange?.(true);
            });
          });
        }
      };
      img.src = pend.paintDataUrl;
    }
  }, [
    coloringPicturesReady,
    bitmapSize,
    pictureIndex,
    illustrationScale,
    redrawDisplay,
    onHistorySequenceInteractionChange,
  ]);

  const initStageCanvasesRef = useRef(initStageCanvases) as MutableRefObject<typeof initStageCanvases>;
  useLayoutEffect(() => {
    initStageCanvasesRef.current = initStageCanvases;
  }, [initStageCanvases]);

  /** AnimatePresence の新しい表示 canvas マウント後に初期化（古い canvas へ描いて捨てられるのを防ぐ） */
  const setDisplayCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    displayRef.current = node;
    if (node) {
      queueMicrotask(() => {
        initStageCanvasesRef.current();
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const imgs: HTMLImageElement[] = [];
    let pending = SPLATTER_IMAGE_COUNT;
    const onDone = () => {
      pending -= 1;
      if (pending <= 0 && !cancelled) {
        splatterImagesRef.current = imgs.map((im) => createInkOptimizedSplatterSource(im));
        setSplatterImagesReady(true);
      }
    };
    for (let i = 1; i <= SPLATTER_IMAGE_COUNT; i++) {
      const im = new Image();
      im.decoding = "async";
      im.onload = onDone;
      im.onerror = onDone;
      im.src = `${SPLATTER_PUBLIC_PREFIX}/splatter_${String(i).padStart(2, "0")}.png`;
      imgs.push(im);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const imgs: HTMLImageElement[] = [];
    let pending = COLORING_PICTURE_ASSETS.length;
    const onDone = () => {
      pending -= 1;
      if (pending <= 0 && !cancelled) {
        coloringPictureImagesRef.current = imgs;
        setColoringPicturesReady(true);
      }
    };
    for (const asset of COLORING_PICTURE_ASSETS) {
      const im = new Image();
      im.decoding = "async";
      im.onload = onDone;
      im.onerror = onDone;
      im.src = asset.src;
      imgs.push(im);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cw = el.clientWidth;
      const isLg = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const reserveY = isLg ? 210 : 160;
      const maxByHeight = Math.max(240, Math.floor((vh - reserveY) * 0.62));
      const capW = isLg ? Math.min(380, maxByHeight, cw - 12) : Math.min(420, cw - 8);
      const next = Math.max(260, Math.min(420, Math.floor(capW), maxByHeight));
      setSize((s) => (Math.abs(s - next) > 4 ? next : s));
    });
    ro.observe(el);
    const cw = el.clientWidth;
    const isLg = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const reserveY = isLg ? 210 : 160;
    const maxByHeight = Math.max(240, Math.floor((vh - reserveY) * 0.62));
    const capW = isLg ? Math.min(380, maxByHeight, cw - 12) : Math.min(420, cw - 8);
    setSize(Math.max(260, Math.min(420, Math.floor(capW), maxByHeight)));
    return () => ro.disconnect();
  }, []);

  /** リサイズ時のみ再初期化（画像切替は新canvasマウント時に setDisplayCanvasRef 側で行う） */
  useEffect(() => {
    if (!displayRef.current) return;
    if (!coloringPicturesReady) return;
    initStageCanvasesRef.current();
  }, [coloringPicturesReady, size, illustrationScale]);

  const spawnParticles = (cx: number, cy: number, color: string) => {
    const n = 14;
    const parts: Particle[] = [];
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const sp = 2 + Math.random() * 3;
      parts.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2,
        life: 0.85 + Math.random() * 0.15,
        color,
      });
    }
    particlesRef.current = parts;
    runParticles();
  };

  const spawnCelebrationParticles = useCallback((cx: number, cy: number) => {
    const colors = ["#fff3b0", "#bde0fe", "#caffbf", "#ffd6a5", "#ffc6ff"];
    const n = 42;
    const parts: Particle[] = [];
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const sp = 2.4 + Math.random() * 5.8;
      parts.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2.2,
        life: 0.86 + Math.random() * 0.14,
        color: colors[i % colors.length]!,
      });
    }
    particlesRef.current = [...particlesRef.current, ...parts];
    runParticles();
  }, [runParticles]);

  const runClearSequence = useCallback(async (px: number, py: number) => {
    if (sequenceRunningRef.current) return;
    sequenceRunningRef.current = true;
    appendHistorySnapshot();
    clearTriggeredRef.current = true;
    setPhase("success");
    playSuccessPong();
    spawnCelebrationParticles(px, py);
    blockPaintUntilPointerUpRef.current = true;

    await sleep(
      Math.max(SUCCESS_UI_FADE_MS, Math.round(SUCCESS_SQUASH_DURATION_S * 1000)) + SUCCESS_HOLD_AFTER_SQUASH_MS,
    );
    setPhase("transition");
    setSceneBgColor(randomPastel());
    playSlideWhoosh();

    // 退場アニメーション完了後にのみ次絵へ切り替える
    await sleep(TRANSITION_SLIDE_MS);
    setActivePalette(pickTriadPalette());
    setPictureIndex((prev) => pickRandomPictureIndex(prev));
    setStageIndex((i) => i + 1);
    setPhase("setup");

    await sleep(SETUP_ENTER_MS);
    setPhase("resume");
    await sleep(RESUME_UI_MS);
    setPhase("play");
    if (!pointerDownOnCanvasRef.current) blockPaintUntilPointerUpRef.current = false;
    clearTriggeredRef.current = false;
    sequenceRunningRef.current = false;
  }, [appendHistorySnapshot, spawnCelebrationParticles]);

  const paintAt = (clientX: number, clientY: number) => {
    if (historyChromeInteractionLocked) return;
    if (phase !== "play") return;
    if (blockPaintUntilPointerUpRef.current) return;
    const canvas = displayRef.current;
    const mask = maskRef.current;
    const paint = paintRef.current;
    if (!canvas || !paint || !mask) return;

    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * canvas.width;
    const py = ((clientY - rect.top) / rect.height) * canvas.height;

    const pctx = paint.getContext("2d");
    const mctx = mask.getContext("2d", { willReadFrequently: true });
    if (!pctx || !mctx) return;
    applyCanvasInkQuality(pctx);

    if (!DEBUG_DISABLE_MASK) {
      const mx = Math.max(0, Math.min(mask.width - 1, Math.floor(px)));
      const my = Math.max(0, Math.min(mask.height - 1, Math.floor(py)));
      const a = mctx.getImageData(mx, my, 1, 1).data[3]!;
      if (a < 10) return;
    }

    const selRgb = parseHexRgb(selected.color);
    if (!selRgb) return;
    if (!splatterImagesReady) return;
    const targetHueIdx = nearestHueIndexFromRgb(selRgb.r, selRgb.g, selRgb.b);

    const imgs = splatterImagesRef.current;
    const img = imgs[Math.floor(Math.random() * SPLATTER_IMAGE_COUNT)];
    if (!img) return;
    if (img instanceof HTMLImageElement && !img.complete) return;
    const { w: srcW, h: srcH } = splatterSourceSize(img);
    if (srcW < 1 || srcH < 1) return;

    const scaleJitter = 0.8 + Math.random() * 0.4;
    const baseDiameter = 2 * splatterRadiusVb * paintScalePx * scaleJitter;
    const ar = srcW / srcH;
    let drawW: number;
    let drawH: number;
    if (ar >= 1) {
      drawW = baseDiameter;
      drawH = baseDiameter / ar;
    } else {
      drawH = baseDiameter;
      drawW = baseDiameter * ar;
    }
    drawW = Math.max(4, Math.round(drawW));
    drawH = Math.max(4, Math.round(drawH));

    const tintCanvas = document.createElement("canvas");
    tintSplatterToCanvas(img, selRgb, drawW, drawH, tintCanvas);

    const angle = Math.random() * Math.PI * 2;
    const halfSpan = (Math.hypot(drawW, drawH) / 2) * 1.1;
    const pad = Math.ceil(halfSpan + 2);
    const x0 = Math.max(0, Math.floor(px - pad));
    const y0 = Math.max(0, Math.floor(py - pad));
    const x1 = Math.min(paint.width, Math.ceil(px + pad));
    const y1 = Math.min(paint.height, Math.ceil(py + pad));
    const bw = x1 - x0;
    const bh = y1 - y0;
    if (bw <= 0 || bh <= 0) return;

    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = bw;
    tmpCanvas.height = bh;
    const tctx = tmpCanvas.getContext("2d");
    if (!tctx) return;
    applyCanvasInkQuality(tctx);
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.clearRect(0, 0, bw, bh);
    const dx = Math.round(px - x0);
    const dy = Math.round(py - y0);
    const ddx = Math.round(-drawW / 2);
    const ddy = Math.round(-drawH / 2);
    const dw = Math.round(drawW);
    const dh = Math.round(drawH);
    tctx.translate(dx, dy);
    tctx.rotate(angle);
    tctx.shadowColor = `rgb(${selRgb.r},${selRgb.g},${selRgb.b})`;
    tctx.shadowBlur = INK_SPLAT_SHADOW_BLUR_BITMAP_PX;
    tctx.shadowOffsetX = 0;
    tctx.shadowOffsetY = 0;
    tctx.drawImage(tintCanvas, ddx, ddy, dw, dh);
    tctx.shadowBlur = 0;
    tctx.shadowColor = "transparent";
    const splatData = tctx.getImageData(0, 0, bw, bh).data;

    const paintImage = pctx.getImageData(x0, y0, bw, bh);
    const data = paintImage.data;
    for (let i = 0; i < data.length; i += 4) {
      const sa = splatData[i + 3]!;
      if (sa < 24) continue;
      const a = data[i + 3]!;
      if (a < 28) {
        // 未塗りは選択色でベタ塗り
        data[i] = selRgb.r;
        data[i + 1] = selRgb.g;
        data[i + 2] = selRgb.b;
        data[i + 3] = 255;
      } else {
        // 既塗りは「前色→選択色方向」に1ステップ色相移動
        const curIdx = nearestHueIndexFromRgb(data[i]!, data[i + 1]!, data[i + 2]!);
        const nextIdx = hueStepAdaptive(curIdx, targetHueIdx);
        const next = FULL_PALETTE_RGB[nextIdx]!;
        data[i] = next.r;
        data[i + 1] = next.g;
        data[i + 2] = next.b;
        data[i + 3] = 255;
      }
    }
    pctx.putImageData(paintImage, x0, y0);

    if (!DEBUG_DISABLE_MASK) {
      pctx.save();
      pctx.setTransform(1, 0, 0, 1, 0, 0);
      pctx.globalCompositeOperation = "destination-in";
      pctx.globalAlpha = 1;
      pctx.drawImage(mask, 0, 0);
      pctx.globalCompositeOperation = "source-over";
      pctx.restore();
    }

    spawnParticles(px, py, selected.color);

    const ratio = measureFill();
    if (ratio >= fillThreshold && !clearTriggeredRef.current && !freePaintWithoutClearRef.current) {
      void runClearSequence(px, py);
    }
    redrawDisplay();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (historyChromeInteractionLocked) {
      e.preventDefault();
      return;
    }
    if (phase !== "play") {
      e.preventDefault();
      pointerDownOnCanvasRef.current = true;
      activeCanvasPointerIdRef.current = e.pointerId;
      return;
    }
    if (blockPaintUntilPointerUpRef.current) return;
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    pointerDownOnCanvasRef.current = true;
    activeCanvasPointerIdRef.current = e.pointerId;
    paintAt(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (historyChromeInteractionLocked) return;
    if (phase !== "play") return;
    if (blockPaintUntilPointerUpRef.current) return;
    if (e.buttons !== 1 && e.pointerType !== "touch") return;
    paintAt(e.clientX, e.clientY);
  };

  const onPointerUpCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    releaseCanvasPointer(e.pointerId);
  };

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const completeHistoryEnter = useCallback(() => {
    const target = historyOverlayEnterTargetRef.current;
    if (!target) return;
    historyOverlayEnterTargetRef.current = null;
    const idx = COLORING_PICTURE_ASSETS.findIndex((a) => a.id === target.pictureId);
    if (idx < 0) {
      stashSessionRef.current = null;
      setHistoryOverlay(null);
      setCanvasPresenceDepth(false);
      setHistoryChromeInteractionLocked(false);
      onHistorySequenceInteractionChange?.(true);
      return;
    }
    pendingHistoryEntryRef.current = target;
    freePaintWithoutClearRef.current = true;
    shouldShowExitAfterPendingPaintRef.current = true;
    editingHistoryEntryRef.current = target;
    setEditingHistoryId(target.id);
    const pal = paletteForHistoryEntry(target);
    setActivePalette(pal);
    const want = target.paletteSelectedColor?.toLowerCase();
    setSelected(pal.find((s) => s.color === want) ?? pal[0]!);
    historyCanvasSuppressMountTransitionRef.current = true;
    setPictureIndex(idx);
    setStageIndex((i) => i + 1);
    setPhase("play");
  }, [onHistorySequenceInteractionChange]);

  const completeHistoryExit = useCallback(() => {
    const stash = stashSessionRef.current;
    if (!stash) {
      historyCanvasSuppressMountTransitionRef.current = false;
      setHistoryOverlay(null);
      editingHistoryEntryRef.current = null;
      freePaintWithoutClearRef.current = false;
      setEditingHistoryId(null);
      return;
    }
    stashPaletteRestoreRef.current = {
      swatches: stash.activePalette.map((s) => ({ label: s.label, color: s.color.toLowerCase() })),
      selectedColor: stash.selectedColor.toLowerCase(),
    };
    pendingHistoryEntryRef.current = {
      id: "__stash_restore__",
      createdAt: 0,
      pictureId: COLORING_PICTURE_ASSETS[stash.pictureIndex]!.id,
      savedBitmapSize: bitmapSize,
      paintDataUrl: stash.paintDataUrl,
      previewDataUrl: stash.previewDataUrl,
    };
    editingHistoryEntryRef.current = null;
    freePaintWithoutClearRef.current = false;
    setShowHistoryExitButton(false);
    stashSessionRef.current = null;
    setEditingHistoryId(null);
    setPictureIndex(stash.pictureIndex);
    setStageIndex((i) => i + 1);
    setPhase("play");
  }, [bitmapSize]);

  const handleHistoryExitClick = useCallback(() => {
    const editing = editingHistoryEntryRef.current;
    const stash = stashSessionRef.current;
    if (!editing || !stash) return;

    const display = displayRef.current;
    const paint = paintRef.current;
    if (!display || !paint) return;

    setHistoryChromeInteractionLocked(true);
    onHistorySequenceInteractionChange?.(false);
    historyCanvasSuppressMountTransitionRef.current = true;

    particlesRef.current = [];
    cancelAnimationFrame(rafRef.current);
    redrawDisplay();

    const newPreview = buildPreviewDataUrlFromDisplay(display);
    const newPaint = paint.toDataURL("image/png");
    updateTapColoringHistoryEntry(editing.id, {
      previewDataUrl: newPreview,
      paintDataUrl: newPaint,
      savedBitmapSize: bitmapSize,
      paletteSwatches: activePalette.map((s) => ({ label: s.label, color: s.color.toLowerCase() })),
      paletteSelectedColor: selected.color.toLowerCase(),
    });
    onHistoryEntryReplaced?.(editing.id);
    onHistoryUpdated?.();

    setShowHistoryExitButton(false);
    setHistoryOverlay({
      kind: "exit",
      phase: "outgoing-shrink",
      stashUrl: stash.previewDataUrl,
      outgoingUrl: newPreview,
    });
  }, [
    activePalette,
    bitmapSize,
    onHistoryEntryReplaced,
    onHistorySequenceInteractionChange,
    onHistoryUpdated,
    redrawDisplay,
    selected.color,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      loadHistoryEntry(entry: TapColoringHistoryEntry) {
        if (!coloringPicturesReady || !splatterImagesReady) return false;
        if (historyOverlayRef.current !== null || editingHistoryEntryRef.current) return false;
        const idx = COLORING_PICTURE_ASSETS.findIndex((a) => a.id === entry.pictureId);
        if (idx < 0) return false;

        const display = displayRef.current;
        const paint = paintRef.current;
        if (!display || !paint) return false;

        sequenceRunningRef.current = false;
        clearTriggeredRef.current = false;
        blockPaintUntilPointerUpRef.current = false;
        pointerDownOnCanvasRef.current = false;
        activeCanvasPointerIdRef.current = null;
        cancelAnimationFrame(rafRef.current);
        particlesRef.current = [];
        redrawDisplay();

        const stashPreview = buildPreviewDataUrlFromDisplay(display);
        const stashPaint = paint.toDataURL("image/png");
        stashSessionRef.current = {
          pictureIndex,
          paintDataUrl: stashPaint,
          previewDataUrl: stashPreview,
          activePalette: activePalette.map((s) => ({ label: s.label, color: s.color.toLowerCase() })),
          selectedColor: selected.color.toLowerCase(),
        };

        setHistoryChromeInteractionLocked(true);
        onHistorySequenceInteractionChange?.(false);

        historyOverlayEnterTargetRef.current = entry;
        setCanvasPresenceDepth(true);
        setShowHistoryExitButton(false);
        setHistoryOverlay({
          kind: "enter",
          phase: "stash-shrink",
          stashUrl: stashPreview,
          historyUrl: entry.previewDataUrl,
        });
        return true;
      },
      saveCurrentWorkToHistory() {
        if (!coloringPicturesReady || !splatterImagesReady) return false;
        if (historyOverlayRef.current !== null || editingHistoryEntryRef.current) return false;
        if (phase !== "play" && phase !== "resume") return false;
        if (sequenceRunningRef.current) return false;
        appendHistorySnapshot();
        return true;
      },
      saveCurrentWorkToHistoryWithPreview(previewDataUrl: string) {
        if (!coloringPicturesReady || !splatterImagesReady) return false;
        if (historyOverlayRef.current !== null || editingHistoryEntryRef.current) return false;
        if (phase !== "play" && phase !== "resume") return false;
        if (sequenceRunningRef.current) return false;
        if (!previewDataUrl.startsWith("data:image/")) return false;
        return pushHistoryFromCanvas(previewDataUrl);
      },
      async composeHighResExport(options: TapColoringExportOptions) {
        const display = displayRef.current;
        if (!display || display.width < 1 || display.height < 1) return null;
        redrawDisplay();
        try {
          return await composeTapColoringExport(display, options);
        } catch {
          return null;
        }
      },
    }),
    [
      activePalette,
      appendHistorySnapshot,
      coloringPicturesReady,
      onHistorySequenceInteractionChange,
      phase,
      pictureIndex,
      pushHistoryFromCanvas,
      redrawDisplay,
      selected.color,
      splatterImagesReady,
    ],
  );

  return (
    <motion.div
      ref={containerRef}
      className="relative mx-auto flex w-full max-w-lg flex-col gap-4 rounded-2xl px-0 pb-2 pt-0 lg:pt-4"
      animate={{ backgroundColor: sceneBgColor }}
      transition={{ duration: TRANSITION_BG_MS / 1000, ease: "linear" }}
    >
      {isDevTj && !isDebugMode && (
        <div className="fixed right-4 top-4 z-50">
          <button
            type="button"
            onClick={() => setIsDebugMode(true)}
            className="rounded border border-stone-300 bg-white/90 px-2 py-1 font-mono text-xs text-stone-800 shadow-sm"
          >
            DEBUG OFF
          </button>
        </div>
      )}
      {isDevTj && isDebugMode && (
        <div className="fixed right-4 top-4 z-50 max-h-[90vh] w-[min(92vw,280px)] overflow-y-auto rounded-2xl border border-stone-300 bg-white/95 p-3 text-left text-xs text-stone-800 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            {isDebugPanelExpanded && <span className="font-bold text-stone-700">タップぬりえ DEBUG</span>}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsDebugMode(false)}
                className="rounded border border-stone-400 bg-amber-500 px-2 py-1 text-[10px] font-semibold text-white"
              >
                DEBUG ON
              </button>
              <button
                type="button"
                onClick={() => setIsDebugPanelExpanded((v) => !v)}
                className="rounded border border-stone-300 p-1 text-stone-500"
                aria-expanded={isDebugPanelExpanded}
              >
                {isDebugPanelExpanded ? "▲" : "▼"}
              </button>
            </div>
          </div>
          {isDebugPanelExpanded && (
            <div className="space-y-3 text-[10px] text-stone-600">
              <div>
                <div className="mb-1 font-semibold text-stone-700">シミのサイズ（VB換算の基準）</div>
                <input
                  type="range"
                  min={2}
                  max={18}
                  step={0.5}
                  value={debugSplatterRadiusVb}
                  onChange={(e) => setDebugSplatterRadiusVb(Number(e.target.value))}
                  className="w-full accent-amber-600"
                />
                <div className="tabular-nums text-stone-500">{debugSplatterRadiusVb.toFixed(1)}</div>
              </div>
              <div>
                <div className="mb-1 font-semibold text-stone-700">クリア閾値（内側に対する割合）</div>
                <input
                  type="range"
                  min={0.5}
                  max={0.99}
                  step={0.01}
                  value={debugFillThreshold}
                  onChange={(e) => setDebugFillThreshold(Number(e.target.value))}
                  className="w-full accent-amber-600"
                />
                <div className="tabular-nums text-stone-500">{Math.round(debugFillThreshold * 100)}%</div>
              </div>
              <div>
                <div className="mb-1 font-semibold text-stone-700">塗り絵イラスト拡大（黒枠内）</div>
                <input
                  type="range"
                  min={0.7}
                  max={1.45}
                  step={0.05}
                  value={debugIllustrationScale}
                  onChange={(e) => setDebugIllustrationScale(Number(e.target.value))}
                  className="w-full accent-amber-600"
                />
                <div className="tabular-nums text-stone-500">{debugIllustrationScale.toFixed(2)}×</div>
              </div>
            </div>
          )}
        </div>
      )}

      {(!splatterImagesReady || !coloringPicturesReady) && (
        <p className="text-center text-[10px] text-[var(--color-muted)]">画像を読み込み中…</p>
      )}

      <motion.div
        className={`flex flex-wrap items-center justify-center gap-3 lg:-translate-y-1 ${
          !historyChromeInteractionLocked && (phase === "play" || phase === "resume")
            ? "pointer-events-auto"
            : "pointer-events-none"
        }`}
        animate={{
          opacity:
            !historyChromeInteractionLocked && (phase === "play" || phase === "resume") ? 1 : 0,
          y: !historyChromeInteractionLocked && (phase === "play" || phase === "resume") ? 0 : -14,
        }}
        transition={{
          duration: paletteUnlockNoFadeRef.current ? 0 : SUCCESS_UI_FADE_MS / 1000,
          ease: "easeOut",
        }}
      >
        {activePalette.map((p) => {
          const active = p.color === selected.color;
          return (
            <button
              key={p.color}
              type="button"
              aria-label={p.label}
              title={p.label}
              onClick={() => setSelected(p)}
              className={`h-14 w-14 shrink-0 rounded-full border-4 shadow-md transition-transform active:scale-90 ${
                active ? "border-stone-800 ring-2 ring-amber-400 ring-offset-2" : "border-white"
              }`}
              style={{ backgroundColor: p.color }}
            />
          );
        })}
      </motion.div>

      <div
        className={`relative mx-auto aspect-square w-full max-w-[420px] ${
          historyOverlay !== null ? "[&_canvas]:invisible [&_canvas]:pointer-events-none" : ""
        }`}
      >
        {historyOverlay?.kind === "enter" && historyOverlay.phase === "stash-shrink" && (
          <div
            className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-2xl border-2 border-[color-mix(in_srgb,var(--color-text)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_85%,var(--color-bg))] shadow-inner"
            aria-hidden
          >
            <motion.img
              src={historyOverlay.stashUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-contain"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 0.86, opacity: 0.08 }}
              transition={{ duration: HISTORY_DEPTH_OVERLAY_S, ease: [0.33, 0, 0.2, 1] }}
              onAnimationComplete={() => {
                setHistoryOverlay({
                  kind: "enter",
                  phase: "history-expand",
                  stashUrl: historyOverlay.stashUrl,
                  historyUrl: historyOverlay.historyUrl,
                });
              }}
            />
          </div>
        )}
        {historyOverlay?.kind === "enter" && historyOverlay.phase === "history-expand" && (
          <div
            className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-2xl border-2 border-[color-mix(in_srgb,var(--color-text)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_85%,var(--color-bg))] shadow-inner"
            aria-hidden
          >
            <motion.img
              src={historyOverlay.historyUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-contain"
              initial={{ scale: 0.78, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: HISTORY_DEPTH_OVERLAY_S, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => {
                completeHistoryEnter();
              }}
            />
          </div>
        )}
        {historyOverlay?.kind === "exit" && historyOverlay.phase === "outgoing-shrink" && (
          <div
            className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-2xl border-2 border-[color-mix(in_srgb,var(--color-text)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_85%,var(--color-bg))] shadow-inner"
            aria-hidden
          >
            <motion.img
              src={historyOverlay.outgoingUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-contain"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 0.86, opacity: 0.06 }}
              transition={{ duration: HISTORY_DEPTH_OVERLAY_S, ease: [0.33, 0, 0.2, 1] }}
              onAnimationComplete={() => {
                setHistoryOverlay({
                  kind: "exit",
                  phase: "stash-expand",
                  stashUrl: historyOverlay.stashUrl,
                  outgoingUrl: historyOverlay.outgoingUrl,
                });
              }}
            />
          </div>
        )}
        {historyOverlay?.kind === "exit" && historyOverlay.phase === "stash-expand" && (
          <div
            className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-2xl border-2 border-[color-mix(in_srgb,var(--color-text)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_85%,var(--color-bg))] shadow-inner"
            aria-hidden
          >
            <motion.img
              src={historyOverlay.stashUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-contain"
              initial={{ scale: 0.78, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: HISTORY_DEPTH_OVERLAY_S, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => {
                completeHistoryExit();
              }}
            />
          </div>
        )}

        {showHistoryExitButton && (
          <button
            type="button"
            onClick={handleHistoryExitClick}
            className="absolute right-2 top-2 z-40 rounded-lg border border-[color-mix(in_srgb,var(--color-text)_22%,transparent)] bg-[color-mix(in_srgb,var(--color-bg)_90%,transparent)] px-2 py-1 text-[10px] font-semibold text-[var(--color-text)] shadow-md backdrop-blur sm:right-3 sm:top-3 sm:text-xs"
          >
            編集終了
          </button>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${stageIndex}-${currentPictureAsset.id}`}
            className={`absolute inset-0 flex items-center justify-center ${
              historyOverlay ? "pointer-events-none" : ""
            }`}
            initial={
              historyCanvasSuppressMountTransitionRef.current
                ? false
                : canvasPresenceDepth
                  ? { scale: 1, opacity: 0.12, x: 0, rotate: 0 }
                  : { x: "-120%", scale: 0.98, opacity: 0.96, rotate: -3 }
            }
            animate={
              galleryHandoffSkipToRest
                ? { x: 0, opacity: 1, rotate: 0, scale: 1 }
                : phase === "success"
                  ? { x: 0, opacity: 1, rotate: 0, scale: [1, 1.07, 0.94, 1.03, 1] }
                  : phase === "transition"
                    ? { x: "126%", opacity: 0.98, rotate: 2, scale: 1.02 }
                    : { x: 0, opacity: 1, rotate: 0, scale: 1 }
            }
            exit={
              historyCanvasSuppressMountTransitionRef.current
                ? { x: 0, opacity: 1, scale: 1, rotate: 0 }
                : canvasPresenceDepth
                  ? { scale: 1, opacity: 0.08, x: 0, rotate: 0 }
                  : { x: "126%", opacity: 0.98, rotate: 2, scale: 1.02 }
            }
            transition={{
              duration:
                historyCanvasSuppressMountTransitionRef.current || galleryHandoffSkipToRest
                  ? 0
                  : phase === "success"
                    ? SUCCESS_SQUASH_DURATION_S
                    : phase === "transition"
                      ? TRANSITION_SLIDE_MS / 1000
                      : phase === "setup"
                        ? 0.56
                        : canvasPresenceDepth
                          ? 0.42
                          : 0.3,
              ease: phase === "setup" ? "easeOut" : phase === "transition" ? "easeIn" : "easeOut",
            }}
          >
            <canvas
              ref={setDisplayCanvasRef}
              width={bitmapSize}
              height={bitmapSize}
              style={canvasInkStyle}
              className="relative z-10 h-full w-full touch-none rounded-2xl border-2 border-[color-mix(in_srgb,var(--color-text)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_85%,var(--color-bg))] shadow-inner"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUpCanvas}
              onPointerCancel={onPointerUpCanvas}
            />
          </motion.div>
        </AnimatePresence>

        <canvas
          ref={maskRef}
          width={bitmapSize}
          height={bitmapSize}
          style={canvasInkStyle}
          className="hidden"
          aria-hidden
        />
        <canvas
          ref={paintRef}
          width={bitmapSize}
          height={bitmapSize}
          style={canvasInkStyle}
          className="hidden"
          aria-hidden
        />
      </div>

    </motion.div>
  );
});

ColoringCanvas.displayName = "ColoringCanvas";
