import { bumperKindForTurn, diagonalBumperForTurn } from "./bumperRules";
import {
  addCell,
  dirsEqual,
  gridDeltaToScreenDir,
  keyCell,
  type BumperCell,
  type CellCoord,
  type GridStage,
  type BumperKind,
  DIR,
  type Dir,
  unitOrthoDirBetween,
} from "./gridTypes";

function inBounds(c: number, r: number, w: number, h: number) {
  return c >= 0 && c < w && r >= 0 && r < h;
}

/** UI 用：折れ回数目安・バンパー目安 */
export function bendOrBumperHint(grade: number): string {
  const g = Math.max(1, Math.min(5, Math.floor(grade)));
  if (g === 1) return "折れ1〜4";
  if (g === 2) return "折れ4〜6";
  if (g === 3) return "折れ6・再訪1";
  if (g === 4) return "バンパー2";
  return "バンパー3";
}

export function bumpersForGrade(grade: number): number {
  const g = Math.max(1, Math.min(5, Math.floor(grade)));
  if (g <= 2) return 0;
  if (g === 3) return 0;
  if (g === 4) return 2;
  return 3;
}

export function boardSizeForGrade(grade: number): { w: number; h: number } {
  const g = Math.max(1, Math.min(5, Math.floor(grade)));
  switch (g) {
    case 1:
      return { w: 4, h: 4 };
    case 2:
      return { w: 5, h: 5 };
    case 3:
      return { w: 6, h: 7 };
    case 4:
      return { w: 8, h: 9 };
    default:
      return { w: 10, h: 11 };
  }
}

function templatesForBoard(w: number, h: number, grade: number): (() => boolean[][])[] {
  const g = Math.max(1, Math.min(5, Math.floor(grade)));
  const rect = () => makeRect(w, h);
  if (g <= 1) return [rect];
  if (g === 2) return [rect, () => templateL(w, h)];
  if (g === 3) return [rect];
  if (g === 4) return [rect, () => templateL(w, h), () => templateT(w, h)];
  return [rect, () => templateL(w, h), () => templateT(w, h), () => templateCross(w, h)];
}

function makeRect(w: number, h: number): boolean[][] {
  return Array.from({ length: w }, () => Array<boolean>(h).fill(true));
}

function templateL(w: number, h: number): boolean[][] {
  const p = makeRect(w, h);
  const c0 = Math.ceil(w * 0.5);
  const r1 = Math.floor(h * 0.45);
  for (let c = c0; c < w; c++) {
    for (let r = 0; r < r1; r++) p[c]![r] = false;
  }
  return p;
}

function templateT(w: number, h: number): boolean[][] {
  const p = makeRect(w, h);
  const mid = Math.floor(w / 2);
  const arm = Math.max(2, Math.floor(w * 0.22));
  const r0 = Math.floor(h * 0.38);
  const r2 = Math.floor(h * 0.62);
  for (let c = 0; c < w; c++) {
    if (Math.abs(c - mid) <= arm) continue;
    for (let r = r0; r <= r2; r++) p[c]![r] = false;
  }
  return p;
}

function templateCross(w: number, h: number): boolean[][] {
  const p = makeRect(w, h);
  const mx = Math.floor(w / 2);
  const my = Math.floor(h / 2);
  const arm = Math.max(2, Math.min(mx, my) - 1);
  for (let c = 0; c < w; c++) {
    for (let r = 0; r < h; r++) {
      const onH = Math.abs(r - my) <= 1;
      const onV = Math.abs(c - mx) <= 1;
      if (onH || onV) continue;
      p[c]![r] = false;
    }
  }
  return p;
}

function connected(pathable: boolean[][], a: CellCoord, b: CellCoord): boolean {
  const w = pathable.length;
  const h = pathable[0]?.length ?? 0;
  const vis = new Set<string>();
  const q: CellCoord[] = [a];
  vis.add(keyCell(a.c, a.r));
  const dirs = [DIR.U, DIR.D, DIR.L, DIR.R];
  while (q.length) {
    const u = q.shift()!;
    if (u.c === b.c && u.r === b.r) return true;
    for (const d of dirs) {
      const { c: nc, r: nr } = addCell(u, d);
      if (!inBounds(nc, nr, w, h) || !pathable[nc]![nr]) continue;
      const k = keyCell(nc, nr);
      if (vis.has(k)) continue;
      vis.add(k);
      q.push({ c: nc, r: nr });
    }
  }
  return false;
}

function bottomCandidates(pathable: boolean[][]): CellCoord[] {
  const w = pathable.length;
  const h = pathable[0]?.length ?? 0;
  let maxR = -1;
  for (let c = 0; c < w; c++) {
    for (let r = 0; r < h; r++) {
      if (pathable[c]![r]) maxR = Math.max(maxR, r);
    }
  }
  const out: CellCoord[] = [];
  for (let c = 0; c < w; c++) {
    if (maxR < 0 || !pathable[c]![maxR]) continue;
    if (maxR > 0 && pathable[c]![maxR - 1]) out.push({ c, r: maxR });
  }
  return out.length ? out : [];
}

