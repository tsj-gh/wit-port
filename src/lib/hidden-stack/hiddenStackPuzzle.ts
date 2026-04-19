import * as THREE from "three";

export type GridCell = { x: number; y: number; z: number };

type HeightPoint = { x: number; y: number };

export type HiddenStackPuzzle = {
  gridSize: number;
  sourceSeed: string;
  columnHeights: number[][];
  cells: GridCell[];
  occupiedKeys: Set<string>;
  hiddenKeys: Set<string>;
  visibleKeys: Set<string>;
  hiddenCount: number;
  seed: string;
};

export type HiddenStackGenOptions = {
  gridSize?: number;
  minHidden?: number;
  maxHidden?: number;
};

const DEG = Math.PI / 180;

export function cellKey(c: GridCell): string {
  return `${c.x},${c.y},${c.z}`;
}

export function parseKey(k: string): GridCell {
  const [x, y, z] = k.split(",").map(Number);
  return { x, y, z };
}

/**
 * 立方体中心。
 * パズルの z を鉛直（Three.js +Y）として写像し、重力と一致させる。
 */
export function cellCenter(c: GridCell): THREE.Vector3 {
  return new THREE.Vector3(c.x + 0.5, c.z + 0.5, c.y + 0.5);
}

/**
 * 重力方向（z）に沿った柱状支え:
 * 各 (x,y,z) に立方体があるとき、真下 (x,y,z-1) にも立方体がある（z=0 は床が支える）。
 */
export function hasColumnSupport(occupied: Set<string>): boolean {
  for (const k of Array.from(occupied)) {
    const { x, y, z } = parseKey(k);
    if (z <= 0) continue;
    if (!occupied.has(`${x},${y},${z - 1}`)) return false;
  }
  return true;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h || 1;
}

function randomIntInclusive(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * 対角線スキャン順:
 * (0,0) → (1,0),(0,1) → ... → (G-1,G-1)
 */
function diagonalScanOrder(gridSize: number): HeightPoint[] {
  const order: HeightPoint[] = [];
  for (let s = 0; s <= 2 * (gridSize - 1); s++) {
    const xMax = Math.min(s, gridSize - 1);
    const xMin = Math.max(0, s - (gridSize - 1));
    for (let x = xMax; x >= xMin; x--) {
      const y = s - x;
      order.push({ x, y });
    }
  }
  return order;
}

/**
 * 壁による奥側の遮蔽禁止:
 * x0 > n かつ y0 > n のすべての n>0 について Zn > z0-n を満たす。
 */
function satisfiesOcclusionRule(heights: number[][], x0: number, y0: number, z0: number): boolean {
  for (let n = 1; x0 > n && y0 > n; n++) {
    const zn = heights[x0 - n][y0 - n];
    if (!(zn > z0 - n)) return false;
  }
  return true;
}

/**
 * 高さ z0（積み数）をランダム抽選し、条件を満たすまで再抽選する。
 */
function drawHeightWithRetry(rng: () => number, heights: number[][], x: number, y: number, gridSize: number): number {
  for (let attempt = 0; attempt < 80; attempt++) {
    const z0 = randomIntInclusive(rng, 1, gridSize);
    if (satisfiesOcclusionRule(heights, x, y, z0)) return z0;
  }

  // リトライ上限に達した場合、条件を満たす上限を解析してそこから再抽選。
  let maxAllowed = gridSize;
  for (let n = 1; x > n && y > n; n++) {
    const zn = heights[x - n][y - n];
    maxAllowed = Math.min(maxAllowed, zn + n - 1);
  }
  const capped = Math.max(1, maxAllowed);
  return randomIntInclusive(rng, 1, capped);
}

function buildColumnHeights(rng: () => number, gridSize: number): number[][] {
  const heights = Array.from({ length: gridSize }, () => Array<number>(gridSize).fill(0));
  const order = diagonalScanOrder(gridSize);
  for (const p of order) {
    heights[p.x][p.y] = drawHeightWithRetry(rng, heights, p.x, p.y, gridSize);
  }
  return heights;
}

function buildOccupiedByHeights(heights: number[][]): Set<string> {
  const gridSize = heights.length;
  const occupied = new Set<string>();
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      const z0 = heights[x][y];
      for (let z = 0; z < z0; z++) {
        occupied.add(cellKey({ x, y, z }));
      }
    }
  }
  return occupied;
}

/**
 * 仕様 3.5 の死角定義:
 * 真上(z+1), カメラ側 x+1, カメラ側 y+1 の3方向がすべて埋まる個体のみ死角。
 */
export function computeHiddenCellsByRule(occupied: Set<string>): { hidden: Set<string>; visible: Set<string> } {
  const hidden = new Set<string>();
  const visible = new Set<string>();
  for (const k of Array.from(occupied)) {
    const { x, y, z } = parseKey(k);
    const occludedZ = occupied.has(`${x},${y},${z + 1}`);
    const occludedX = occupied.has(`${x + 1},${y},${z}`);
    const occludedY = occupied.has(`${x},${y + 1},${z}`);
    if (occludedZ && occludedX && occludedY) hidden.add(k);
    else visible.add(k);
  }
  return { hidden, visible };
}

function buildPuzzleFromHeights(heights: number[][], sourceSeed: string, seed: string): HiddenStackPuzzle {
  const occupied = buildOccupiedByHeights(heights);
  const { hidden, visible } = computeHiddenCellsByRule(occupied);
  const cells = Array.from(occupied).map(parseKey);
  cells.sort((a, b) => (a.z - b.z) * 10000 + (a.y - b.y) * 100 + (a.x - b.x));

  return {
    gridSize: heights.length,
    sourceSeed,
    columnHeights: heights,
    cells,
    occupiedKeys: occupied,
    hiddenKeys: hidden,
    visibleKeys: visible,
    hiddenCount: hidden.size,
    seed,
  };
}

export function cameraPositionForTwist(
  twistDeg: number,
  radius: number,
  elevDeg: number,
  baseAzimDeg: number,
  lookAt: THREE.Vector3
): THREE.Vector3 {
  const azim = (baseAzimDeg + twistDeg) * DEG;
  const elev = elevDeg * DEG;
  const ch = radius * Math.cos(elev);
  const y = lookAt.y + radius * Math.sin(elev);
  const x = lookAt.x + ch * Math.cos(azim);
  const z = lookAt.z + ch * Math.sin(azim);
  return new THREE.Vector3(x, y, z);
}

export function generateHiddenStackPuzzle(seedStr: string, options: HiddenStackGenOptions = {}): HiddenStackPuzzle {
  const gridSize = Math.max(3, Math.min(6, Math.floor(options.gridSize ?? 3)));
  const minHidden = Math.max(1, options.minHidden ?? 1);
  const maxHidden = Math.max(minHidden, options.maxHidden ?? 10);
  const rng = mulberry32(hashSeed(seedStr));

  let best: HiddenStackPuzzle | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < 640; attempt++) {
    const heights = buildColumnHeights(rng, gridSize);
    const candidate = buildPuzzleFromHeights(heights, seedStr, `${seedStr}:${attempt}`);
    const score =
      candidate.hiddenCount < minHidden
        ? minHidden - candidate.hiddenCount
        : candidate.hiddenCount > maxHidden
          ? candidate.hiddenCount - maxHidden
          : 0;

    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
    if (score === 0) return candidate;
  }

  if (best) return best;

  const fallbackHeights = Array.from({ length: gridSize }, () => Array<number>(gridSize).fill(1));
  return buildPuzzleFromHeights(fallbackHeights, seedStr, `${seedStr}:fallback`);
}
