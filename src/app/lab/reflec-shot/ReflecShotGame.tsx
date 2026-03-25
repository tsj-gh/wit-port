"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  ASPECT_PRESETS,
  createStageRng,
  generateStageWithFallback,
  reflectionsForRank,
  type GeneratedStage,
} from "./stageGen";

/** 射出時の最大速度（ピクセル/秒） */
const MAX_POWER = 560;
const DEFAULT_AGENT_RADIUS = 16;
const GRAB_PADDING_PX = 22;
const MAX_DRAG_PX = 130;
const CHARGE_DURATION_MS = 1000;
const BUMPER_HALF_LEN_FR = 0.18;
const BUMPER_HIT_EXTRA = 28;
const BUMPER_LINE_WIDTH = 10;
const SUBSTEPS_MIN = 6;
const SUBSTEPS_MAX = 22;
const STOP_SPEED = 14;
const MIN_MOUSE_PULL_PX = 12;
/** タッチ：この距離以上動かしたらスワイプ確定（ガイド表示・離しで射出） */
const TOUCH_SWIPE_COMMIT_PX = 14;
const GOAL_RADIUS_FR = 0.045;
const CHARGE_FADE_MS = 260;

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
  originX: number;
  originY: number;
  curX: number;
  curY: number;
  hasAimed: boolean;
};

type BumperDragState = { x: number; y: number; pointerId: number; index: number };

type ChargeFade = { startMs: number; initial01: number };

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

/** スリング解除時：アンカー付近ならキャンセル（当たり判定は半径＋余裕） */
function slingCancelRadiusPx(agentR: number) {
  return Math.max(14, agentR + 8);
}

/** バー向きは θ と θ+π で同一鏡面として扱う */
function bumperAnglesMatch(current: number, correct: number) {
  const a = snapAngle45(current);
  const c = snapAngle45(correct);
  const d = Math.abs(a - c);
  return d < 0.06 || Math.abs(d - Math.PI) < 0.06;
}

function bumperSegmentPx(cx: number, cy: number, theta: number, half: number) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x1: cx - c * half, y1: cy - s * half, x2: cx + c * half, y2: cy + s * half };
}