function topCandidates(pathable: boolean[][]): CellCoord[] {
  const w = pathable.length;
  const h = pathable[0]?.length ?? 0;
  let minR = 999;
  for (let c = 0; c < w; c++) {
    for (let r = 0; r < h; r++) {
      if (pathable[c]![r]) minR = Math.min(minR, r);
    }
  }
  const out: CellCoord[] = [];
  for (let c = 0; c < w; c++) {
    if (minR > 900 || !pathable[c]![minR]) continue;
    if (minR + 1 < h && pathable[c]![minR + 1]) out.push({ c, r: minR });
  }
  return out.length ? out : [];
}

function findSimplePath(
  pathable: boolean[][],
  start: CellCoord,
  goal: CellCoord,
  rng: () => number,
  maxLen: number
): CellCoord[] | null {
  const w = pathable.length;
  const h = pathable[0]!.length;
  const path: CellCoord[] = [];
  const visited = new Set<string>();

  function neighbors(cell: CellCoord): CellCoord[] {
    const n: CellCoord[] = [];
    for (const d of [DIR.U, DIR.D, DIR.L, DIR.R]) {
      const { c: nc, r: nr } = addCell(cell, d);
      if (inBounds(nc, nr, w, h) && pathable[nc]![nr]) n.push({ c: nc, r: nr });
    }
    for (let i = n.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [n[i], n[j]] = [n[j]!, n[i]!];
    }
    return n;
  }

  function dfs(cur: CellCoord): boolean {
    if (path.length > maxLen) return false;
    visited.add(keyCell(cur.c, cur.r));
    path.push(cur);
    if (cur.c === goal.c && cur.r === goal.r) return true;
    for (const n of neighbors(cur)) {
      const k = keyCell(n.c, n.r);
      if (visited.has(k)) continue;
      if (dfs(n)) return true;
    }
    path.pop();
    visited.delete(keyCell(cur.c, cur.r));
    return false;
  }

  if (!dfs(start)) return null;
  return path;
}

function addDeadEndBranches(
  pathable: boolean[][],
  mainKeys: Set<string>,
  rng: () => number,
  budget: number
) {
  const w = pathable.length;
  const h = pathable[0]!.length;
  let used = 0;
  const mainCells = Array.from(mainKeys).map((k) => {
    const [c, r] = k.split(",").map(Number);
    return { c: c!, r: r! };
  });

  for (const cell of mainCells.sort(() => rng() - 0.5)) {
    if (used >= budget) break;
    if (rng() > 0.4) continue;
    const dirs = [DIR.U, DIR.D, DIR.L, DIR.R].sort(() => rng() - 0.5);
    for (const d of dirs) {
      let cur = addCell(cell, d);
      let steps = 0;
      while (steps < 4 && inBounds(cur.c, cur.r, w, h) && !pathable[cur.c]![cur.r] && used < budget) {
        pathable[cur.c]![cur.r] = true;
        used++;
        steps++;
        if (rng() < 0.35) break;
        cur = addCell(cur, d);
      }
      if (steps) break;
    }
  }
}

export function createStageRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** target を parts 個の非零整数に分ける（和 = target）。失敗時 null */
function randomNonZeroSplit(target: number, parts: number, rng: () => number): number[] | null {
  if (parts === 0) return target === 0 ? [] : null;
  if (parts === 1) return target !== 0 ? [target] : null;
  for (let attempt = 0; attempt < 120; attempt++) {
    const a: number[] = [];
    let s = 0;
    for (let i = 0; i < parts - 1; i++) {
      const sign = rng() < 0.5 ? -1 : 1;
      const mag = 1 + Math.floor(rng() * 10);
      const v = sign * mag;
      a.push(v);
      s += v;
    }
    const last = target - s;
    if (last !== 0 && Math.abs(last) >= 1) {
      a.push(last);
      return a;
    }
  }
  return null;
}

/** グリッド差分 (Δc, Δr) から画面上の隣接 1 歩の `Dir` */
function unitStepDir(deltaC: number, deltaR: number): Dir | null {
  if (!((Math.abs(deltaC) === 1 && deltaR === 0) || (deltaC === 0 && Math.abs(deltaR) === 1))) return null;
  return gridDeltaToScreenDir({ dx: deltaC, dy: deltaR });
}

function orthogonalDirs(a: Dir, b: Dir): boolean {
  return a.dx * b.dx + a.dy * b.dy === 0 && a.dx * a.dx + a.dy * a.dy === 1 && b.dx * b.dx + b.dy * b.dy === 1;
}

type InteriorPassage = "horizontal" | "vertical" | "bend" | "invalid";

/** 経路添字 i（両端除く）での通過: 直進（同軸・反対向き同軸含む）／90°折れ／非隣接など無効 */
function interiorPassageKind(path: CellCoord[], i: number): InteriorPassage {
  if (i <= 0 || i >= path.length - 1) return "invalid";
  const d0 = unitStepDir(path[i]!.c - path[i - 1]!.c, path[i]!.r - path[i - 1]!.r);
  const d1 = unitStepDir(path[i + 1]!.c - path[i]!.c, path[i + 1]!.r - path[i]!.r);
  if (!d0 || !d1) return "invalid";
  if (orthogonalDirs(d0, d1)) return "bend";
  if (d0.dx === 0 && d1.dx === 0) return "vertical";
  if (d0.dy === 0 && d1.dy === 0) return "horizontal";
  return "invalid";
}

