/**
 * Reflec-Shot ステージの逆方向トレース＋バックトラッキング生成
 * バンパー角度は常に 45° 刻み（プレイ時のスナップと一致）
 */

export type Vec2 = { x: number; y: number };

export type StageBumper = {
  x: number;
  y: number;
  /** 正解の向き（ラジアン、45° スナップ済み） */
  angleCorrect: number;
  /** 初期表示（不正解） */
  angleWrong: number;
};

export type GeneratedStage = {
  start: Vec2;
  goal: Vec2;
  bumpers: StageBumper[];
  /** 正規化座標での正解ルート（S → 鏡面上の反射点… → G。中心同士の直線ではない） */
  routePoints: Vec2[];
  /** バンパー反射の回数 */
  reflectionCount: number;
  /** 盤面アスペクト比 width/height（CSS aspect-ratio 用） */
  aspectW: number;
  aspectH: number;
};

const MARGIN = 0.1;
const STEP = Math.PI / 4;
const ANGLES8 = [0, STEP, 2 * STEP, 3 * STEP, 4 * STEP, 5 * STEP, 6 * STEP, 7 * STEP] as const;

function len(x: number, y: number) {
  return Math.hypot(x, y);
}

function normalize(x: number, y: number): Vec2 {
  const L = len(x, y);
  if (L < 1e-9) return { x: 1, y: 0 };
  return { x: x / L, y: y / L };
}

function dot(a: Vec2, b: Vec2) {
  return a.x * b.x + a.y * b.y;
}

function bumperNormal(theta: number): { nx: number; ny: number } {
  return { nx: -Math.sin(theta), ny: Math.cos(theta) };
}

function reflect(vx: number, vy: number, nx: number, ny: number): Vec2 {
  const d = vx * nx + vy * ny;
  return { x: vx - 2 * d * nx, y: vy - 2 * d * ny };
}

function snap45(rad: number) {
  return Math.round(rad / STEP) * STEP;
}

function wrongAngle(correct: number, rng: () => number): number {
  const k = 1 + Math.floor(rng() * 7);
  return snap45(correct + k * STEP);
}

function inBounds(p: Vec2) {
  return p.x >= MARGIN && p.x <= 1 - MARGIN && p.y >= MARGIN && p.y <= 1 - MARGIN;
}

function minDist(a: Vec2, b: Vec2) {
  return len(a.x - b.x, a.y - b.y);
}

/** ランダム単位ベクトル */
function randomUnit(rng: () => number): Vec2 {
  const t = rng() * Math.PI * 2;
  return { x: Math.cos(t), y: Math.sin(t) };
}

/**
 * uOut を出射方向とする反射が可能な (uIn, theta) を探索
 */
function sampleIncomingForOutgoing(
  uOut: Vec2,
  rng: () => number,
  maxTries: number
): { uIn: Vec2; theta: number } | null {
  for (let t = 0; t < maxTries; t++) {
    const theta = ANGLES8[Math.floor(rng() * ANGLES8.length)]!;
    const { nx, ny } = bumperNormal(theta);
    const uIn = randomUnit(rng);
    const r = reflect(uIn.x, uIn.y, nx, ny);
    const out = normalize(r.x, r.y);
    if (dot(out, uOut) > 0.998) {
      return { uIn, theta };
    }
  }
  return null;
}

export type AspectPreset = { w: number; h: number };

export const ASPECT_PRESETS: AspectPreset[] = [
  { w: 1, h: 1 },
  { w: 9, h: 16 },
  { w: 3, h: 4 },
  { w: 4, h: 5 },
  { w: 5, h: 4 },
  { w: 16, h: 9 },
];

/**
 * レイ P + t*d (t>=0) と開区間セグメントの最も近い正の交差 t。無ければ null
 */
