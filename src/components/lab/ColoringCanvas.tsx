"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";

/** viewBox 0 0 100 100 の単純な塗り用シルエット（外部アセットなし） */
export const TAP_COLORING_SHAPES = [
  {
    id: "apple",
    label: "りんご",
    d: "M50 22 C32 22 18 40 18 62 C18 84 34 100 50 100 C66 100 82 84 82 62 C82 40 68 22 50 22 Z M50 20 L46 8 L54 8 Z",
  },
  {
    id: "star",
    label: "ほし",
    d: "M50 6 L61 36 L94 36 L68 56 L79 88 L50 70 L21 88 L32 56 L6 36 L39 36 Z",
  },
  {
    id: "cat",
    label: "ねこ",
    d: "M50 28 L36 10 L28 32 C16 40 10 54 10 70 C10 90 28 98 50 96 C72 98 90 90 90 70 C90 54 84 40 72 32 L64 10 Z",
  },
  {
    id: "car",
    label: "くるま",
    d: "M12 72 L12 58 L22 50 L78 50 L88 58 L88 72 Z M24 74 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M76 74 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0",
  },
] as const;

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

export type TapColoringSwatch = { label: string; color: string };

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
  const baseIdx = Math.floor(Math.random() * 12);
  const posStep = Math.random() < 0.5 ? 3 : 4;
  const negStep = Math.random() < 0.5 ? 3 : 4;
  const iPos = (baseIdx + posStep) % 12;
  const iNeg = (baseIdx - negStep + 12) % 12;
  return [FULL_PALETTE_12[baseIdx]!, FULL_PALETTE_12[iPos]!, FULL_PALETTE_12[iNeg]!];
}

const DEFAULT_FILL_THRESHOLD = 0.9;
const DEFAULT_SPLATTER_RADIUS_VB = 12.5;
const SCAN_STRIDE = 2;
/** マスク干渉切り分け用（true で枠外でも描ける） */
const DEBUG_DISABLE_MASK = false;

const SPLATTER_IMAGE_COUNT = 9;
const SPLATTER_PUBLIC_PREFIX = "/assets/tap-coloring";

/**
 * PNG を黒シルエット化したうえで source-in 着色（アルファ形状は維持）
 */
function tintSplatterToCanvas(
  img: HTMLImageElement,
  tintRgb: { r: number; g: number; b: number },
  outW: number,
  outH: number,
  out: HTMLCanvasElement,
): void {
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, outW, outH);
  ctx.drawImage(img, 0, 0, outW, outH);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, outW, outH);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = `rgb(${tintRgb.r},${tintRgb.g},${tintRgb.b})`;
  ctx.fillRect(0, 0, outW, outH);
  ctx.globalCompositeOperation = "source-over";
}

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

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