/**
 * 直交マス（十）が経路上に存在するか。
 *
 * 定義: そのマスは経路中に2回以上通過し、かつ両端を除く各通過で 90° に折れない（直進）こと。
 * さらに、内部通過のうち列方向（東西）の直進が1回以上、行方向（南北）の直進が1回以上あること。
 * （経路を描くと当該マスで「十」字に交差して見える。）
 */
export function pathHasOrthogonalCrossCell(path: CellCoord[]): boolean {
  if (path.length < 3) return false;

  const visitCount = new Map<string, number>();
  for (const p of path) {
    const k = keyCell(p.c, p.r);
    visitCount.set(k, (visitCount.get(k) ?? 0) + 1);
  }

  const acc = new Map<
    string,
    {
      horizontal: boolean;
      vertical: boolean;
      hasBendOrInvalid: boolean;
    }
  >();

  for (let i = 1; i <= path.length - 2; i++) {
    const k = keyCell(path[i]!.c, path[i]!.r);
    const kind = interiorPassageKind(path, i);
    let r = acc.get(k);
    if (!r) {
      r = { horizontal: false, vertical: false, hasBendOrInvalid: false };
      acc.set(k, r);
    }
    if (kind === "bend" || kind === "invalid") r.hasBendOrInvalid = true;
    if (kind === "horizontal") r.horizontal = true;
    if (kind === "vertical") r.vertical = true;
  }

  for (const [k, r] of Array.from(acc.entries())) {
    if ((visitCount.get(k) ?? 0) < 2) continue;
    if (r.hasBendOrInvalid) continue;
    if (r.horizontal && r.vertical) return true;
  }
  return false;
}

function bendCellsInPath(path: CellCoord[]): Set<string> {
  const s = new Set<string>();
  for (let i = 1; i < path.length - 1; i++) {
    const d0 = unitStepDir(path[i]!.c - path[i - 1]!.c, path[i]!.r - path[i - 1]!.r);
    const d1 = unitStepDir(path[i + 1]!.c - path[i]!.c, path[i + 1]!.r - path[i]!.r);
    if (d0 && d1 && orthogonalDirs(d0, d1)) s.add(keyCell(path[i]!.c, path[i]!.r));
  }
  return s;
}

function pathFirstStepDir(path: CellCoord[]): Dir | null {
  if (path.length < 2) return null;
  return unitStepDir(path[1]!.c - path[0]!.c, path[1]!.r - path[0]!.r);
}

function isStrictlyOutsideBoard(c: number, r: number, w: number, h: number) {
  return c < 0 || c >= w || r < 0 || r >= h;
}

/** pathable と path を同時に 90° CCW 回転（新幅=旧高、新高=旧幅） */
function applyQuarterCCWPathable(
  pathable: boolean[][],
  path: CellCoord[],
  w: number,
  h: number
): { path: CellCoord[]; pathable: boolean[][]; w: number; h: number } {
  const nw = h;
  const nh = w;
  const newPath = path.map(({ c, r }) => ({ c: r, r: w - 1 - c }));
  const newPathable: boolean[][] = Array.from({ length: nw }, () => Array<boolean>(nh).fill(false));
  for (let c = 0; c < w; c++) {
    for (let r = 0; r < h; r++) {
      newPathable[r]![w - 1 - c] = pathable[c]![r]!;
    }
  }
  return { path: newPath, pathable: newPathable, w: nw, h: nh };
}