export function raySegmentHitT(px: number, py: number, dx: number, dy: number, ax: number, ay: number, bx: number, by: number): number | null {
  const abx = bx - ax;
  const aby = by - ay;
  const denom = dx * aby - dy * abx;
  if (Math.abs(denom) < 1e-10) return null;
  const apx = px - ax;
  const apy = py - ay;
  const t = (apx * aby - apy * abx) / denom;
  const s = (apx * dy - apy * dx) / denom;
  if (t < 1e-6 || s < 1e-4 || s > 1 - 1e-4) return null;
  return t;
}

/** 正規化座標の外壁（内側の辺）とのレイ交差 最小 t */
function rayAabbWallT(px: number, py: number, dx: number, dy: number, m: number): number | null {
  let best: number | null = null;
  const walls: [number, number, number, number][] = [
    [m, m, m, 1 - m],
    [1 - m, m, 1 - m, 1 - m],
    [m, m, 1 - m, m],
    [m, 1 - m, 1 - m, 1 - m],
  ];
  for (const [ax, ay, bx, by] of walls) {
    const t = raySegmentHitT(px, py, dx, dy, ax, ay, bx, by);
    if (t != null && (best == null || t < best)) best = t;
  }
  return best;
}

export type BumperSeg = { ax: number; ay: number; bx: number; by: number; index: number };

function bumperSegment(cx: number, cy: number, theta: number, halfLen: number): { ax: number; ay: number; bx: number; by: number } {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { ax: cx - c * halfLen, ay: cy - s * halfLen, bx: cx + c * halfLen, by: cy + s * halfLen };
}

/** 点を鏡面直線（中心 cx,cy、法線 bumperNormal(theta)）について反射した像 */
function reflectPointAcrossMirror(px: number, py: number, cx: number, cy: number, theta: number): Vec2 {
  const { nx, ny } = bumperNormal(theta);
  const vx = px - cx;
  const vy = py - cy;
  const d = vx * nx + vy * ny;
  return { x: px - 2 * d * nx, y: py - 2 * d * ny };
}

type PathNode = { pos: Vec2; uIn: Vec2; uOut: Vec2; theta: number };

/**
 * 生成時の各バンパー入射・出射方向に沿った、セグメント上の反射点を結ぶ正解ガイド
 * （中心同士を結ぶ屈折っぽい折れ線にはしない）
 */
function buildReflectionPolyline(start: Vec2, goal: Vec2, nodes: PathNode[], halfLen: number): Vec2[] {
  const pts: Vec2[] = [{ ...start }];
  let p = { ...start };

  for (let bi = 0; bi < nodes.length; bi++) {
    const n = nodes[bi]!;
    const seg = bumperSegment(n.pos.x, n.pos.y, n.theta, halfLen);
    const d = n.uIn;
    const t = raySegmentHitT(p.x, p.y, d.x, d.y, seg.ax, seg.ay, seg.bx, seg.by);
    if (t == null) {
      pts.push({ ...n.pos });
      const { nx, ny } = bumperNormal(n.theta);
      let nnx = nx;
      let nny = ny;
      if (d.x * nnx + d.y * nny > 0) {
        nnx = -nnx;
        nny = -nny;
      }
      const outv = reflect(d.x, d.y, nnx, nny);
      p = { x: n.pos.x + outv.x * 1e-4, y: n.pos.y + outv.y * 1e-4 };
      continue;
    }
    const hx = p.x + t * d.x;
    const hy = p.y + t * d.y;
    pts.push({ x: hx, y: hy });
    const { nx, ny } = bumperNormal(n.theta);
    let nnx = nx;
    let nny = ny;
    if (d.x * nnx + d.y * nny > 0) {
      nnx = -nnx;
      nny = -nny;
    }
    const outv = reflect(d.x, d.y, nnx, nny);
    p = { x: hx + outv.x * 1e-4, y: hy + outv.y * 1e-4 };
  }

  pts.push({ ...goal });
  return pts;
}