export default function ReflecShotGame() {
  const searchParams = useSearchParams();
  const isDevTj = searchParams.get("devtj") === "true";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentRef = useRef<Agent | null>(null);
  const bumperAnglesRef = useRef<number[]>([]);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const agentRadiusRef = useRef(DEFAULT_AGENT_RADIUS);

  const mouseSlingRef = useRef<MouseSlingState | null>(null);
  const touchChargeRef = useRef<TouchChargeState | null>(null);
  const bumperDragRef = useRef<BumperDragState | null>(null);
  const chargeFadeRef = useRef<ChargeFade | null>(null);

  const [rank, setRank] = useState(1);
  const [stage, setStage] = useState<GeneratedStage | null>(null);
  const [genSeed, setGenSeed] = useState(() => (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
  const [showDebugRoute, setShowDebugRoute] = useState(false);
  const [cleared, setCleared] = useState(false);
  const clearedRef = useRef(false);

  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isDebugPanelExpanded, setIsDebugPanelExpanded] = useState(true);
  const [debugAgentRadius, setDebugAgentRadius] = useState(DEFAULT_AGENT_RADIUS);

  useEffect(() => {
    agentRadiusRef.current = debugAgentRadius;
  }, [debugAgentRadius]);

  const rollStage = useCallback((nextRank: number, seed: number) => {
    const rng = createStageRng(seed);
    const aspect = ASPECT_PRESETS[Math.floor(rng() * ASPECT_PRESETS.length)]!;
    const reflections = reflectionsForRank(nextRank);
    const s = generateStageWithFallback(reflections, rng, aspect);
    bumperAnglesRef.current = s.bumpers.map((b) => b.angleWrong);
    setStage(s);
    clearedRef.current = false;
    setCleared(false);
    const { w, h } = sizeRef.current;
    const R = agentRadiusRef.current;
    if (w > 0 && h > 0) {
      agentRef.current = {
        x: s.start.x * w,
        y: s.start.y * h,
        vx: 0,
        vy: 0,
      };
      const a = agentRef.current;
      a.x = Math.max(R, Math.min(w - R, a.x));
      a.y = Math.max(R, Math.min(h - R, a.y));
    }
  }, []);

  useEffect(() => {
    rollStage(rank, genSeed);
  }, [rank, genSeed, rollStage]);

  const resolveWall = useCallback((a: Agent, w: number, h: number, r: number) => {
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

  const tryResolveOneBumper = useCallback(
    (a: Agent, cx: number, cy: number, theta: number, half: number, r: number) => {
      const { x1, y1, x2, y2 } = bumperSegmentPx(cx, cy, theta, half);
      const { qx, qy } = closestOnSegment(x1, y1, x2, y2, a.x, a.y);
      const dx = a.x - qx;
      const dy = a.y - qy;
      const dist = len(dx, dy);
      if (dist >= r - 1e-4) return false;

      const s = Math.sin(theta);
      const c = Math.cos(theta);
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
      if (vn >= 0) return false;

      a.vx -= 2 * vn * nx;
      a.vy -= 2 * vn * ny;
      const push = r - dist + 0.5;
      a.x += nx * push;
      a.y += ny * push;
      return true;
    },
    []
  );

  const beginChargeFade = useCallback((initial01: number) => {
    chargeFadeRef.current = { startMs: performance.now(), initial01: clamp01(initial01) };
  }, []);

  const tick = useCallback(
    (dt: number) => {
      const { w, h } = sizeRef.current;
      if (w <= 0 || h <= 0) return;
      const st = stage;
      if (!st) return;
      const R = agentRadiusRef.current;

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

      const goalX = st.goal.x * w;
      const goalY = st.goal.y * h;
      const goalR = Math.max(R + 4, Math.min(w, h) * GOAL_RADIUS_FR);

      if (agentSpeed(a) < STOP_SPEED) {
        a.vx = 0;
        a.vy = 0;
        if (!clearedRef.current && len(a.x - goalX, a.y - goalY) < goalR) {
          const arr = bumperAnglesRef.current;
          const anglesOk =
            st.bumpers.length === 0 ||
            st.bumpers.every((b, i) => bumperAnglesMatch(arr[i] ?? b.angleWrong, b.angleCorrect));
          if (anglesOk) {
            clearedRef.current = true;
            setCleared(true);
          }
        }
        return;
      }

      const vmag = agentSpeed(a);
      const subs = Math.min(SUBSTEPS_MAX, Math.max(SUBSTEPS_MIN, Math.ceil((vmag * dt) / (R * 0.55))));
      const sdt = dt / subs;
      const half = Math.min(w, h) * BUMPER_HALF_LEN_FR;
      const angles = bumperAnglesRef.current;

      for (let i = 0; i < subs; i++) {
        a.x += a.vx * sdt;
        a.y += a.vy * sdt;
        for (let rep = 0; rep < 8; rep++) {
          resolveWall(a, w, h, R);
          let hit = false;
          for (let bi = 0; bi < st.bumpers.length; bi++) {
            const b = st.bumpers[bi]!;
            const th = angles[bi] ?? b.angleWrong;
            if (tryResolveOneBumper(a, b.x * w, b.y * h, th, half, R)) hit = true;
          }
          resolveWall(a, w, h, R);
          if (!hit) break;
        }
      }
    },
    [resolveWall, stage, tryResolveOneBumper]
  );

  const drawChargingVfx = useCallback(
    (ctx: CanvasRenderingContext2D, ax: number, ay: number, charge01: number, nowMs: number, R: number) => {
      if (charge01 < 0.02) return;
      const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.008);
      const jitter = charge01 * 2.8 * Math.sin(nowMs * 0.045);
      const jy = charge01 * 2.2 * Math.sin(nowMs * 0.052 + 1.1);
      const layers = 4;
      for (let i = 0; i < layers; i++) {
        const t = i / (layers - 1 || 1);
        const rRing = R + 10 + (42 + charge01 * 28) * (1 - t) * (0.85 + 0.15 * pulse);
        const alpha = charge01 * (0.14 + 0.1 * (1 - t)) * pulse;
        ctx.strokeStyle = `rgba(125, 211, 252, ${alpha})`;
        ctx.lineWidth = 1.5 + charge01 * 2;
        ctx.beginPath();
        ctx.arc(ax + jitter * (0.3 + t * 0.2), ay + jy * (0.25 + t * 0.15), rRing, 0, Math.PI * 2);
        ctx.stroke();
      }
      const grd = ctx.createRadialGradient(ax, ay, R * 0.2, ax, ay, R + 6 + charge01 * 22);
      grd.addColorStop(0, `rgba(248, 250, 252, ${0.15 + charge01 * 0.45})`);
      grd.addColorStop(0.45, `rgba(56, 189, 248, ${0.12 + charge01 * 0.25})`);
      grd.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(ax, ay, R + 6 + charge01 * 22, 0, Math.PI * 2);
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
    const st = stage;
    if (!st) return;
    const nowMs = performance.now();
    const R = agentRadiusRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    const goalX = st.goal.x * w;
    const goalY = st.goal.y * h;
    const goalR = Math.max(R + 4, Math.min(w, h) * GOAL_RADIUS_FR);
    ctx.strokeStyle = cleared ? "rgba(52, 211, 153, 0.85)" : "rgba(167, 139, 250, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(goalX, goalY, goalR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = cleared ? "rgba(52, 211, 153, 0.12)" : "rgba(167, 139, 250, 0.08)";
    ctx.fill();

    if (showDebugRoute && st.routePoints.length >= 2) {
      ctx.strokeStyle = "rgba(248, 113, 113, 0.55)";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(st.routePoints[0]!.x * w, st.routePoints[0]!.y * h);
      for (let i = 1; i < st.routePoints.length; i++) {
        ctx.lineTo(st.routePoints[i]!.x * w, st.routePoints[i]!.y * h);
      }
      ctx.stroke();
    }

    const half = Math.min(w, h) * BUMPER_HALF_LEN_FR;
    const angles = bumperAnglesRef.current;
    for (let bi = 0; bi < st.bumpers.length; bi++) {
      const b = st.bumpers[bi]!;
      const th = angles[bi] ?? b.angleWrong;
      const cx = b.x * w;
      const cy = b.y * h;
      const { x1, y1, x2, y2 } = bumperSegmentPx(cx, cy, th, half);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.95)";
      ctx.shadowColor = "rgba(56, 189, 248, 0.45)";
      ctx.shadowBlur = 10;
      ctx.lineWidth = BUMPER_LINE_WIDTH;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(248, 250, 252, 0.12)";
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    const a = agentRef.current;
    if (!a) return;

    const sling = mouseSlingRef.current;
    const tc = touchChargeRef.current;
    const fade = chargeFadeRef.current;

    let charge01 = 0;
    let aimDirX = 0;
    let aimDirY = -1;
    let drawAx = a.x;
    let drawAy = a.y;
    let showGuide = false;

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
      showGuide = true;
      ctx.strokeStyle = "rgba(251, 191, 36, 0.55)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sling.anchorX, sling.anchorY);
      ctx.lineTo(sling.curX, sling.curY);
      ctx.stroke();
    } else if (tc) {
      charge01 = clamp01((nowMs - tc.t0) / CHARGE_DURATION_MS);
      drawAx = tc.anchorX;
      drawAy = tc.anchorY;
      if (tc.hasAimed) {
        const sdx = tc.curX - tc.originX;
        const sdy = tc.curY - tc.originY;
        const d = len(sdx, sdy);
        if (d > 1e-4) {
          const dir = normalize(sdx, sdy);
          aimDirX = dir.x;
          aimDirY = dir.y;
          showGuide = true;
        }
      }
    } else if (fade) {
      const elapsed = nowMs - fade.startMs;
      const u = clamp01(elapsed / CHARGE_FADE_MS);
      const easeOut = 1 - (1 - u) * (1 - u);
      charge01 = fade.initial01 * (1 - easeOut);
      drawAx = a.x;
      drawAy = a.y;
      if (elapsed >= CHARGE_FADE_MS) {
        chargeFadeRef.current = null;
      }
    }

    const guideLen = 36 + charge01 * 52;
    if (showGuide) {
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

    const showChargeLayer = !!sling || !!tc || (!!fade && charge01 >= 0.02);
    if (showChargeLayer) {
      drawChargingVfx(ctx, drawAx, drawAy, charge01, nowMs, R);
    }

    const shake = (showChargeLayer ? charge01 : 0) * 1.2;
    const sx = drawAx + Math.sin(nowMs * 0.09) * shake;
    const sy = drawAy + Math.cos(nowMs * 0.11) * shake;

    ctx.fillStyle = "#f8fafc";
    ctx.shadowColor = "rgba(248, 250, 252, 0.55)";
    ctx.shadowBlur = 8 + charge01 * 14;
    ctx.beginPath();
    ctx.arc(sx, sy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [cleared, drawChargingVfx, showDebugRoute, stage]);

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

    const st = stage;
    const cur = agentRef.current;
    const R = agentRadiusRef.current;
    if (st && cur) {
      if (agentSpeed(cur) < STOP_SPEED) {
        cur.x = st.start.x * w;
        cur.y = st.start.y * h;
        cur.vx = 0;
        cur.vy = 0;
        cur.x = Math.max(R, Math.min(w - R, cur.x));
        cur.y = Math.max(R, Math.min(h - R, cur.y));
      } else {
        cur.x = Math.max(R, Math.min(w - R, cur.x));
        cur.y = Math.max(R, Math.min(h - R, cur.y));
      }
    } else if (!cur && st) {
      agentRef.current = {
        x: Math.max(R, Math.min(w - R, st.start.x * w)),
        y: Math.max(R, Math.min(h - R, st.start.y * h)),
        vx: 0,
        vy: 0,
      };
    }
    draw();
  }, [draw, stage]);

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

  const findBumperAt = useCallback(
    (px: number, py: number, w: number, h: number): number | null => {
      if (!stage) return null;
      const half = Math.min(w, h) * BUMPER_HALF_LEN_FR;
      let best: number | null = null;
      let bestD = 1e9;
      const angles = bumperAnglesRef.current;
      for (let bi = 0; bi < stage.bumpers.length; bi++) {
        const b = stage.bumpers[bi]!;
        const th = angles[bi] ?? b.angleWrong;
        const cx = b.x * w;
        const cy = b.y * h;
        const { x1, y1, x2, y2 } = bumperSegmentPx(cx, cy, th, half);
        const { qx, qy } = closestOnSegment(x1, y1, x2, y2, px, py);
        const d = len(px - qx, py - qy);
        if (d <= BUMPER_HIT_EXTRA + BUMPER_LINE_WIDTH / 2 && d < bestD) {
          bestD = d;
          best = bi;
        }
      }
      return best;
    },
    [stage]
  );

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
    if (w <= 0 || !stage) return;
    const { x, y } = canvasToLocal(e);
    const R = agentRadiusRef.current;
    const grabR = R + GRAB_PADDING_PX;

    const bIdx = findBumperAt(x, y, w, h);
    if (bIdx != null) {
      e.currentTarget.setPointerCapture(e.pointerId);
      bumperDragRef.current = { x, y, pointerId: e.pointerId, index: bIdx };
      mouseSlingRef.current = null;
      touchChargeRef.current = null;
      return;
    }

    bumperDragRef.current = null;
    if (!canInteract()) return;

    const a = agentRef.current;
    if (!a) return;

    if (e.pointerType === "touch") {
      if (len(x - a.x, y - a.y) > R) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      mouseSlingRef.current = null;
      touchChargeRef.current = {
        pointerId: e.pointerId,
        t0: performance.now(),
        anchorX: a.x,
        anchorY: a.y,
        originX: x,
        originY: y,
        curX: x,
        curY: y,
        hasAimed: false,
      };
      return;
    }

    if (len(x - a.x, y - a.y) > grabR) return;

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
      tc.curX = x;
      tc.curY = y;
      if (!tc.hasAimed && len(x - tc.originX, y - tc.originY) >= TOUCH_SWIPE_COMMIT_PX) {
        tc.hasAimed = true;
      }
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const { w, h } = sizeRef.current;
    const R = agentRadiusRef.current;
    const cancelRad = slingCancelRadiusPx(R);

    const b = bumperDragRef.current;
    if (b && b.pointerId === e.pointerId) {
      const { x, y } = canvasToLocal(e);
      const dx = x - b.x;
      const dy = y - b.y;
      if (len(dx, dy) >= 14) {
        const arr = bumperAnglesRef.current;
        if (b.index >= 0 && b.index < arr.length) {
          arr[b.index] = snapAngle45(Math.atan2(dy, dx));
        }
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
      const nearAnchor = pull <= cancelRad;
      if (nearAnchor || pull < MIN_MOUSE_PULL_PX || power <= 0.04) {
        beginChargeFade(power > 0.02 ? power : clamp01(pull / MAX_DRAG_PX));
      } else {
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
      if (!tc.hasAimed) {
        beginChargeFade(power);
      } else {
        const sdx = tc.curX - tc.originX;
        const sdy = tc.curY - tc.originY;
        const swipeLen = len(sdx, sdy);
        if (swipeLen < TOUCH_SWIPE_COMMIT_PX * 0.85) {
          beginChargeFade(power);
        } else {
          const dir = normalize(sdx, sdy);
          const spd = power * MAX_POWER;
          const a = agentRef.current;
          if (a && power > 0.02) {
            a.x = tc.anchorX;
            a.y = tc.anchorY;
            a.vx = dir.x * spd;
            a.vy = dir.y * spd;
          } else if (power <= 0.02) {
            beginChargeFade(power);
          }
        }
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
    const tc = touchChargeRef.current;
    if (tc && tc.pointerId === e.pointerId) {
      const power = clamp01((performance.now() - tc.t0) / CHARGE_DURATION_MS);
      beginChargeFade(power);
    }
    const sling = mouseSlingRef.current;
    if (sling && sling.pointerId === e.pointerId) {
      const pull = len(sling.curX - sling.anchorX, sling.curY - sling.anchorY);
      beginChargeFade(clamp01(pull / MAX_DRAG_PX));
    }
    bumperDragRef.current = null;
    mouseSlingRef.current = null;
    touchChargeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const aspectStyle: CSSProperties =
    stage != null ? { aspectRatio: `${stage.aspectW} / ${stage.aspectH}` } : { aspectRatio: "4 / 5" };

  return (
    <div className="w-full max-w-[min(100%,560px)] mx-auto flex flex-col gap-4 relative">
      {isDevTj && !isDebugMode && (
        <div className="fixed right-4 top-4 z-50">
          <button
            type="button"
            onClick={() => setIsDebugMode(true)}
            className="px-2 py-1 rounded border border-white/20 text-xs font-mono"
            style={{ background: "#334155" }}
          >
            DEBUG OFF
          </button>
        </div>
      )}
      {isDebugMode && (
        <div className="fixed right-4 top-4 z-50 max-h-[90vh] overflow-y-auto rounded-lg border border-white/20 bg-black/80 p-3 text-xs font-mono text-left">
          <div className="flex items-center justify-between gap-2">
            {isDebugPanelExpanded && <span className="font-bold text-emerald-400 shrink-0">デバッグパネル</span>}
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <button
                type="button"
                onClick={() => setIsDebugMode(false)}
                className="px-2 py-1 rounded border border-white/20"
                style={{ background: "#10b981" }}
              >
                DEBUG ON
              </button>
              <button
                type="button"
                onClick={() => setIsDebugPanelExpanded((v) => !v)}
                className="p-1 rounded border border-white/20 hover:bg-white/10 text-white/80"
                title={isDebugPanelExpanded ? "パネルを閉じる" : "パネルを開く"}
              >
                {isDebugPanelExpanded ? "▲" : "▼"}
              </button>
            </div>
          </div>
          {isDebugPanelExpanded && (
            <div className="mt-3 space-y-3 text-slate-300">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400">射出体半径 AGENT_RADIUS（px）</span>
                <input
                  type="range"
                  min={6}
                  max={40}
                  step={1}
                  value={debugAgentRadius}
                  onChange={(ev) => setDebugAgentRadius(Number(ev.target.value))}
                  className="w-full accent-emerald-500"
                />
                <span className="tabular-nums text-emerald-400/90">{debugAgentRadius}px</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-400">
                <input
                  type="checkbox"
                  checked={showDebugRoute}
                  onChange={(e) => setShowDebugRoute(e.target.checked)}
                  className="rounded border-white/30 accent-sky-400"
                />
                <span className="text-[10px]">検証用ルート表示</span>
              </label>
              <div className="text-[10px] text-slate-500 space-y-0.5 border-t border-white/10 pt-2">
                <div>
                  rank: <span className="text-slate-400">{rank}</span>
                </div>
                <div>
                  seed: <span className="text-slate-400 tabular-nums">{genSeed}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="text-wit-muted flex items-center gap-2">
          ランク
          <select
            className="bg-slate-800 border border-white/15 rounded-lg px-2 py-1 text-wit-text"
            value={rank}
            onChange={(e) => {
              setRank(Number(e.target.value));
              setGenSeed((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
            }}
          >
            {[1, 2, 3, 4, 5].map((r) => (
              <option key={r} value={r}>
                {r}
                {r === 1 ? "（反射1回中心）" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-wit-text hover:bg-white/10 transition-colors"
          onClick={() => setGenSeed((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0)}
        >
          ステージ再生成
        </button>
      </div>

      {cleared && (
        <p className="text-emerald-400 text-sm font-medium" role="status">
          クリア：ゴール到達かつ全バンパーが正解向きです。
        </p>
      )}

      <canvas
        ref={canvasRef}
        className="w-full rounded-2xl border border-white/10 bg-slate-900/80 touch-none cursor-grab active:cursor-grabbing select-none max-h-[min(85vh,720px)]"
        style={{ touchAction: "none", ...aspectStyle }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        role="application"
        aria-label="Reflec-Shot。射出体を操作しゴールへ。バンパーはフリックで向き変更。"
      />

      <ul className="text-wit-muted text-sm leading-relaxed space-y-1 list-disc pl-5">
        <li>
          ステージは<strong className="text-wit-text font-medium">逆方向トレース＋検証</strong>
          で生成。バンパーは屈折点に配置され、初期向きは意図的にずれています（フリックで45°刻みに調整）。
        </li>
        <li>
          <strong className="text-wit-text font-medium">マウス</strong>
          ：射出体をドラッグしてスリング。離した位置が遠ければ射出。初期位置付近に戻して離すとキャンセル。
        </li>
        <li>
          <strong className="text-wit-text font-medium">タッチ</strong>
          ：射出体に触れて長押しでチャージ（この間は方向ガイドなし）。そのままスワイプするとガイド表示、離した方向へ射出。スワイプなしで離すとキャンセル。
        </li>
        <li>
          <strong className="text-wit-text font-medium">紫のリング</strong>がゴール。開発時は URL に{" "}
          <code className="text-slate-400">?devtj=true</code> でデバッグパネルを表示できます。
        </li>
      </ul>
    </div>
  );
}