function grade1NoRevisit(path: CellCoord[]): boolean {
  const seen = new Set<string>();
  for (const p of path) {
    const k = keyCell(p.c, p.r);
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

function grade2BendNoRevisit(path: CellCoord[], bends: Set<string>): boolean {
  const counts = new Map<string, number>();
  for (const p of path) {
    const k = keyCell(p.c, p.r);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let bad = false;
  counts.forEach((n, k) => {
    if (bends.has(k) && n !== 1) bad = true;
  });
  return !bad;
}

/**
 * Grade 3: ちょうど 1 マスが 2 回出現。1 回目は直進（水平／垂直）、2 回目は 90° 折れ。
 * 2 回目の入射ベクトル（直前→当該）が 1 回目と異なる。1 マス 1 バンパーと整合。
 */
function grade3RevisitOneCellRule(path: CellCoord[]): boolean {
  if (path.length < 4) return false;
  const keyToIndices = new Map<string, number[]>();
  path.forEach((p, i) => {
    const k = keyCell(p.c, p.r);
    let arr = keyToIndices.get(k);
    if (!arr) {
      arr = [];
      keyToIndices.set(k, arr);
    }
    arr.push(i);
  });
  let doubleKey: string | null = null;
  for (const [k, arr] of Array.from(keyToIndices.entries())) {
    if (arr.length === 2) {
      if (doubleKey !== null) return false;
      doubleKey = k;
    } else if (arr.length !== 1) return false;
  }
  if (!doubleKey) return false;
  const pair = keyToIndices.get(doubleKey)!;
  const i0 = Math.min(pair[0]!, pair[1]!);
  const i1 = Math.max(pair[0]!, pair[1]!);
  if (i0 <= 0 || i1 >= path.length - 1) return false;
  const k0 = interiorPassageKind(path, i0);
  if (k0 === "bend" || k0 === "invalid") return false;
  if (interiorPassageKind(path, i1) !== "bend") return false;
  const d0 = unitStepDir(path[i0]!.c - path[i0 - 1]!.c, path[i0]!.r - path[i0 - 1]!.r);
  const d1 = unitStepDir(path[i1]!.c - path[i1 - 1]!.c, path[i1]!.r - path[i1 - 1]!.r);
  if (!d0 || !d1) return false;
  if (d0.dx === d1.dx && d0.dy === d1.dy) return false;
  return true;
}

function findGrade3SixBendPath(
  pathable: boolean[][],
  start: CellCoord,
  goal: CellCoord,
  rng: () => number
): CellCoord[] | null {
  const w = pathable.length;
  const h = pathable[0]!.length;
  let probed = 0;
  const PROBE_LIMIT = 2_200_000;

  function dfs(cur: CellCoord, path: CellCoord[], vmap: Map<string, number>): CellCoord[] | null {
    if (++probed > PROBE_LIMIT) return null;
    if (path.length >= w * h + 14) return null;
    if (countRightAngles(path) > 6) return null;

    if (cur.c === goal.c && cur.r === goal.r) {
      if (!grade3RevisitOneCellRule(path)) return null;
      if (countRightAngles(path) !== 6) return null;
      return path.slice();
    }

    const opts = [DIR.U, DIR.D, DIR.L, DIR.R]
      .map((d) => {
        const p = addCell(cur, d);
        return { p };
      })
      .filter(({ p }) => inBounds(p.c, p.r, w, h) && pathable[p.c]![p.r])
      .sort(() => rng() - 0.5);

    for (const { p } of opts) {
      const k = keyCell(p.c, p.r);
      const next = new Map(vmap);
      const nv = (next.get(k) ?? 0) + 1;
      if (nv > 2) continue;
      next.set(k, nv);
      let nDouble = 0;
      for (const v of Array.from(next.values())) {
        if (v === 2) nDouble++;
      }
      if (nDouble > 1) continue;

      path.push(p);
      const got = dfs(p, path, next);
      path.pop();
      if (got) return got;
    }
    return null;
  }

  const vm = new Map([[keyCell(start.c, start.r), 1]]);
  const path: CellCoord[] = [start];
  return dfs(start, path, vm);
}

function tryOrthogonalPolyline(
  start: CellCoord,
  goal: CellCoord,
  bends: number,
  firstHorizontal: boolean,
  pathable: boolean[][],
  rng: () => number
): CellCoord[] | null {
  const w = pathable.length;
  const h = pathable[0]!.length;
  const nSeg = bends + 1;
  const dc = goal.c - start.c;
  const dr = goal.r - start.r;
  const hIdx: number[] = [];
  const vIdx: number[] = [];
  for (let i = 0; i < nSeg; i++) {
    const isH = firstHorizontal ? i % 2 === 0 : i % 2 === 1;
    if (isH) hIdx.push(i);
    else vIdx.push(i);
  }
  const hs = randomNonZeroSplit(dc, hIdx.length, rng);
  const vs = randomNonZeroSplit(dr, vIdx.length, rng);
  if (!hs || !vs) return null;
  const lens = new Array<number>(nSeg);
  hIdx.forEach((idx, j) => {
    lens[idx] = hs[j]!;
  });
  vIdx.forEach((idx, j) => {
    lens[idx] = vs[j]!;
  });

  const path: CellCoord[] = [];
  let cur: CellCoord = { ...start };
  path.push(cur);

  for (let i = 0; i < nSeg; i++) {
    const isH = firstHorizontal ? i % 2 === 0 : i % 2 === 1;
    let d: Dir;
    if (isH) d = lens[i]! > 0 ? DIR.R : DIR.L;
    else d = lens[i]! > 0 ? DIR.D : DIR.U;
    const steps = Math.abs(lens[i]!);
    for (let s = 0; s < steps; s++) {
      cur = addCell(cur, d);
      if (!inBounds(cur.c, cur.r, w, h) || !pathable[cur.c]![cur.r]) return null;
      path.push(cur);
    }
  }
  if (cur.c !== goal.c || cur.r !== goal.r) return null;
  return path;
}

function countRightAngles(path: CellCoord[]): number {
  let n = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const d0 = unitStepDir(path[i]!.c - path[i - 1]!.c, path[i]!.r - path[i - 1]!.r);
    const d1 = unitStepDir(path[i + 1]!.c - path[i]!.c, path[i + 1]!.r - path[i]!.r);
    if (d0 && d1 && orthogonalDirs(d0, d1)) n++;
  }
  return n;
}

function unitDirBetween(a: CellCoord, b: CellCoord): Dir | null {
  const dx = Math.sign(b.c - a.c);
  const dy = Math.sign(b.r - a.r);
  if (dx !== 0 && dy !== 0) return null;
  if (dx === 0 && dy === 0) return null;
  return { dx, dy };
}

function portalBendAtStart(path: CellCoord[], startPad: CellCoord): boolean {
  if (path.length < 2) return false;
  const dIn = unitDirBetween(startPad, path[0]!);
  const dOut = unitDirBetween(path[0]!, path[1]!);
  return !!(dIn && dOut && orthogonalDirs(dIn, dOut));
}

function portalBendAtGoal(path: CellCoord[], goalPad: CellCoord): boolean {
  if (path.length < 2) return false;
  const g = path[path.length - 1]!;
  const prev = path[path.length - 2]!;
  const dIn = unitDirBetween(prev, g);
  const dOut = unitDirBetween(g, goalPad);
  return !!(dIn && dOut && orthogonalDirs(dIn, dOut));
}

function totalDiagonalTurnCount(path: CellCoord[], startPad: CellCoord, goalPad: CellCoord): number {
  let n = countRightAngles(path);
  if (portalBendAtStart(path, startPad)) n++;
  if (portalBendAtGoal(path, goalPad)) n++;
  return n;
}

function bendCellsInPathWithPortals(path: CellCoord[], startPad: CellCoord, goalPad: CellCoord): Set<string> {
  const s = bendCellsInPath(path);
  if (portalBendAtStart(path, startPad)) s.add(keyCell(path[0]!.c, path[0]!.r));
  if (portalBendAtGoal(path, goalPad)) s.add(keyCell(path[path.length - 1]!.c, path[path.length - 1]!.r));
  return s;
}

/** 盤内経路＋射出→入口・出口→ゴールパッドの直交にも斜めバンパーを置く */
function placeDiagonalBumpers(
  path: CellCoord[],
  startPad: CellCoord,
  goalPad: CellCoord
): {
  bumpers: Map<string, BumperCell>;
  ok: boolean;
} {
  const bumpers = new Map<string, BumperCell>();

  if (path.length >= 2 && portalBendAtStart(path, startPad)) {
    const gIn = unitDirBetween(startPad, path[0]!)!;
    const gOut = unitDirBetween(path[0]!, path[1]!)!;
    const dIn = unitStepDir(gIn.dx, gIn.dy)!;
    const dOut = unitStepDir(gOut.dx, gOut.dy)!;
    const sol = diagonalBumperForTurn(dIn, dOut);
    if (sol) bumpers.set(keyCell(path[0]!.c, path[0]!.r), { display: sol, solution: sol });
  }

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1]!;
    const cur = path[i]!;
    const next = path[i + 1]!;
    const dIn = unitStepDir(cur.c - prev.c, cur.r - prev.r);
    const dOut = unitStepDir(next.c - cur.c, next.r - cur.r);
    if (!dIn || !dOut) continue;
    const sol = diagonalBumperForTurn(dIn, dOut);
    if (sol == null) continue;
    bumpers.set(keyCell(cur.c, cur.r), { display: sol, solution: sol });
  }

  if (path.length >= 2 && portalBendAtGoal(path, goalPad)) {
    const g = path[path.length - 1]!;
    const prev = path[path.length - 2]!;
    const gIn = unitDirBetween(prev, g)!;
    const gOut = unitDirBetween(g, goalPad)!;
    const dIn = unitStepDir(gIn.dx, gIn.dy)!;
    const dOut = unitStepDir(gOut.dx, gOut.dy)!;
    const sol = diagonalBumperForTurn(dIn, dOut);
    if (sol) bumpers.set(keyCell(g.c, g.r), { display: sol, solution: sol });
  }

  const expected = totalDiagonalTurnCount(path, startPad, goalPad);
  const ok = bumpers.size === expected && expected > 0;
  return { bumpers, ok };
}