function useShapeLayout(canvasSize: number) {
  return useMemo(() => {
    const pxPerVb = (canvasSize * 0.82) / 100;
    const ox = (canvasSize - 100 * pxPerVb) / 2;
    const oy = (canvasSize - 100 * pxPerVb) / 2;
    return { pxPerVb, ox, oy };
  }, [canvasSize]);
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

export function ColoringCanvas() {
  const searchParams = useSearchParams();
  const isDevTj = searchParams.get("devtj") === "true";

  const containerRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef<HTMLCanvasElement>(null);

  const [size, setSize] = useState(360);
  const [stageIndex, setStageIndex] = useState(0);
  const [activePalette, setActivePalette] = useState<TapColoringSwatch[]>(() => pickTriadPalette());
  const [selected, setSelected] = useState<TapColoringSwatch>(() => activePalette[0]!);
  const [fillRatio, setFillRatio] = useState(0);
  const [cleared, setCleared] = useState(false);

  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isDebugPanelExpanded, setIsDebugPanelExpanded] = useState(true);
  const [debugSplatterRadiusVb, setDebugSplatterRadiusVb] = useState(DEFAULT_SPLATTER_RADIUS_VB);
  const [debugFillThreshold, setDebugFillThreshold] = useState(DEFAULT_FILL_THRESHOLD);

  const splatterRadiusVb = isDevTj && isDebugMode ? debugSplatterRadiusVb : DEFAULT_SPLATTER_RADIUS_VB;
  const fillThreshold = isDevTj && isDebugMode ? debugFillThreshold : DEFAULT_FILL_THRESHOLD;

  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const pathRef = useRef<Path2D | null>(null);
  const clearTriggeredRef = useRef(false);
  /** キャンバスでポインタが押下中（この間にクリア→次ステージへ進んだら、離すまで塗りを止める） */
  const pointerDownOnCanvasRef = useRef(false);
  /** クリア後の新ステージで、直前のドラッグが続いているとき true。対応する pointerup まで塗り禁止 */
  const blockPaintUntilPointerUpRef = useRef(false);
  const activeCanvasPointerIdRef = useRef<number | null>(null);
  const splatterImagesRef = useRef<HTMLImageElement[]>([]);
  const [splatterImagesReady, setSplatterImagesReady] = useState(false);
  const { pxPerVb, ox, oy } = useShapeLayout(size);

  const shape = TAP_COLORING_SHAPES[stageIndex % TAP_COLORING_SHAPES.length]!;

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

  const layoutPath = useCallback(() => {
    pathRef.current = new Path2D(shape.d);
  }, [shape.d]);

  const redrawDisplay = useCallback(() => {
    const display = displayRef.current;
    const paint = paintRef.current;
    if (!display || !paint || !pathRef.current) return;

    const ctx = display.getContext("2d");
    if (!ctx) return;

    const path = pathRef.current;
    const w = display.width;
    const h = display.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#fafaf9";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(pxPerVb, pxPerVb);
    ctx.fillStyle = "#e7e5e4";
    ctx.fill(path);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(paint, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(pxPerVb, pxPerVb);
    ctx.strokeStyle = "#57534e";
    ctx.lineWidth = 2.5 / pxPerVb;
    ctx.lineJoin = "round";
    ctx.stroke(path);
    ctx.restore();

    const parts = particlesRef.current;
    if (parts.length > 0) {
      for (const p of parts) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [ox, oy, pxPerVb]);

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

  const initStageCanvases = useCallback(() => {
    const display = displayRef.current;
    const mask = maskRef.current;
    const paint = paintRef.current;
    if (!display || !mask || !paint) return;

    layoutPath();
    const path = pathRef.current;
    if (!path) return;

    const w = size;
    const h = size;
    display.width = w;
    display.height = h;
    mask.width = w;
    mask.height = h;
    paint.width = w;
    paint.height = h;

    const mctx = mask.getContext("2d");
    const pctx = paint.getContext("2d");
    if (!mctx || !pctx) return;

    mctx.clearRect(0, 0, w, h);
    mctx.save();
    mctx.translate(ox, oy);
    mctx.scale(pxPerVb, pxPerVb);
    mctx.fillStyle = "#ffffff";
    mctx.fill(path);
    mctx.restore();

    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, w, h);

    clearTriggeredRef.current = false;
    setFillRatio(0);
    redrawDisplay();
  }, [layoutPath, ox, oy, pxPerVb, redrawDisplay, size]);

  useEffect(() => {
    let cancelled = false;
    const imgs: HTMLImageElement[] = [];
    let pending = SPLATTER_IMAGE_COUNT;
    const onDone = () => {
      pending -= 1;
      if (pending <= 0 && !cancelled) setSplatterImagesReady(true);
    };
    for (let i = 1; i <= SPLATTER_IMAGE_COUNT; i++) {
      const im = new Image();
      im.decoding = "async";
      im.onload = onDone;
      im.onerror = onDone;
      im.src = `${SPLATTER_PUBLIC_PREFIX}/splatter_${String(i).padStart(2, "0")}.png`;
      imgs.push(im);
    }
    splatterImagesRef.current = imgs;
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cw = el.clientWidth;
      const next = Math.max(280, Math.min(420, Math.floor(cw - 8)));
      setSize((s) => (Math.abs(s - next) > 4 ? next : s));
    });
    ro.observe(el);
    const cw = el.clientWidth;
    setSize(Math.max(280, Math.min(420, Math.floor(cw - 8))));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    initStageCanvases();
  }, [initStageCanvases, stageIndex, shape.id]);

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

  const paintAt = (clientX: number, clientY: number) => {
    if (cleared) return;
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
    if (!img || !img.complete || img.naturalWidth < 1) return;

    const scaleJitter = 0.8 + Math.random() * 0.4;
    const baseDiameter = 2 * splatterRadiusVb * pxPerVb * scaleJitter;
    const ar = img.naturalWidth / img.naturalHeight;
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
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.clearRect(0, 0, bw, bh);
    tctx.translate(px - x0, py - y0);
    tctx.rotate(angle);
    tctx.drawImage(tintCanvas, -drawW / 2, -drawH / 2);
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
    setFillRatio(ratio);
    if (ratio >= fillThreshold && !clearTriggeredRef.current) {
      clearTriggeredRef.current = true;
      setCleared(true);
    }
    redrawDisplay();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (cleared) {
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
    if (cleared) return;
    if (blockPaintUntilPointerUpRef.current) return;
    if (e.buttons !== 1 && e.pointerType !== "touch") return;
    paintAt(e.clientX, e.clientY);
  };

  const onPointerUpCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    releaseCanvasPointer(e.pointerId);
  };

  useEffect(() => {
    if (!cleared) return;
    const t = window.setTimeout(() => {
      clearTriggeredRef.current = false;
      blockPaintUntilPointerUpRef.current = pointerDownOnCanvasRef.current;
      setActivePalette(pickTriadPalette());
      setStageIndex((i) => i + 1);
      setCleared(false);
    }, 900);
    return () => clearTimeout(t);
  }, [cleared]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const pctTarget = Math.round(fillThreshold * 100);

  return (
    <div ref={containerRef} className="relative mx-auto flex w-full max-w-lg flex-col gap-4 px-3 pb-8 pt-4">
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
            </div>
          )}
        </div>
      )}

      <header className="text-center">
        <h1 className="text-xl font-bold text-stone-700">タップでぬりえ</h1>
        <p className="text-sm text-stone-500">たっぷして いろを のばそう</p>
        {!splatterImagesReady && (
          <p className="mt-1 text-[10px] text-amber-700">シミ画像を読み込み中…</p>
        )}
        {!isDevTj && (
          <p className="mt-1 text-[10px] text-stone-400">デバッグは URL に ?devtj=true を付けてください</p>
        )}
      </header>

      <div className="flex flex-wrap items-center justify-center gap-3">
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
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[420px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${stageIndex}-${shape.id}`}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ scale: 0.78, opacity: 0, rotate: -5 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 1.1, opacity: 0, rotate: 6 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
          >
            <canvas
              ref={displayRef}
              width={size}
              height={size}
              className="relative z-10 h-full w-full touch-none rounded-3xl border-4 border-stone-200 bg-stone-100 shadow-inner"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUpCanvas}
              onPointerCancel={onPointerUpCanvas}
            />
          </motion.div>
        </AnimatePresence>

        <canvas ref={maskRef} width={size} height={size} className="hidden" aria-hidden />
        <canvas ref={paintRef} width={size} height={size} className="hidden" aria-hidden />
      </div>

      <AnimatePresence>
        {cleared && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="pointer-events-none fixed inset-x-0 top-1/3 z-10 flex justify-center"
          >
            <div className="rounded-2xl bg-amber-300 px-8 py-4 text-2xl font-bold text-amber-900 shadow-lg">
              クリア！
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between text-sm text-stone-500">
        <span>
          いま: <strong className="text-stone-700">{shape.label}</strong>
        </span>
        <span className="tabular-nums">
          ぬれたよ: {Math.min(100, Math.round(fillRatio * 100))}% / {pctTarget}%
        </span>
      </div>
    </div>
  );
}
