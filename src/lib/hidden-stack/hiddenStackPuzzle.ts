import * as THREE from "three";

export type GridCell = { x: number; y: number; z: number };

const DEG = Math.PI / 180;

export function cellKey(c: GridCell): string {
  return `${c.x},${c.y},${c.z}`;
}

export function parseKey(k: string): GridCell {
  const [x, y, z] = k.split(",").map(Number);
  return { x, y, z };
}

/** 各マス (x,y,z) に立方体があるとき、(x,y,z-1) も存在する（z=0 は床で支え） */
export function hasColumnSupport(occupied: Set<string>): boolean {
  for (const k of Array.from(occupied)) {
    const { x, y, z } = parseKey(k);
    if (z <= 0) continue;
    if (!occupied.has(`${x},${y},${z - 1}`)) return false;
  }
  return true;
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** 立方体中心（Y 上向き・Three.js 慣例）。グリッドは 0..2 の整数セル。 */
export function cellCenter(c: GridCell): THREE.Vector3 {
  return new THREE.Vector3(c.x + 0.5, c.y + 0.5, c.z + 0.5);
}

const boxHalf = new THREE.Vector3(0.5, 0.5, 0.5);

/**
 * レイが AABB と t ∈ (tMin, tMax) で交差するか（スラブ法）。
 * dir は正規化推奨。
 */
export function rayIntersectsAabb(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  center: THREE.Vector3,
  halfExtents: THREE.Vector3,
  tMin: number,
  tMax: number
): boolean {
  let t0 = tMin;
  let t1 = tMax;
  for (let a = 0; a < 3; a++) {
    const o = origin.getComponent(a);
    const d = dir.getComponent(a);
    const c = center.getComponent(a);
    const h = halfExtents.getComponent(a);
    const min = c - h;
    const max = c + h;
    if (Math.abs(d) < 1e-8) {
      if (o < min || o > max) return false;
    } else {
      const inv = 1 / d;
      let tNear = (min - o) * inv;
      let tFar = (max - o) * inv;
      if (tNear > tFar) [tNear, tFar] = [tFar, tNear];
      t0 = Math.max(t0, tNear);
      t1 = Math.min(t1, tFar);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/**
 * カメラから target へのセグメント上で、target 以外のいずれかの立方体が先にレイを遮るか。
 */
export function isOccludedFromCamera(
  cameraPos: THREE.Vector3,
  target: GridCell,
  occupied: Set<string>,
  eps = 1e-3
): boolean {
  const targetCenter = cellCenter(target);
  const dir = targetCenter.clone().sub(cameraPos);
  const dist = dir.length();
  if (dist < 1e-6) return false;
  dir.multiplyScalar(1 / dist);
  const tHitTarget = dist - 0.02; // わずかに手前まで

  for (const k of Array.from(occupied)) {
    const c = parseKey(k);
    if (c.x === target.x && c.y === target.y && c.z === target.z) continue;
    const center = cellCenter(c);
    if (rayIntersectsAabb(cameraPos, dir, center, boxHalf, eps, tHitTarget)) {
      return true;
    }
  }
  return false;
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

const TWIST_SAMPLES_DEG = [-15, -10, -5, 0, 5, 10, 15];

/**
 * 死角定義: ユーザーが Z 軸（Three では Y 軸）周りに ±15° だけ回したときの
 * いずれの角度からも立方体中心への視線が他ブロックに遮られないことが一度も無い。
 */
export function computeHiddenCells(
  occupied: Set<string>,
  lookAt = new THREE.Vector3(1.5, 1.5, 1.5),
  camRadius = 8,
  elevDeg = 38,
  baseAzimDeg = 48
): { hidden: Set<string>; visible: Set<string> } {
  const hidden = new Set<string>();
  const visible = new Set<string>();
  for (const k of Array.from(occupied)) {
    const cell = parseKey(k);
    let everSeen = false;
    for (const twist of TWIST_SAMPLES_DEG) {
      const cam = cameraPositionForTwist(twist, camRadius, elevDeg, baseAzimDeg, lookAt);
      if (!isOccludedFromCamera(cam, cell, occupied)) {
        everSeen = true;
        break;
      }
    }
    if (everSeen) visible.add(k);
    else hidden.add(k);
  }
  return { hidden, visible };
}

export type HiddenStackPuzzle = {
  cells: GridCell[];
  occupiedKeys: Set<string>;
  hiddenKeys: Set<string>;
  visibleKeys: Set<string>;
  hiddenCount: number;
  seed: string;
};

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomOccupied(rng: () => number): Set<string> {
  const all: GridCell[] = [];
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      for (let z = 0; z < 3; z++) {
        all.push({ x, y, z });
      }
    }
  }
  const upper = all.filter((c) => c.z > 0);
  shuffleInPlace(upper, rng);

  let occupied = new Set<string>(all.map(cellKey));

  for (const c of upper) {
    if (rng() > 0.32) continue;
    const k = cellKey(c);
    const next = new Set(occupied);
    next.delete(k);
    if (hasColumnSupport(next)) occupied = next;
  }

  shuffleInPlace(upper, rng);
  for (const c of upper) {
    if (rng() > 0.5) continue;
    const k = cellKey(c);
    if (!occupied.has(k)) continue;
    const next = new Set(occupied);
    next.delete(k);
    if (hasColumnSupport(next)) occupied = next;
  }

  return occupied;
}

export function generateHiddenStackPuzzle(seedStr: string): HiddenStackPuzzle {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  const rng = mulberry32(h || 1);

  const minH = 1;
  const maxH = 8;

  for (let attempt = 0; attempt < 320; attempt++) {
    const occ = randomOccupied(rng);
    const { hidden, visible } = computeHiddenCells(occ);
    if (hidden.size >= minH && hidden.size <= maxH) {
      const cells = Array.from(occ).map(parseKey);
      cells.sort((a, b) => (a.z - b.z) * 100 + (a.y - b.y) * 10 + (a.x - b.x));
      return {
        cells,
        occupiedKeys: occ,
        hiddenKeys: hidden,
        visibleKeys: visible,
        hiddenCount: hidden.size,
        seed: `${seedStr}:${attempt}`,
      };
    }
  }

  const occ = new Set<string>();
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      for (let z = 0; z < 3; z++) {
        occ.add(cellKey({ x, y, z }));
      }
    }
  }
  const { hidden, visible } = computeHiddenCells(occ);
  const cellsFb = Array.from(occ).map(parseKey);
  cellsFb.sort((a, b) => (a.z - b.z) * 100 + (a.y - b.y) * 10 + (a.x - b.x));
  return {
    cells: cellsFb,
    occupiedKeys: occ,
    hiddenKeys: hidden,
    visibleKeys: visible,
    hiddenCount: hidden.size,
    seed: `${seedStr}:fallback`,
  };
}