/** 盤内の直角折れのみ斜めバンパー（start/goal のポータル折れは置かない） */
function placeDiagonalBumpersInterior(path: CellCoord[]): {
  bumpers: Map<string, BumperCell>;
  ok: boolean;
} {
  const bumpers = new Map<string, BumperCell>();
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1]!;
    const cur = path[i]!;
    const next = path[i + 1]!;
    const dIn = unitStepDir(cur.c - prev.c, cur.r - prev.r);
    const dOut = unitStepDir(next.c - cur.c, next.r - cur.r);
    if (!dIn || !dOut) continue;
    const sol = diagonalBumperForTurn(dIn, dOut);
    if (sol == null) continue;
    bumpers.set(keyCell(cur.c, cur.r), { display: sol, solution: sol });
  }
  const expected = countRightAngles(path);
  const ok = bumpers.size === expected && expected > 0;
  return { bumpers, ok };
}

type Grade2OrientedSnapshot = {
  width: number;
  height: number;
  pathable: boolean[][];
  start: CellCoord;
  goal: CellCoord;
  startPad: CellCoord;
  goalPad: CellCoord;
  solutionPath: CellCoord[];
  bumpers: Map<string, BumperCell>;
};

function pickGrade2OrientedStage(
  pathable: boolean[][],
  path: CellCoord[],
  w0: number,
  h0: number,
  bends: number,
  rng: () => number,
  opts?: { relaxBendVisit?: boolean }
): Grade2OrientedSnapshot | null {
  const winners: Grade2OrientedSnapshot[] = [];
  for (let k = 0; k < 4; k++) {
    let p = path.map((x) => ({ ...x }));
    let pb = pathable.map((col) => [...col!]);
    let w = w0;
    let h = h0;
    for (let i = 0; i < k; i++) {
      const nx = applyQuarterCCWPathable(pb, p, w, h);
      p = nx.path;
      pb = nx.pathable;
      w = nx.w;
      h = nx.h;
    }
    const fs = pathFirstStepDir(p);
    if (!fs || !dirsEqual(fs, DIR.U)) continue;

    const start = p[0]!;
    const goal = p[p.length - 1]!;
    const startPad = { c: start.c, r: start.r + 1 };
    const prev = p[p.length - 2]!;
    const dLast = unitDirBetween(prev, goal);
    if (!dLast) continue;
    const goalPad = { c: goal.c + dLast.dx, r: goal.r + dLast.dy };
    if (!isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) continue;

    const dEntry = unitOrthoDirBetween(startPad, start);
    if (!dEntry || !dirsEqual(dEntry, DIR.U)) continue;

    const bendSet = bendCellsInPath(p);
    if (!opts?.relaxBendVisit && !grade2BendNoRevisit(p, bendSet)) continue;

    const { bumpers, ok } = placeDiagonalBumpersInterior(p);
    if (!ok || bumpers.size !== bends) continue;

    winners.push({
      width: w,
      height: h,
      pathable: pb,
      start,
      goal,
      startPad,
      goalPad,
      solutionPath: p,
      bumpers: new Map(bumpers),
    });
  }
  if (!winners.length) return null;
  return winners[Math.floor(rng() * winners.length)]!;
}

