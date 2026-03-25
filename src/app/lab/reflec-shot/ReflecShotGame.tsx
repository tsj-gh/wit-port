"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";

const AGENT_SPEED = 520;
const AGENT_RADIUS = 7;
const MIN_SWIPE_PX = 14;
const BUMPER_HALF_LEN_FR = 0.18;
const BUMPER_HIT_EXTRA = 28;
const BUMPER_LINE_WIDTH = 10;
const SUBSTEPS = 6;

type Agent = { x: number; y: number; vx: number; vy: number };

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

/** Closest point on segment A–B to P; returns { qx, qy, t } */
function closestOnSegment(ax: number, ay: number, bx: number, by: number, px: number, py: number) {
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  const t = ab2 < 1e-12 ? 0 : clamp01(((px - ax) * abx + (py - ay) * aby) / ab2);
  return { qx: ax + abx * t, qy: ay + aby * t, t };
}

function len(x: number, y: number) {
  return Math.hypot(x, y);
}

function normalize(x: number, y: number): { x: number; y: number } {
  const L = len(x, y);
  if (L < 1e-8) return { x: 1, y: 0 };
  return { x: x / L, y: y / L };
}

function snapAngle45(rad: number) {
  const step = Math.PI / 4;
  const k = Math.round(rad / step);
  return k * step;
}