/** 1反射：ゴールの鏡像とスタートを結び、鏡面セグメントとの交点をヒット点にする */
function singleBumperReflectionPolyline(
  start: Vec2,
  goal: Vec2,
  cx: number,
  cy: number,
  theta: number,
  halfLen: number
): Vec2[] {
  const gRef = reflectPointAcrossMirror(goal.x, goal.y, cx, cy, theta);
  const seg = bumperSegment(cx, cy, theta, halfLen);
  const dx = gRef.x - start.x;
  const dy = gRef.y - start.y;
  const L0 = len(dx, dy);
  if (L0 < 1e-9) return [{ ...start }, { x: cx, y: cy }, { ...goal }];
  const d = { x: dx / L0, y: dy / L0 };
  const t = raySegmentHitT(start.x, start.y, d.x, d.y, seg.ax, seg.ay, seg.bx, seg.by);
  if (t == null) return [{ ...start }, { x: cx, y: cy }, { ...goal }];
  const hit = { x: start.x + t * d.x, y: start.y + t * d.y };
  return [{ ...start }, hit, { ...goal }];
}

/**
 * 生成したステージの幾何検証：S から順に各バンパーへ届き、最後に G へ向かうレイ順序
 */
export function validateStageOrder(
  start: Vec2,
  goal: Vec2,
  bumperCenters: Vec2[],
  angles: number[],
  halfLen: number
): boolean {
  if (bumperCenters.length === 0) return minDist(start, goal) > 0.05;

  const wallM = MARGIN * 0.92;
  const segs: BumperSeg[] = bumperCenters.map((c, i) => {
    const { ax, ay, bx, by } = bumperSegment(c.x, c.y, angles[i]!, halfLen);
    return { ax, ay, bx, by, index: i };
  });

  let p = { ...start };
  for (let bi = 0; bi < bumperCenters.length; bi++) {
    const target = bumperCenters[bi]!;
    const d = normalize(target.x - p.x, target.y - p.y);
    let bestT: number | null = null;
    let bestIdx: number | null = null;

    for (const seg of segs) {
      const t = raySegmentHitT(p.x, p.y, d.x, d.y, seg.ax, seg.ay, seg.bx, seg.by);
      if (t == null) continue;
      if (bestT == null || t < bestT) {
        bestT = t;
        bestIdx = seg.index;
      }
    }

    const wt = rayAabbWallT(p.x, p.y, d.x, d.y, wallM);
    if (bestT == null) return false;
    if (wt != null && wt + 1e-5 < bestT) return false;
    if (bestIdx !== bi) return false;

    const hitX = p.x + bestT * d.x;
    const hitY = p.y + bestT * d.y;
    const { nx, ny } = bumperNormal(angles[bi]!);
    let nnx = nx;
    let nny = ny;
    if (d.x * nnx + d.y * nny > 0) {
      nnx = -nnx;
      nny = -nny;
    }
    const rv = reflect(d.x, d.y, nnx, nny);
    p = { x: hitX + rv.x * 1e-4, y: hitY + rv.y * 1e-4 };
  }

  const dg = normalize(goal.x - p.x, goal.y - p.y);
  const distG = len(goal.x - p.x, goal.y - p.y);
  if (distG < 1e-6) return false;

  for (const seg of segs) {
    const t = raySegmentHitT(p.x, p.y, dg.x, dg.y, seg.ax, seg.ay, seg.bx, seg.by);
    if (t != null && t < distG - 0.03) return false;
  }

  const wt = rayAabbWallT(p.x, p.y, dg.x, dg.y, wallM);
  if (wt != null && wt < distG - 0.03) return false;

  const endX = p.x + distG * dg.x;
  const endY = p.y + distG * dg.y;
  return len(endX - goal.x, endY - goal.y) < 0.09;
}