/** Grade 3: 折れ 6・1 マス再訪（直進→折れ・別入射）→ Grade 2 と同型の向き調整 */
function generateGrade3Stage(seed: number): GridStage | null {
  const rng = createStageRng(seed);
  const { w: W, h: H } = boardSizeForGrade(3);
  const pathable = makeRect(W, H);
  const maxAttempts = 500;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const bottoms = bottomCandidates(pathable);
    const tops = topCandidates(pathable);
    if (!bottoms.length || !tops.length) return null;
    const start = bottoms[Math.floor(rng() * bottoms.length)]!;
    const goal = tops[Math.floor(rng() * tops.length)]!;
    const path = findGrade3SixBendPath(pathable, start, goal, rng);
    if (!path) continue;
    const picked = pickGrade2OrientedStage(pathable, path, W, H, 6, rng, { relaxBendVisit: true });
    if (!picked) continue;
    const dup = new Map<string, BumperCell>();
    picked.bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
    shuffleWrongDisplay(dup, rng);
    return {
      width: picked.width,
      height: picked.height,
      pathable: picked.pathable,
      start: picked.start,
      goal: picked.goal,
      startPad: picked.startPad,
      goalPad: picked.goalPad,
      bumpers: dup,
      solutionPath: picked.solutionPath,
      grade: 3,
      seed,
    };
  }
  return null;
}

function wrongDiagonal(sol: BumperKind): BumperKind {
  return sol === "SLASH" ? "BACKSLASH" : "SLASH";
}

function shuffleWrongDisplay(bumpers: Map<string, BumperCell>, rng: () => number) {
  let hasWrong = false;
  bumpers.forEach((cell) => {
    if (rng() < 0.55) {
      cell.display = wrongDiagonal(cell.solution);
      hasWrong = true;
    }
  });
  if (!hasWrong && bumpers.size) {
    const first = bumpers.keys().next().value!;
    const c = bumpers.get(first)!;
    c.display = wrongDiagonal(c.solution);
  }
}

