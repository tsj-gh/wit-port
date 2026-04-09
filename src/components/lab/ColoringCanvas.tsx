"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

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

const PALETTE = [
  { label: "あか", color: "#f87171" },
  { label: "だいだい", color: "#fb923c" },
  { label: "きいろ", color: "#facc15" },
  { label: "みどり", color: "#4ade80" },
  { label: "あお", color: "#60a5fa" },
  { label: "むらさき", color: "#c084fc" },
  { label: "もも", color: "#f472b6" },
] as const;

const FILL_THRESHOLD = 0.98;
/** viewBox 単位でのブラシ半径（100 がキャラの幅の目安） */
const BRUSH_RADIUS_VB = 16;
const SCAN_STRIDE = 2;
/** マスク干渉切り分け用（true で枠外でも描ける） */
const DEBUG_DISABLE_MASK = false;
const SPLATTER_BASE_ALPHA = 0.88;

/** 原点(0,0)中心・おおむね半径1のベタ塗りインクシミ */
const SPLATTER_PATHS = [
  "M0 -1 C0.35 -0.95 0.78 -0.7 0.86 -0.3 C1.02 0.04 0.86 0.36 0.6 0.56 C0.46 0.84 0.12 1.03 -0.18 0.95 C-0.52 1.04 -0.86 0.78 -0.96 0.42 C-1.08 0.1 -0.98 -0.24 -0.78 -0.52 C-0.56 -0.84 -0.28 -1.04 0 -1 Z",
  "M0 -1 L0.22 -0.7 L0.54 -0.82 L0.62 -0.46 L0.98 -0.28 L0.72 0.02 L0.92 0.34 L0.56 0.48 L0.5 0.9 L0.12 0.72 L-0.08 1 L-0.34 0.72 L-0.68 0.88 L-0.72 0.5 L-1 0.2 L-0.72 -0.06 L-0.86 -0.38 L-0.46 -0.42 L-0.34 -0.82 L0 -1 Z",
  "M0 -0.94 C0.18 -0.86 0.3 -0.74 0.42 -0.66 C0.64 -0.74 0.92 -0.6 0.96 -0.32 C1.12 -0.06 1.04 0.24 0.82 0.4 C0.84 0.74 0.54 0.96 0.24 0.88 C0.02 1.06 -0.3 1.04 -0.48 0.8 C-0.82 0.88 -1.04 0.6 -0.98 0.28 C-1.14 0.02 -1 -0.32 -0.72 -0.48 C-0.66 -0.8 -0.34 -1 -0.02 -0.92 Z",
  "M0 -1 C0.22 -0.84 0.38 -0.88 0.58 -0.74 C0.78 -0.6 0.96 -0.36 0.94 -0.12 C1.06 0.14 0.96 0.38 0.8 0.54 C0.7 0.84 0.42 1 0.12 0.94 C-0.16 1.06 -0.42 0.98 -0.58 0.78 C-0.86 0.72 -1.04 0.44 -0.96 0.16 C-1.02 -0.1 -0.92 -0.4 -0.68 -0.54 C-0.58 -0.82 -0.3 -1.02 0 -1 Z",
  "M0 -0.98 C0.28 -1 0.58 -0.86 0.72 -0.6 C0.98 -0.5 1.06 -0.2 0.92 0.06 C1 0.34 0.86 0.62 0.6 0.72 C0.44 0.96 0.16 1.08 -0.1 0.92 C-0.42 1.02 -0.74 0.84 -0.82 0.52 C-1.02 0.34 -1.06 0.04 -0.84 -0.16 C-0.9 -0.44 -0.72 -0.74 -0.42 -0.78 C-0.26 -0.96 -0.12 -1 0 -0.98 Z",
] as const;

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

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
  const containerRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef<HTMLCanvasElement>(null);

  const [size, setSize] = useState(360);
  const [stageIndex, setStageIndex] = useState(0);
  const [selected, setSelected] = useState<(typeof PALETTE)[number]>(PALETTE[0]!);
  const [fillRatio, setFillRatio] = useState(0);
  const [cleared, setCleared] = useState(false);

  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const pathRef = useRef<Path2D | null>(null);
  const clearTriggeredRef = useRef(false);
  const { pxPerVb, ox, oy } = useShapeLayout(size);

  const shape = TAP_COLORING_SHAPES[stageIndex % TAP_COLORING_SHAPES.length]!;

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
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.92;
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

    // 外側は透明、内側のみ不透明のマスクを作る
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

    // マスク内判定（1px サンプル）。無効化時は常に通す。
    if (!DEBUG_DISABLE_MASK) {
      const mx = Math.max(0, Math.min(mask.width - 1, Math.floor(px)));
      const my = Math.max(0, Math.min(mask.height - 1, Math.floor(py)));
      const a = mctx.getImageData(mx, my, 1, 1).data[3]!;
      if (a < 10) return;
    }

    pctx.save();
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.translate(0, 0);

    const brushRadiusPx = BRUSH_RADIUS_VB * pxPerVb;

    // ベタ塗りインクシミ: ランダム形状 + ランダム回転 + わずかな拡大縮小
    const pathIndex = Math.floor(Math.random() * SPLATTER_PATHS.length);
    const splatPath = new Path2D(SPLATTER_PATHS[pathIndex]!);
    const angle = Math.random() * Math.PI * 2;
    const scaleJitter = 0.8 + Math.random() * 0.4;
    const radius = brushRadiusPx * scaleJitter;

    pctx.globalCompositeOperation = "multiply";
    pctx.globalAlpha = SPLATTER_BASE_ALPHA;
    pctx.fillStyle = selected.color;
    pctx.translate(px, py);
    pctx.rotate(angle);
    pctx.scale(radius, radius);
    pctx.fill(splatPath);

    // マスク有効時のみ、最終結果を常に枠内に制限
    if (!DEBUG_DISABLE_MASK) {
      pctx.setTransform(1, 0, 0, 1, 0, 0);
      pctx.globalCompositeOperation = "destination-in";
      pctx.globalAlpha = 1;
      pctx.drawImage(mask, 0, 0);
    }
    // 描画後はデフォルトに戻す
    pctx.globalCompositeOperation = "source-over";
    pctx.globalAlpha = 1;
    pctx.restore();

    spawnParticles(px, py, selected.color);

    const ratio = measureFill();
    setFillRatio(ratio);
    if (ratio >= FILL_THRESHOLD && !clearTriggeredRef.current) {
      clearTriggeredRef.current = true;
      setCleared(true);
    }
    redrawDisplay();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    paintAt(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1 && e.pointerType !== "touch") return;
    paintAt(e.clientX, e.clientY);
  };

  useEffect(() => {
    if (!cleared) return;
    const t = window.setTimeout(() => {
      clearTriggeredRef.current = false;
      setStageIndex((i) => i + 1);
      setCleared(false);
    }, 900);
    return () => clearTimeout(t);
  }, [cleared]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div ref={containerRef} className="mx-auto flex w-full max-w-lg flex-col gap-4 px-3 pb-8 pt-4">
      <header className="text-center">
        <h1 className="text-xl font-bold text-stone-700">タップでぬりえ</h1>
        <p className="text-sm text-stone-500">たっぷして いろを のばそう</p>
      </header>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {PALETTE.map((p) => {
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
          ぬれたよ: {Math.min(100, Math.round(fillRatio * 100))}%
        </span>
      </div>
    </div>
  );
}
