"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";

/** 射出時の最大速度（ピクセル/秒） */
const MAX_POWER = 560;
const AGENT_RADIUS = 8;
const GRAB_RADIUS = AGENT_RADIUS + 22;
const MAX_DRAG_PX = 130;
const CHARGE_DURATION_MS = 1000;
const BUMPER_HALF_LEN_FR = 0.18;
const BUMPER_HIT_EXTRA = 28;
const BUMPER_LINE_WIDTH = 10;
const SUBSTEPS_MIN = 6;
const SUBSTEPS_MAX = 22;
/** これ未満の速さなら「停止扱い」で操作受付 */
const STOP_SPEED = 14;
const MIN_MOUSE_PULL_PX = 10;
const TOUCH_AIM_MOVE_PX = 5;

type Agent = { x: number; y: number; vx: number; vy: number };

type MouseSlingState = {
  pointerId: number;
  anchorX: number;
  anchorY: number;
  curX: number;
  curY: number;
};

type TouchChargeState = {
  pointerId: number;
  t0: number;
  anchorX: number;
  anchorY: number;
  aimAngle: number;
  lastX: number;
  lastY: number;
};

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

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

function agentSpeed(a: Agent) {
  return len(a.vx, a.vy);
}

export default function ReflecShotGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentRef = useRef<Agent | null>(null);
  const bumperAngleRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  const mouseSlingRef = useRef<MouseSlingState | null>(null);
  const touchChargeRef = useRef<TouchChargeState | null>(null);
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
    return len(px - qx, py - qy) <= BUMPER_HIT_EXTRA + BUMPER_LINE_WIDTH / 2;
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

  const tryResolveBumper = useCallback(
    (a: Agent, w: number, h: number) => {
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
    },
    [getBumperGeometry]
  );

  const tick = useCallback(
    (dt: number) => {
      const { w, h } = sizeRef.current;
      if (w <= 0 || h <= 0) return;

      const sling = mouseSlingRef.current;
      const tc = touchChargeRef.current;
      const a = agentRef.current;
      if (!a) return;

      if (sling) {
        a.x = sling.anchorX;
        a.y = sling.anchorY;
        a.vx = 0;
        a.vy = 0;
        return;
      }
      if (tc) {
        a.x = tc.anchorX;
        a.y = tc.anchorY;
        a.vx = 0;
        a.vy = 0;
        return;
      }

      if (agentSpeed(a) < STOP_SPEED) {
        a.vx = 0;
        a.vy = 0;
        return;
      }

      const vmag = agentSpeed(a);
      const subs = Math.min(SUBSTEPS_MAX, Math.max(SUBSTEPS_MIN, Math.ceil((vmag * dt) / (AGENT_RADIUS * 0.55))));
      const sdt = dt / subs;
      for (let i = 0; i < subs; i++) {
        a.x += a.vx * sdt;
        a.y += a.vy * sdt;
        resolveWall(a, w, h);
        tryResolveBumper(a, w, h);
        resolveWall(a, w, h);
      }
    },
    [resolveWall, tryResolveBumper]
  );

  const drawChargingVfx = useCallback(
    (ctx: CanvasRenderingContext2D, ax: number, ay: number, charge01: number, nowMs: number) => {
      if (charge01 < 0.02) return;
      const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.008);
      const jitter = charge01 * 2.8 * Math.sin(nowMs * 0.045);
      const jy = charge01 * 2.2 * Math.sin(nowMs * 0.052 + 1.1);

      const layers = 4;
      for (let i = 0; i < layers; i++) {
        const t = i / (layers - 1 || 1);
        const r = AGENT_RADIUS + 10 + (42 + charge01 * 28) * (1 - t) * (0.85 + 0.15 * pulse);
        const alpha = charge01 * (0.14 + 0.1 * (1 - t)) * pulse;
        ctx.strokeStyle = `rgba(125, 211, 252, ${alpha})`;
        ctx.lineWidth = 1.5 + charge01 * 2;
        ctx.beginPath();
        ctx.arc(ax + jitter * (0.3 + t * 0.2), ay + jy * (0.25 + t * 0.15), r, 0, Math.PI * 2);
        ctx.stroke();
      }

      const grd = ctx.createRadialGradient(ax, ay, AGENT_RADIUS * 0.2, ax, ay, AGENT_RADIUS + 6 + charge01 * 22);
      grd.addColorStop(0, `rgba(248, 250, 252, ${0.15 + charge01 * 0.45})`);
      grd.addColorStop(0.45, `rgba(56, 189, 248, ${0.12 + charge01 * 0.25})`);
      grd.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(ax, ay, AGENT_RADIUS + 6 + charge01 * 22, 0, Math.PI * 2);
      ctx.fill();
    },
    []
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    if (w <= 0 || h <= 0) return;
    const nowMs = performance.now();

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
    if (!a) return;

    const sling = mouseSlingRef.current;
    const tc = touchChargeRef.current;

    let charge01 = 0;
    let aimDirX = 0;
    let aimDirY = -1;
    let drawAx = a.x;
    let drawAy = a.y;

    if (sling) {
      const pdx = sling.curX - sling.anchorX;
      const pdy = sling.curY - sling.anchorY;
      const pull = len(pdx, pdy);
      charge01 = clamp01(pull / MAX_DRAG_PX);
      const launch = normalize(-pdx, -pdy);
      aimDirX = launch.x;
      aimDirY = launch.y;
      drawAx = sling.anchorX;
      drawAy = sling.anchorY;

      ctx.strokeStyle = "rgba(251, 191, 36, 0.55)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sling.anchorX, sling.anchorY);
      ctx.lineTo(sling.curX, sling.curY);
      ctx.stroke();
    } else if (tc) {
      charge01 = clamp01((nowMs - tc.t0) / CHARGE_DURATION_MS);
      aimDirX = Math.cos(tc.aimAngle);
      aimDirY = Math.sin(tc.aimAngle);
      drawAx = tc.anchorX;
      drawAy = tc.anchorY;
    }

    const guideLen = 36 + charge01 * 52;
    if (sling || tc) {
      ctx.save();
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = `rgba(226, 232, 240, ${0.35 + charge01 * 0.35})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(drawAx, drawAy);
      ctx.lineTo(drawAx + aimDirX * guideLen, drawAy + aimDirY * guideLen);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    drawChargingVfx(ctx, drawAx, drawAy, sling || tc ? charge01 : 0, nowMs);

    const shake = (sling || tc ? charge01 : 0) * 1.2;
    const sx = drawAx + Math.sin(nowMs * 0.09) * shake;
    const sy = drawAy + Math.cos(nowMs * 0.11) * shake;

    ctx.fillStyle = "#f8fafc";
    ctx.shadowColor = "rgba(248, 250, 252, 0.55)";
    ctx.shadowBlur = 8 + charge01 * 14;
    ctx.beginPath();
    ctx.arc(sx, sy, AGENT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [drawChargingVfx, getBumperGeometry]);

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

    const ax = w / 2;
    const ay = Math.min(h - AGENT_RADIUS - 16, h * 0.72);
    const cur = agentRef.current;
    if (!cur) {
      agentRef.current = { x: ax, y: ay, vx: 0, vy: 0 };
    } else if (agentSpeed(cur) < STOP_SPEED) {
      cur.x = Math.max(AGENT_RADIUS, Math.min(w - AGENT_RADIUS, cur.x));
      cur.y = Math.max(AGENT_RADIUS, Math.min(h - AGENT_RADIUS, cur.y));
      cur.vx = 0;
      cur.vy = 0;
    }

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

  const canInteract = () => {
    const a = agentRef.current;
    if (!a) return false;
    return agentSpeed(a) < STOP_SPEED;
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const { w, h } = sizeRef.current;
    if (w <= 0) return;
    const { x, y } = canvasToLocal(e);

    if (pointNearBumper(x, y, w, h)) {
      e.currentTarget.setPointerCapture(e.pointerId);
      bumperDragRef.current = { x, y, pointerId: e.pointerId };
      mouseSlingRef.current = null;
      touchChargeRef.current = null;
      return;
    }

    bumperDragRef.current = null;

    if (!canInteract()) {
      return;
    }

    const a = agentRef.current;
    if (!a) return;

    if (e.pointerType === "touch") {
      e.currentTarget.setPointerCapture(e.pointerId);
      mouseSlingRef.current = null;
      touchChargeRef.current = {
        pointerId: e.pointerId,
        t0: performance.now(),
        anchorX: a.x,
        anchorY: a.y,
        aimAngle: -Math.PI / 2,
        lastX: x,
        lastY: y,
      };
      return;
    }

    if (len(x - a.x, y - a.y) > GRAB_RADIUS) {
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    touchChargeRef.current = null;
    mouseSlingRef.current = {
      pointerId: e.pointerId,
      anchorX: a.x,
      anchorY: a.y,
      curX: x,
      curY: y,
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasToLocal(e);

    const sling = mouseSlingRef.current;
    if (sling && sling.pointerId === e.pointerId) {
      sling.curX = x;
      sling.curY = y;
      return;
    }

    const tc = touchChargeRef.current;
    if (tc && tc.pointerId === e.pointerId) {
      const dx = x - tc.lastX;
      const dy = y - tc.lastY;
      if (len(dx, dy) >= TOUCH_AIM_MOVE_PX) {
        tc.aimAngle = Math.atan2(dy, dx);
        tc.lastX = x;
        tc.lastY = y;
      }
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const { w, h } = sizeRef.current;
    const b = bumperDragRef.current;
    if (b && b.pointerId === e.pointerId) {
      const { x, y } = canvasToLocal(e);
      const dx = x - b.x;
      const dy = y - b.y;
      if (len(dx, dy) >= 14) {
        bumperAngleRef.current = snapAngle45(Math.atan2(dy, dx));
      }
      bumperDragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }

    const sling = mouseSlingRef.current;
    if (sling && sling.pointerId === e.pointerId) {
      const pdx = sling.curX - sling.anchorX;
      const pdy = sling.curY - sling.anchorY;
      const pull = len(pdx, pdy);
      const power = clamp01(pull / MAX_DRAG_PX);
      if (power > 0.04 && pull >= MIN_MOUSE_PULL_PX) {
        const dir = normalize(-pdx, -pdy);
        const spd = power * MAX_POWER;
        const a = agentRef.current;
        if (a) {
          a.x = sling.anchorX;
          a.y = sling.anchorY;
          a.vx = dir.x * spd;
          a.vy = dir.y * spd;
        }
      }
      mouseSlingRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }

    const tc = touchChargeRef.current;
    if (tc && tc.pointerId === e.pointerId && w > 0) {
      const elapsed = performance.now() - tc.t0;
      const power = clamp01(elapsed / CHARGE_DURATION_MS);
      const spd = power * MAX_POWER;
      const a = agentRef.current;
      if (a && power > 0.02) {
        a.x = tc.anchorX;
        a.y = tc.anchorY;
        a.vx = Math.cos(tc.aimAngle) * spd;
        a.vy = Math.sin(tc.aimAngle) * spd;
      }
      touchChargeRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerCancel = (e: PointerEvent<HTMLCanvasElement>) => {
    bumperDragRef.current = null;
    mouseSlingRef.current = null;
    touchChargeRef.current = null;
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
        className="w-full aspect-[4/5] rounded-2xl border border-white/10 bg-slate-900/80 touch-none cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        role="application"
        aria-label="Reflec-Shot。マウスは球を掴んでスリングショット、タッチは長押しチャージとスワイプで狙いを付けて離して射出。中央バーはタップ後フリックで向き変更。"
      />
      <ul className="text-wit-muted text-sm leading-relaxed space-y-1 list-disc pl-5">
        <li>
          <strong className="text-wit-text font-medium">マウス</strong>
          ：止まっている球をクリックして掴み、引いた反対向きに飛びます。引き量でパワーが増え（上限あり）、点線は飛ぶ方向の目安です。
        </li>
        <li>
          <strong className="text-wit-text font-medium">タッチ</strong>
          ：盤面のどこでも長押しで約1秒かけてチャージ。動かしている指の方向に狙いが更新され、離した瞬間に射出します（球は指に隠れない位置に固定）。
        </li>
        <li>外枠と中央の反射バーは鏡面反射。高速時はサブステップを増やして壁抜けを抑制しています。</li>
        <li>
          <strong className="text-wit-text font-medium">中央の反射バー</strong>
          をタップしてからフリックすると、45度刻みで向きが変わります。
        </li>
      </ul>
    </div>
  );
}
