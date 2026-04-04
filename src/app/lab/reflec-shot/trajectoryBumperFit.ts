import type { BumperKind } from "./gridTypes";

export type Pt = { x: number; y: number };

export type CellRect = { left: number; top: number; right: number; bottom: number };

export function cellRectPx(
  c: number,
  r: number,
  layout: { ox: number; oy: number; cellPx: number; rMin: number }
): CellRect {
  const { ox, oy, cellPx, rMin } = layout;
  const left = ox + c * cellPx;
  const top = oy + (r - rMin) * cellPx;
  return { left, top, right: left + cellPx, bottom: top + cellPx };
}

/** 線分と軸平行矩形の交点（t は [0,1]、A→B の順でソート） */
export function segmentRectIntersections(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rect: CellRect
): { t: number; x: number; y: number }[] {
  const { left, top, right, bottom } = rect;
  const dx = bx - ax;
  const dy = by - ay;
  const hits: { t: number; x: number; y: number }[] = [];
  const eps = 1e-9;

  const add = (t: number) => {
    if (t < -1e-5 || t > 1 + 1e-5) return;
    const tt = Math.max(0, Math.min(1, t));
    hits.push({ t: tt, x: ax + dx * tt, y: ay + dy * tt });
  };

  if (Math.abs(dx) > eps) {
    let t = (left - ax) / dx;
    let y = ay + t * dy;
    if (t >= 0 && t <= 1 && y >= top - 1e-4 && y <= bottom + 1e-4) add(t);
    t = (right - ax) / dx;
    y = ay + t * dy;
    if (t >= 0 && t <= 1 && y >= top - 1e-4 && y <= bottom + 1e-4) add(t);
  }
  if (Math.abs(dy) > eps) {
    let t = (top - ay) / dy;
    let x = ax + t * dx;
    if (t >= 0 && t <= 1 && x >= left - 1e-4 && x <= right + 1e-4) add(t);
    t = (bottom - ay) / dy;
    x = ax + t * dx;
    if (t >= 0 && t <= 1 && x >= left - 1e-4 && x <= right + 1e-4) add(t);
  }

  hits.sort((a, b) => a.t - b.t);
  const out: typeof hits = [];
  for (const h of hits) {
    if (!out.length || Math.abs(out[out.length - 1]!.t - h.t) > 1e-4) out.push(h);
  }
  return out;
}

export function entryPointOnRect(ax: number, ay: number, bx: number, by: number, rect: CellRect): Pt | null {
  const hits = segmentRectIntersections(ax, ay, bx, by, rect);
  return hits.length > 0 ? { x: hits[0]!.x, y: hits[0]!.y } : null;
}

export function exitPointOnRect(ax: number, ay: number, bx: number, by: number, rect: CellRect): Pt | null {
  const hits = segmentRectIntersections(ax, ay, bx, by, rect);
  if (hits.length === 0) return null;
  const h = hits[hits.length - 1]!;
  return { x: h.x, y: h.y };
}

export function closestPointOnRectBoundary(px: number, py: number, rect: CellRect): Pt {
  const { left, top, right, bottom } = rect;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  if (px < left) return { x: left, y: clamp(py, top, bottom) };
  if (px > right) return { x: right, y: clamp(py, top, bottom) };
  if (py < top) return { x: clamp(px, left, right), y: top };
  if (py > bottom) return { x: clamp(px, left, right), y: bottom };
  const dLeft = px - left;
  const dRight = right - px;
  const dTop = py - top;
  const dBottom = bottom - py;
  const m = Math.min(dLeft, dRight, dTop, dBottom);
  if (m === dLeft) return { x: left, y: clamp(py, top, bottom) };
  if (m === dRight) return { x: right, y: clamp(py, top, bottom) };
  if (m === dTop) return { x: clamp(px, left, right), y: top };
  return { x: clamp(px, left, right), y: bottom };
}