export default function ReflecShotGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentRef = useRef<Agent | null>(null);
  const bumperAngleRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  const swipeRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const bumperDragRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  const getBumperGeometry = useCallback((w: number, h: number) => {
    const cx = w / 2;
    const cy = h / 2;
    const half = Math.min(w, h) * BUMPER_HALF_LEN_FR;
    const th = bumperAngleRef.current;
    const c = Math.cos(th);
    const s = Math.sin(th);
    return { cx, cy, half, x1: cx - c * half, y1: cy - s * half, x2: cx + c * half, y2: cy + s * half };
  }, []);

  const pointNearBumper = useCallback((px: number, py: number, w: number, h: number) => {
    const g = getBumperGeometry(w, h);
    const { qx, qy } = closestOnSegment(g.x1, g.y1, g.x2, g.y2, px, py);
    const d = len(px - qx, py - qy);
    return d <= BUMPER_HIT_EXTRA + BUMPER_LINE_WIDTH / 2;
  }, [getBumperGeometry]);

  const resolveWall = useCallback((a: Agent, w: number, h: number) => {
    const r = AGENT_RADIUS;
    if (a.x < r) {
      a.x = r;
      a.vx = -a.vx;
    } else if (a.x > w - r) {
      a.x = w - r;
      a.vx = -a.vx;
    }
    if (a.y < r) {
      a.y = r;
      a.vy = -a.vy;
    } else if (a.y > h - r) {
      a.y = h - r;
      a.vy = -a.vy;
    }
  }, []);

  const tryResolveBumper = useCallback((a: Agent, w: number, h: number) => {
    const g = getBumperGeometry(w, h);
    const { qx, qy } = closestOnSegment(g.x1, g.y1, g.x2, g.y2, a.x, a.y);
    const dx = a.x - qx;
    const dy = a.y - qy;
    const dist = len(dx, dy);
    if (dist >= AGENT_RADIUS - 1e-4) return;

    const th = bumperAngleRef.current;
    const s = Math.sin(th);
    const c = Math.cos(th);
    let nx: number;
    let ny: number;
    if (dist > 1e-5) {
      nx = dx / dist;
      ny = dy / dist;
    } else {
      const n1x = -s;
      const n1y = c;
      const n2x = s;
      const n2y = -c;
      const v1 = a.vx * n1x + a.vy * n1y;
      const v2 = a.vx * n2x + a.vy * n2y;
      if (v1 <= v2) {
        nx = n1x;
        ny = n1y;
      } else {
        nx = n2x;
        ny = n2y;
      }
    }

    const vn = a.vx * nx + a.vy * ny;
    if (vn >= 0) return;

    a.vx -= 2 * vn * nx;
    a.vy -= 2 * vn * ny;

    const push = AGENT_RADIUS - dist + 0.5;
    a.x += nx * push;
    a.y += ny * push;
  }, [getBumperGeometry]);

  const tick = useCallback(
    (dt: number) => {
      const { w, h } = sizeRef.current;
      if (w <= 0 || h <= 0) return;

      const a = agentRef.current;
      if (!a) return;

      const sub = SUBSTEPS;
      const sdt = dt / sub;
      for (let i = 0; i < sub; i++) {
        a.x += a.vx * sdt;
        a.y += a.vy * sdt;
        resolveWall(a, w, h);
        tryResolveBumper(a, w, h);
        resolveWall(a, w, h);
      }
    },
    [resolveWall, tryResolveBumper]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    if (w <= 0 || h <= 0) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    const g = getBumperGeometry(w, h);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.95)";
    ctx.shadowColor = "rgba(56, 189, 248, 0.6)";
    ctx.shadowBlur = 12;
    ctx.lineWidth = BUMPER_LINE_WIDTH;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(g.x1, g.y1);
    ctx.lineTo(g.x2, g.y2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(248, 250, 252, 0.15)";
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, 6, 0, Math.PI * 2);
    ctx.fill();

    const a = agentRef.current;
    if (a) {
      ctx.fillStyle = "#f8fafc";
      ctx.shadowColor = "rgba(248, 250, 252, 0.5)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(a.x, a.y, AGENT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [getBumperGeometry]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tick(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw, tick]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    sizeRef.current = { w, h, dpr };
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    draw();
  }, [draw]);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    const el = canvasRef.current;
    if (el) ro.observe(el);
    window.addEventListener("resize", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [resize]);

  const canvasToLocal = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const { w, h } = sizeRef.current;
    if (w <= 0) return;
    const { x, y } = canvasToLocal(e);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (pointNearBumper(x, y, w, h)) {
      bumperDragRef.current = { x, y, pointerId: e.pointerId };
      swipeRef.current = null;
      return;
    }

    bumperDragRef.current = null;
    swipeRef.current = { x, y, pointerId: e.pointerId };
  };

  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const { w, h } = sizeRef.current;
    const b = bumperDragRef.current;
    if (b && b.pointerId === e.pointerId) {
      const { x, y } = canvasToLocal(e);
      const dx = x - b.x;
      const dy = y - b.y;
      if (len(dx, dy) >= MIN_SWIPE_PX) {
        const ang = Math.atan2(dy, dx);
        bumperAngleRef.current = snapAngle45(ang);
      }
      bumperDragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }

    const s = swipeRef.current;
    if (s && s.pointerId === e.pointerId && w > 0 && h > 0) {
      const { x, y } = canvasToLocal(e);
      const dx = x - s.x;
      const dy = y - s.y;
      if (len(dx, dy) >= MIN_SWIPE_PX) {
        const dir = normalize(dx, dy);
        agentRef.current = {
          x: Math.max(AGENT_RADIUS, Math.min(w - AGENT_RADIUS, s.x)),
          y: Math.max(AGENT_RADIUS, Math.min(h - AGENT_RADIUS, s.y)),
          vx: dir.x * AGENT_SPEED,
          vy: dir.y * AGENT_SPEED,
        };
      }
    }
    swipeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerCancel = (e: PointerEvent<HTMLCanvasElement>) => {
    bumperDragRef.current = null;
    swipeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="w-full max-w-[min(100%,560px)] mx-auto flex flex-col gap-4">
      <canvas
        ref={canvasRef}
        className="w-full aspect-[4/5] rounded-2xl border border-white/10 bg-slate-900/80 touch-none cursor-crosshair select-none"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        role="application"
        aria-label="Reflec-Shot プレイエリア。バンパー以外をスワイプで射出、中央バンパーをタップしてフリックで向き変更。"
      />
      <ul className="text-wit-muted text-sm leading-relaxed space-y-1 list-disc pl-5">
        <li>盤面の<strong className="text-wit-text font-medium">いずれかの位置</strong>でスワイプすると、その起点からスワイプ方向に高速の球が飛び出します。</li>
        <li>外枠の壁は直角に反射します。</li>
        <li>
          <strong className="text-wit-text font-medium">中央の反射バー</strong>
          をタップしたあとフリックすると、フリック方向に合わせてバーの向きが
          <strong className="text-wit-text font-medium">45度刻み</strong>
          で変わります。球が当たると鏡面反射で跳ね返ります。
        </li>
      </ul>
    </div>
  );
}