export function generateStage(reflections: number, rng: () => number, aspect: AspectPreset): GeneratedStage | null {
  const halfLen = 0.11;

  for (let attempt = 0; attempt < 400; attempt++) {
    const goal: Vec2 = {
      x: MARGIN + rng() * (1 - 2 * MARGIN),
      y: MARGIN + rng() * (1 - 2 * MARGIN),
    };

    const nodes: PathNode[] = [];
    let P = { ...goal };
    let ok = true;

    for (let i = reflections; i >= 1; i--) {
      let uIn: Vec2;
      let theta: number;
      let uOut: Vec2;

      if (i === reflections) {
        uIn = randomUnit(rng);
        theta = ANGLES8[Math.floor(rng() * ANGLES8.length)]!;
        const { nx, ny } = bumperNormal(theta);
        const r = reflect(uIn.x, uIn.y, nx, ny);
        uOut = normalize(r.x, r.y);
      } else {
        const req = nodes[0]!.uIn;
        const found = sampleIncomingForOutgoing(req, rng, 320);
        if (!found) {
          ok = false;
          break;
        }
        uIn = found.uIn;
        theta = found.theta;
        const { nx, ny } = bumperNormal(theta);
        const r = reflect(uIn.x, uIn.y, nx, ny);
        uOut = normalize(r.x, r.y);
        if (dot(uOut, req) < 0.99) {
          ok = false;
          break;
        }
      }

      const L = 0.14 + rng() * 0.2;
      const B = { x: P.x - L * uOut.x, y: P.y - L * uOut.y };
      if (!inBounds(B)) {
        ok = false;
        break;
      }
      nodes.unshift({ pos: B, uIn, uOut, theta });
      P = B;
    }

    if (!ok) continue;

    const u0 = nodes[0]!.uIn;
    const L0 = 0.12 + rng() * 0.22;
    const start = { x: nodes[0]!.pos.x - L0 * u0.x, y: nodes[0]!.pos.y - L0 * u0.y };
    if (!inBounds(start)) continue;
    if (minDist(start, goal) < 0.14) continue;

    const bumpers: StageBumper[] = nodes.map((n) => ({
      x: n.pos.x,
      y: n.pos.y,
      angleCorrect: n.theta,
      angleWrong: wrongAngle(n.theta, rng),
    }));

    const centers = bumpers.map((b) => ({ x: b.x, y: b.y }));
    const angles = bumpers.map((b) => b.angleCorrect);
    if (!validateStageOrder(start, goal, centers, angles, halfLen)) continue;

    let separated = true;
    for (let i = 0; i < bumpers.length; i++) {
      for (let j = i + 1; j < bumpers.length; j++) {
        if (minDist(centers[i]!, centers[j]!) < 0.08) {
          separated = false;
          break;
        }
      }
      if (!separated) break;
    }
    if (!separated) continue;

    const routePoints = buildReflectionPolyline(start, goal, nodes, halfLen);
    return {
      start,
      goal,
      bumpers,
      routePoints,
      reflectionCount: reflections,
      aspectW: aspect.w,
      aspectH: aspect.h,
    };
  }

  return null;
}

/**
 * ランクに応じた反射回数（低ランクは 1 回）
 */
export function reflectionsForRank(rank: number) {
  const r = Math.max(1, Math.floor(rank));
  if (r <= 1) return 1;
  if (r === 2) return 2;
  if (r === 3) return 2;
  if (r === 4) return 3;
  return 3 + Math.min(2, r - 4);
}

export function createStageRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 自動生成が失敗したときの最低限プレイ可能な1反射ステージ */
export function fallbackStage1(aspect: AspectPreset): GeneratedStage {
  const theta = STEP * 3;
  const halfLen = 0.11;
  const start = { x: 0.14, y: 0.52 };
  const goal = { x: 0.84, y: 0.36 };
  const bx = 0.5;
  const by = 0.46;
  return {
    start,
    goal,
    bumpers: [
      {
        x: bx,
        y: by,
        angleCorrect: theta,
        angleWrong: snap45(theta + STEP * 2),
      },
    ],
    routePoints: singleBumperReflectionPolyline(start, goal, bx, by, theta, halfLen),
    reflectionCount: 1,
    aspectW: aspect.w,
    aspectH: aspect.h,
  };
}

export function generateStageWithFallback(reflections: number, rng: () => number, aspect: AspectPreset): GeneratedStage {
  return generateStage(reflections, rng, aspect) ?? fallbackStage1(aspect);
}