/** 0=左上, 1=右上, 2=右下, 3=左下（キャンバス座標・y 下向き正） */
export function nearestCornerIndex(px: number, py: number, rect: CellRect): number {
  const { left, top, right, bottom } = rect;
  const corners = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
  let bi = 0;
  let bd = Infinity;
  for (let i = 0; i < 4; i++) {
    const cx = corners[i]!.x;
    const cy = corners[i]!.y;
    const d = (px - cx) ** 2 + (py - cy) ** 2;
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  return bi;
}

export function polylineArcLength(pts: Pt[]): number {
  if (pts.length < 2) return 0;
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    s += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return s;
}

const FIT_KINDS: readonly BumperKind[] = ["PIPE", "SLASH", "HYPHEN", "BACKSLASH"];

function normDistToKind(nx: number, ny: number, kind: BumperKind): number {
  switch (kind) {
    case "PIPE":
      return Math.abs(nx - 0.5);
    case "HYPHEN":
      return Math.abs(ny - 0.5);
    case "SLASH":
      return Math.abs(nx + ny - 1) / Math.SQRT2;
    case "BACKSLASH":
      return Math.abs(nx - ny) / Math.SQRT2;
    default:
      return 1;
  }
}

export function dedupeConsecutivePoints(pts: Pt[]): Pt[] {
  if (pts.length === 0) return [];
  const out: Pt[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    const q = out[out.length - 1]!;
    if (Math.hypot(p.x - q.x, p.y - q.y) > 0.5) out.push(p);
  }
  return out;
}

/** マス入口 P から出口 Q までの表示用ポリライン（評価ロジックと同じ結合） */
export function passageDisplayPolyline(P: Pt, Q: Pt, samples: Pt[]): Pt[] {
  const body = dedupeConsecutivePoints(samples);
  let poly = dedupeConsecutivePoints([P, ...body, Q]);
  if (poly.length < 2) return [P, Q];
  return poly;
}

export function scoreTrajectoryVsBumpers(pts: Pt[], rect: CellRect): {
  meanDists: Record<BumperKind, number>;
  similarities: Record<BumperKind, number>;
  best: BumperKind;
} {
  const w = rect.right - rect.left;
  const h = rect.bottom - rect.top;
  const meanDists = {} as Record<BumperKind, number>;
  for (const kind of FIT_KINDS) {
    let sum = 0;
    for (const p of pts) {
      const nx = (p.x - rect.left) / w;
      const ny = (p.y - rect.top) / h;
      sum += normDistToKind(nx, ny, kind);
    }
    meanDists[kind] = pts.length > 0 ? sum / pts.length : 1;
  }
  const sigma = 0.22;
  const similarities = {} as Record<BumperKind, number>;
  let best: BumperKind = "HYPHEN";
  let bestD = Infinity;
  for (const kind of FIT_KINDS) {
    const md = meanDists[kind]!;
    similarities[kind] = Math.max(0, Math.min(100, 100 * Math.exp(-md / sigma)));
    if (md < bestD) {
      bestD = md;
      best = kind;
    }
  }
  return { meanDists, similarities, best };
}

export type TrajectoryFitResult =
  | {
      ok: true;
      kind: BumperKind;
      trimTo: Pt;
      meanDists: Record<BumperKind, number>;
      similarities: Record<BumperKind, number>;
      arcLen: number;
      maxArcLimit: number;
    }
  | {
      ok: false;
      reason: "same-corner" | "arc-too-long";
      trimTo: Pt;
      arcLen: number;
      maxArcLimit: number;
      meanDists: Record<BumperKind, number>;
      similarities: Record<BumperKind, number>;
    };

/**
 * P,Q は辺上想定。samples はマス内の実軌跡。maxArcFactor は対角線長に対する弧長の上限倍率。
 */
export function evaluateBumperPassage(
  P: Pt,
  Q: Pt,
  samples: Pt[],
  rect: CellRect,
  maxArcFactor: number
): TrajectoryFitResult {
  const trimTo = Q;
  const cellW = rect.right - rect.left;
  const cellH = rect.bottom - rect.top;
  const diag = Math.hypot(cellW, cellH);
  const maxArcLimit = maxArcFactor * diag;

  const body = dedupeConsecutivePoints(samples);
  let poly: Pt[] = dedupeConsecutivePoints([P, ...body, Q]);
  if (poly.length < 2) {
    poly = [P, Q];
  }
  const arcLen = polylineArcLength(poly);
  const scored = scoreTrajectoryVsBumpers(poly, rect);

  if (nearestCornerIndex(P.x, P.y, rect) === nearestCornerIndex(Q.x, Q.y, rect)) {
    return {
      ok: false,
      reason: "same-corner",
      trimTo,
      arcLen,
      maxArcLimit,
      meanDists: scored.meanDists,
      similarities: scored.similarities,
    };
  }

  if (arcLen > maxArcLimit) {
    return {
      ok: false,
      reason: "arc-too-long",
      trimTo,
      arcLen,
      maxArcLimit,
      meanDists: scored.meanDists,
      similarities: scored.similarities,
    };
  }

  return {
    ok: true,
    kind: scored.best,
    trimTo,
    meanDists: scored.meanDists,
    similarities: scored.similarities,
    arcLen,
    maxArcLimit,
  };
}