/** Grade1/2：矩形盤・折れ線経路・斜めバンパーのみ */
function generatePolylineStage(grade: number, seed: number): GridStage | null {
  const rng = createStageRng(seed);
  const { w: W, h: H } = boardSizeForGrade(grade);
  const pathable = makeRect(W, H);

  const maxAttempts = grade === 2 ? 1200 : 350;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const bottoms = bottomCandidates(pathable);
    const tops = topCandidates(pathable);
    if (!bottoms.length || !tops.length) return null;

    const start = bottoms[Math.floor(rng() * bottoms.length)]!;
    const goal = tops[Math.floor(rng() * tops.length)]!;
    const dc = goal.c - start.c;
    const dr = goal.r - start.r;

    let bends: number;
    if (grade === 1) {
      bends = Math.floor(rng() * 4) + 1;
    } else {
      bends = rng() < 0.5 ? 4 : 6;
      // 折れ4: 列差・行差の両方が非零（両軸に直交ターンが必ず現れる経路のみ）
      if (bends === 4 && (dc === 0 || dr === 0)) continue;
    }

    let path: CellCoord[] | null = null;
    const polyTries = grade === 2 && bends === 4 ? 40 : 24;
    for (let t = 0; t < polyTries; t++) {
      const firstH = grade === 2 && bends === 4 && t < 2 ? t % 2 === 0 : rng() < 0.5;
      path = tryOrthogonalPolyline(start, goal, bends, firstH, pathable, rng);
      if (path) break;
    }
    if (!path) continue;

    if (countRightAngles(path) !== bends) continue;

    if (grade === 2) {
      if (bends === 6) {
        if (!grade1NoRevisit(path)) continue;
      } else if (!pathHasOrthogonalCrossCell(path)) {
        continue;
      }
    }

    if (grade === 2) {
      const picked = pickGrade2OrientedStage(pathable, path, W, H, bends, rng);
      if (!picked) continue;
      const dup = new Map<string, BumperCell>();
      picked.bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
      shuffleWrongDisplay(dup, rng);
      return {
        width: picked.width,
        height: picked.height,
        pathable: picked.pathable,
        start: picked.start,
        goal: picked.goal,
        startPad: picked.startPad,
        goalPad: picked.goalPad,
        bumpers: dup,
        solutionPath: picked.solutionPath,
        grade,
        seed,
      };
    }

    const startPad = { c: start.c, r: start.r + 1 };
    const goalPad = { c: goal.c, r: goal.r - 1 };

    if (grade === 1) {
      if (!grade1NoRevisit(path)) continue;
    }

    const { bumpers, ok } = placeDiagonalBumpers(path, startPad, goalPad);
    if (!ok || bumpers.size === 0) continue;
    if (bumpers.size >= 5) continue;

    const dup = new Map<string, BumperCell>();
    bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
    shuffleWrongDisplay(dup, rng);

    return {
      width: W,
      height: H,
      pathable,
      start,
      goal,
      startPad,
      goalPad,
      bumpers: dup,
      solutionPath: path,
      grade,
      seed,
    };
  }
  return null;
}

export function generateGridStage(grade: number, seed: number): GridStage | null {
  const g = Math.max(1, Math.min(5, Math.floor(grade)));
  if (g <= 2) return generatePolylineStage(grade, seed);
  if (g === 3) return generateGrade3Stage(seed);

  const rng = createStageRng(seed);
  const bumperN = bumpersForGrade(grade);
  const { w: W, h: H } = boardSizeForGrade(grade);
  const templates = templatesForBoard(W, H, grade);

  for (let attempt = 0; attempt < 200; attempt++) {
    const tIdx = Math.floor(rng() * templates.length);
    let pathable = templates[tIdx]!();
    const w = pathable.length;
    const h = pathable[0]?.length ?? 0;

    const bottoms = bottomCandidates(pathable);
    const tops = topCandidates(pathable);
    if (!bottoms.length || !tops.length) continue;

    const start = bottoms[Math.floor(rng() * bottoms.length)]!;
    const goal = tops[Math.floor(rng() * tops.length)]!;
    if (!connected(pathable, start, goal)) continue;

    const maxLen = w * h + 5;
    const path = findSimplePath(pathable, start, goal, rng, maxLen);
    if (!path || path.length < bumperN + 2) continue;

    const innerIndices: number[] = [];
    for (let i = 1; i < path.length - 1; i++) innerIndices.push(i);
    for (let i = innerIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [innerIndices[i], innerIndices[j]] = [innerIndices[j]!, innerIndices[i]!];
    }
    const chosen = innerIndices.slice(0, bumperN).sort((a, b) => a - b);
    const bumpers = new Map<string, BumperCell>();
    const solutionKinds: { key: string; sol: BumperKind }[] = [];

    let ok = true;
    for (const idx of chosen) {
      const prev = path[idx - 1]!;
      const cur = path[idx]!;
      const next = path[idx + 1]!;
      const dIn = unitStepDir(cur.c - prev.c, cur.r - prev.r);
      const dOut = unitStepDir(next.c - cur.c, next.r - cur.r);
      if (!dIn || !dOut) {
        ok = false;
        break;
      }
      const sol = bumperKindForTurn(dIn, dOut);
      if (sol == null) {
        ok = false;
        break;
      }
      const k = keyCell(cur.c, cur.r);
      solutionKinds.push({ key: k, sol });
      bumpers.set(k, { display: sol, solution: sol });
    }
    if (!ok) continue;

    const mainKeys = new Set(path.map((p) => keyCell(p.c, p.r)));
    const branchBudget = Math.min(14, Math.max(2, Math.floor((w * h) / 5)));
    addDeadEndBranches(pathable, mainKeys, rng, branchBudget);

    for (const { key: bk, sol } of solutionKinds) {
      const wrongPool = (["SLASH", "BACKSLASH", "HYPHEN", "PIPE"] as const).filter((x) => x !== sol);
      const display = wrongPool[Math.floor(rng() * wrongPool.length)] ?? sol;
      bumpers.set(bk, { display, solution: sol });
    }
    let hasWrong = false;
    for (const { key: bk, sol } of solutionKinds) {
      if (bumpers.get(bk)!.display !== sol) hasWrong = true;
    }
    if (!hasWrong && solutionKinds.length) {
      const first = solutionKinds[0]!;
      const alts = (["SLASH", "BACKSLASH", "HYPHEN", "PIPE"] as const).filter((x) => x !== first.sol);
      bumpers.set(first.key, { display: alts[0]!, solution: first.sol });
    }

    return {
      width: w,
      height: h,
      pathable,
      start,
      goal,
      startPad: { c: start.c, r: start.r + 1 },
      goalPad: { c: goal.c, r: goal.r - 1 },
      bumpers,
      solutionPath: path,
      grade,
      seed,
    };
  }

  return null;
}

/** 手組みフォールバック（G1/2 折れ線、G3 折れ6再訪、G4+ 直線＋矩形） */
export function fallbackGridStage(grade: number, seed: number): GridStage {
  const g = Math.max(1, Math.min(5, Math.floor(grade)));
  if (g === 1) {
    const w = 5;
    const h = 5;
    const pathable = makeRect(w, h);
    const start = { c: 1, r: 4 };
    const goal = { c: 1, r: 0 };
    const path: CellCoord[] = [];
    for (let c = 1; c <= 4; c++) path.push({ c, r: 4 });
    for (let r = 3; r >= 0; r--) path.push({ c: 4, r });
    for (let c = 3; c >= 1; c--) path.push({ c, r: 0 });
    const startPad = { c: start.c, r: start.r + 1 };
    const goalPad = { c: goal.c, r: goal.r - 1 };
    const { bumpers, ok } = placeDiagonalBumpers(path, startPad, goalPad);
    const dup = new Map<string, BumperCell>();
    if (ok) bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
    if (dup.size) shuffleWrongDisplay(dup, createStageRng(seed));
    return {
      width: w,
      height: h,
      pathable,
      start,
      goal,
      startPad,
      goalPad,
      bumpers: dup,
      solutionPath: path,
      grade,
      seed,
    };
  }
  if (g === 2) {
    const w = 5;
    const h = 5;
    const pathable = makeRect(w, h);
    // 十型の直交マス (2,2) を含む（横通過・縦通過がどちらも直進）
    const path: CellCoord[] = [
      { c: 1, r: 4 },
      { c: 2, r: 4 },
      { c: 3, r: 4 },
      { c: 4, r: 4 },
      { c: 4, r: 3 },
      { c: 4, r: 2 },
      { c: 3, r: 2 },
      { c: 2, r: 2 },
      { c: 1, r: 2 },
      { c: 0, r: 2 },
      { c: 0, r: 1 },
      { c: 0, r: 0 },
      { c: 1, r: 0 },
      { c: 2, r: 0 },
      { c: 2, r: 1 },
      { c: 2, r: 2 },
      { c: 2, r: 3 },
      { c: 3, r: 3 },
      { c: 3, r: 2 },
      { c: 3, r: 1 },
      { c: 3, r: 0 },
    ];
    const bends = countRightAngles(path);
    const rng = createStageRng(seed);
    const picked = pickGrade2OrientedStage(pathable, path, w, h, bends, rng);
    if (!picked) {
      throw new Error("fallbackGridStage(2): pickGrade2OrientedStage failed");
    }
    const dup = new Map<string, BumperCell>();
    picked.bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
    shuffleWrongDisplay(dup, rng);
    return {
      width: picked.width,
      height: picked.height,
      pathable: picked.pathable,
      start: picked.start,
      goal: picked.goal,
      startPad: picked.startPad,
      goalPad: picked.goalPad,
      bumpers: dup,
      solutionPath: picked.solutionPath,
      grade,
      seed,
    };
  }
  if (g === 3) {
    for (let t = 0; t < 80; t++) {
      const st = generateGrade3Stage((seed + t * 130051) >>> 0);
      if (st) return { ...st, grade: g, seed };
    }
    throw new Error("fallbackGridStage(3): generateGrade3Stage failed");
  }

  const { w, h } = boardSizeForGrade(grade);
  const pathable = makeRect(w, h);
  const mid = Math.floor(w / 2);
  const start = { c: mid, r: h - 1 };
  const goal = { c: mid, r: 0 };
  const path: CellCoord[] = [];
  for (let r = h - 1; r >= 0; r--) path.push({ c: mid, r });
  const bumperR = Math.min(h - 2, Math.max(1, Math.floor(h / 2)));
  const bumperCell = { c: mid, r: bumperR };
  const dIn = unitStepDir(0, -1)!;
  const dOut = unitStepDir(0, -1)!;
  const sol = bumperKindForTurn(dIn, dOut) ?? "PIPE";
  const bumpers = new Map<string, BumperCell>();
  bumpers.set(keyCell(bumperCell.c, bumperCell.r), { display: "HYPHEN", solution: sol });
  return {
    width: w,
    height: h,
    pathable,
    start,
    goal,
    startPad: { c: start.c, r: start.r + 1 },
    goalPad: { c: goal.c, r: goal.r - 1 },
    bumpers,
    solutionPath: path,
    grade,
    seed,
  };
}

export function generateGridStageWithFallback(grade: number, seed: number): GridStage {
  return generateGridStage(grade, seed) ?? fallbackGridStage(grade, seed);
}
