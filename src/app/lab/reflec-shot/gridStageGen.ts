import { applyBumper, bumperKindForTurn, diagonalBumperForTurn } from "./bumperRules";
import {
  addCell,
  dirsEqual,
  gridDeltaToScreenDir,
  keyCell,
  negateDir,
  type BumperCell,
  type CellCoord,
  type Grade2PadAdjustLabel,
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
 * Grade 3: ちょうど 1 マスが 2 回出現し、**両方とも** 90° 折れ。
 * 2 回目の入射は 1 回目の入射の逆向き、または 1 回目の反射（出射）と同じ向き。
 * 再訪マスの前後 4 隣接マスはいずれも異なる（上下左右からそれぞれ 1 本ずつ）。
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
  if (interiorPassageKind(path, i0) !== "bend") return false;
  if (interiorPassageKind(path, i1) !== "bend") return false;

  const dIn1 = unitStepDir(path[i0]!.c - path[i0 - 1]!.c, path[i0]!.r - path[i0 - 1]!.r);
  const dOut1 = unitStepDir(path[i0 + 1]!.c - path[i0]!.c, path[i0 + 1]!.r - path[i0]!.r);
  const dIn2 = unitStepDir(path[i1]!.c - path[i1 - 1]!.c, path[i1]!.r - path[i1 - 1]!.r);
  if (!dIn1 || !dOut1 || !dIn2) return false;
  const okIn2 =
    dirsEqual(dIn2, negateDir(dIn1)) ||
    dirsEqual(dIn2, dOut1);
  if (!okIn2) return false;

  const nb = (p: CellCoord) => keyCell(p.c, p.r);
  const neigh = new Set([
    nb(path[i0 - 1]!),
    nb(path[i0 + 1]!),
    nb(path[i1 - 1]!),
    nb(path[i1 + 1]!),
  ]);
  if (neigh.size !== 4) return false;
  return true;
}

/** 再訪点 R を挟む前後を折れ線で接合（合計折れ 6 = R で 2 + 途中 4） */
function tryConstructGrade3Path(
  pathable: boolean[][],
  start: CellCoord,
  goal: CellCoord,
  rng: () => number
): CellCoord[] | null {
  const w = pathable.length;
  const h = pathable[0]!.length;
  const invEnter = (R: CellCoord, dIn: Dir): CellCoord => ({
    c: R.c - dIn.dx,
    r: R.r + dIn.dy,
  });
  const step = (from: CellCoord, d: Dir): CellCoord => addCell(from, d);

  for (let tryR = 0; tryR < 40; tryR++) {
    const rc = 1 + Math.floor(rng() * Math.max(1, w - 2));
    const rr = 1 + Math.floor(rng() * Math.max(1, h - 2));
    const R = { c: rc, r: rr };
    if (!pathable[rc]![rr]) continue;

    const dirOrder = [DIR.U, DIR.D, DIR.L, DIR.R].sort(() => rng() - 0.5);
    for (const dIn1 of dirOrder) {
      const outs = [DIR.U, DIR.D, DIR.L, DIR.R].filter((d) => orthogonalDirs(dIn1, d)).sort(() => rng() - 0.5);
      for (const dOut1 of outs) {
        const sol = diagonalBumperForTurn(dIn1, dOut1);
        if (!sol) continue;
        const dIn2opts = [negateDir(dIn1), dOut1];
        for (let oi = 0; oi < dIn2opts.length; oi++) {
          const dIn2 = dIn2opts[oi]!;
          if (oi > 0 && dirsEqual(dIn2, dIn2opts[0]!)) continue;
          const dOut2 = applyBumper(dIn2, sol);
          if (!orthogonalDirs(dIn2, dOut2)) continue;

          const P1 = invEnter(R, dIn1);
          const S1 = step(R, dOut1);
          const P2 = invEnter(R, dIn2);
          const S2 = step(R, dOut2);
          const pts = [P1, S1, P2, S2];
          let okPts = true;
          for (const q of pts) {
            if (!inBounds(q.c, q.r, w, h) || !pathable[q.c]![q.r]) {
              okPts = false;
              break;
            }
          }
          if (!okPts) continue;
          const nset = new Set(pts.map((q) => keyCell(q.c, q.r)));
          if (nset.size !== 4) continue;

          const splits: [number, number, number][] = [];
          for (let a = 0; a <= 4; a++) {
            for (let b = 0; b <= 4 - a; b++) {
              splits.push([a, b, 4 - a - b]);
            }
          }
          for (let si = splits.length - 1; si > 0; si--) {
            const j = Math.floor(rng() * (si + 1));
            const tmp = splits[si]!;
            splits[si] = splits[j]!;
            splits[j] = tmp;
          }

          for (let t = 0; t < 8; t++) {
            const firstH = rng() < 0.5;
            for (const [b0, b1, b2] of splits) {
              const seg0 = tryOrthogonalPolyline(start, P1, b0, firstH, pathable, rng);
              if (!seg0) continue;
              const seg1 = tryOrthogonalPolyline(S1, P2, b1, rng() < 0.5, pathable, rng);
              if (!seg1) continue;
              const seg2 = tryOrthogonalPolyline(S2, goal, b2, rng() < 0.5, pathable, rng);
              if (!seg2) continue;

              const path = [...seg0, R, ...seg1, R, ...seg2];
              if (countRightAngles(path) !== 6) continue;
              if (!grade3RevisitOneCellRule(path)) continue;
              return path;
            }
          }
        }
      }
    }
  }
  return null;
}

function findGrade3SixBendPath(
  pathable: boolean[][],
  start: CellCoord,
  goal: CellCoord,
  rng: () => number
): CellCoord[] | null {
  return tryConstructGrade3Path(pathable, start, goal, rng);
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

/** 経路＋ Grade2 パッド幾何に対する斜めバンパー本数（内角＋入口／出口の直交折れ） */
export function totalDiagonalTurnCount(path: CellCoord[], startPad: CellCoord, goalPad: CellCoord): number {
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
    const k = keyCell(cur.c, cur.r);
    const existing = bumpers.get(k);
    if (existing && existing.solution !== sol) return { bumpers, ok: false };
    bumpers.set(k, { display: sol, solution: sol });
  }
  const uniqBendCells = bendCellsInPath(path).size;
  const ok = bumpers.size === uniqBendCells && uniqBendCells > 0;
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
  grade2PadAdjustLabel?: Grade2PadAdjustLabel;
};

function pathVisitCount(path: CellCoord[], c: number, r: number): number {
  const k = keyCell(c, r);
  let n = 0;
  for (const p of path) {
    if (keyCell(p.c, p.r) === k) n++;
  }
  return n;
}

function bendVertexIndices(path: CellCoord[]): number[] {
  const idx: number[] = [];
  for (let i = 1; i < path.length - 1; i++) {
    const d0 = unitStepDir(path[i]!.c - path[i - 1]!.c, path[i]!.r - path[i - 1]!.r);
    const d1 = unitStepDir(path[i + 1]!.c - path[i]!.c, path[i + 1]!.r - path[i]!.r);
    if (d0 && d1 && orthogonalDirs(d0, d1)) idx.push(i);
  }
  return idx;
}

/** 水平軸 r = pivotR による縦鏡映（経路上の [lo,hi]） */
function flipSubpathVerticalR(path: CellCoord[], lo: number, hi: number, pivotR: number): CellCoord[] {
  const out = path.map((q) => ({ ...q }));
  for (let j = lo; j <= hi; j++) {
    out[j] = { c: path[j]!.c, r: 2 * pivotR - path[j]!.r };
  }
  return out;
}

/** サブ経路の縦鏡映で試すピボット候補（最後の折れ点行と端点行が同じだとゴールが動かない問題の緩和） */
function grade2VerticalFlipPivotCandidates(bendR: number, endR: number): number[] {
  const s = new Set<number>();
  const add = (v: number) => {
    if (Number.isFinite(v)) s.add(Math.trunc(v));
  };
  add(bendR);
  add(Math.floor(endR / 2));
  add(Math.ceil(endR / 2));
  add((bendR + endR) >> 1);
  add((bendR + endR + 1) >> 1);
  const lo = Math.min(bendR, endR);
  const hi = Math.max(bendR, endR);
  for (let t = lo; t <= hi; t++) add(t);
  return Array.from(s.values()).sort((a, b) => a - b);
}

/** Grade2: goalPad が画面上で goal の真上（グリッドで r が小さい隣接・盤外含む） */
function grade2GoalPadIsGridAboveGoal(goal: CellCoord, prevOnPath: CellCoord): boolean {
  return goal.r < prevOnPath.r;
}

function pathOrthStepValid(path: CellCoord[], pathable: boolean[][], w: number, h: number): boolean {
  for (const cell of path) {
    if (!inBounds(cell.c, cell.r, w, h) || !pathable[cell.c]![cell.r]) return false;
  }
  for (let i = 1; i < path.length; i++) {
    if (!unitStepDir(path[i]!.c - path[i - 1]!.c, path[i]!.r - path[i - 1]!.r)) return false;
  }
  return true;
}

function validateGrade2RotatedPorts(p: CellCoord[], w: number, h: number): boolean {
  const fs = pathFirstStepDir(p);
  if (!fs || !dirsEqual(fs, DIR.U)) return false;
  const start = p[0]!;
  const goal = p[p.length - 1]!;
  const startPad = { c: start.c, r: start.r + 1 };
  const prev = p[p.length - 2]!;
  const dLast = unitDirBetween(prev, goal);
  if (!dLast) return false;
  const goalPad = { c: goal.c + dLast.dx, r: goal.r + dLast.dy };
  if (!isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) return false;
  const dEntry = unitOrthoDirBetween(startPad, start);
  if (!dEntry || !dirsEqual(dEntry, DIR.U)) return false;
  return true;
}

type Grade2PadNormResult =
  | { kind: "ok"; path: CellCoord[]; label?: Grade2PadAdjustLabel; swapSlashKey?: string }
  | { kind: "retry" };

/**
 * startPad→start と goalPad→goal が反対向きだが、端が最下段／最上段に無い場合の経路上下反転と斜めバンパー入替候補。
 */
function normalizeGrade2OppositePadPolyline(
  p: CellCoord[],
  pathable: boolean[][],
  w: number,
  h: number
): Grade2PadNormResult {
  const start = p[0]!;
  const goal = p[p.length - 1]!;
  const startPad = { c: start.c, r: start.r + 1 };
  const prev = p[p.length - 2]!;
  const dLast = unitDirBetween(prev, goal);
  if (!dLast) return { kind: "ok", path: p };
  const goalPad = { c: goal.c + dLast.dx, r: goal.r + dLast.dy };
  const dStart = unitOrthoDirBetween(startPad, start);
  const dGoal = unitOrthoDirBetween(goalPad, goal);
  if (!dStart || !dGoal) return { kind: "ok", path: p };

  const padsOpposite = dirsEqual(dStart, negateDir(dGoal));
  const canonicalEnds = start.r === h - 1 && goal.r === 0;
  if (!padsOpposite || canonicalEnds) return { kind: "ok", path: p };

  const bends = bendVertexIndices(p);
  if (!bends.length) return { kind: "retry" };
  const pIdx = bends[bends.length - 1]!;
  const qIdx = bends[0]!;
  const pCell = p[pIdx]!;
  const qCell = p[qIdx]!;
  const revisitP = pathVisitCount(p, pCell.c, pCell.r) >= 2;

  if (!revisitP) {
    for (const pivotR of grade2VerticalFlipPivotCandidates(pCell.r, goal.r)) {
      const p2 = flipSubpathVerticalR(p, pIdx, p.length - 1, pivotR);
      if (!pathOrthStepValid(p2, pathable, w, h) || !validateGrade2RotatedPorts(p2, w, h)) {
        continue;
      }
      const gN = p2[p2.length - 1]!;
      const prevN = p2[p2.length - 2]!;
      if (!grade2GoalPadIsGridAboveGoal(gN, prevN)) continue;
      const k = keyCell(p2[pIdx]!.c, p2[pIdx]!.r);
      return { kind: "ok", path: p2, label: "goal->upside down", swapSlashKey: k };
    }
    return { kind: "retry" };
  }

  const revisitQ = pathVisitCount(p, qCell.c, qCell.r) >= 2;
  if (revisitQ) return { kind: "retry" };

  const startR = start.r;
  for (const pivotR of grade2VerticalFlipPivotCandidates(qCell.r, startR)) {
    const p2 = flipSubpathVerticalR(p, 0, qIdx, pivotR);
    if (!pathOrthStepValid(p2, pathable, w, h)) continue;
    const p3 = p2.slice().reverse();
    if (!pathOrthStepValid(p3, pathable, w, h) || !validateGrade2RotatedPorts(p3, w, h)) {
      continue;
    }
    const gN = p3[p3.length - 1]!;
    const prevN = p3[p3.length - 2]!;
    if (!grade2GoalPadIsGridAboveGoal(gN, prevN)) continue;
    const k = keyCell(p3[p3.length - 1 - qIdx]!.c, p3[p3.length - 1 - qIdx]!.r);
    return { kind: "ok", path: p3, label: "start->upside down", swapSlashKey: k };
  }
  return { kind: "retry" };
}

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

    const norm = normalizeGrade2OppositePadPolyline(p, pb, w, h);
    if (norm.kind === "retry") continue;
    p = norm.path;
    const padAdjustLabel = norm.label;
    const swapSlashKey = norm.swapSlashKey;

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
    const needBumpers = opts?.relaxBendVisit ? bendSet.size : bends;
    if (!ok || bumpers.size !== needBumpers) continue;

    const bumpDup = new Map(bumpers);
    if (swapSlashKey) {
      const cell = bumpDup.get(swapSlashKey);
      if (cell && (cell.solution === "SLASH" || cell.solution === "BACKSLASH")) {
        const sol = wrongDiagonal(cell.solution);
        bumpDup.set(swapSlashKey, { display: sol, solution: sol });
      }
    }

    winners.push({
      width: w,
      height: h,
      pathable: pb,
      start,
      goal,
      startPad,
      goalPad,
      solutionPath: p,
      bumpers: bumpDup,
      grade2PadAdjustLabel: padAdjustLabel,
    });
  }
  if (!winners.length) return null;
  return winners[Math.floor(rng() * winners.length)]!;
}

/** @internal 開発用 */
export function debugTryGrade2Bend6PathOnce(seed: number): {
  path: CellCoord[] | null;
  bends: number;
  bumpers: number;
  expectedBumpers: number;
} {
  const rng = createStageRng(seed >>> 0);
  const { w: W, h: H } = boardSizeForGrade(2);
  const pathable = makeRect(W, H);
  const start = { c: 2, r: 4 };
  const goal = { c: 2, r: 0 };
  if (!pathable[start.c]![start.r] || !pathable[goal.c]![goal.r])
    return { path: null, bends: -1, bumpers: -1, expectedBumpers: -1 };
  const path = tryGrade2Bend6Path(pathable, W, H, start, goal, rng);
  if (!path) return { path: null, bends: -1, bumpers: -1, expectedBumpers: -1 };
  const st = path[0]!;
  const gl = path[path.length - 1]!;
  const startPad = { c: st.c, r: st.r + 1 };
  const prev = path[path.length - 2]!;
  const dL = unitDirBetween(prev, gl);
  if (!dL) return { path, bends: countRightAngles(path), bumpers: -1, expectedBumpers: -1 };
  const goalPad = { c: gl.c + dL.dx, r: gl.r + dL.dy };
  const exp = totalDiagonalTurnCount(path, startPad, goalPad);
  const b = placeGrade2Bend6Bumpers(path, W, H);
  return {
    path,
    bends: countRightAngles(path),
    bumpers: b?.size ?? -1,
    expectedBumpers: exp,
  };
}

/** Grade2・折れ6（高速化）: フック＋DFS 尾で経路を生成 */
function tryGrade2Bend6Path(
  pathable: boolean[][],
  w: number,
  h: number,
  start: CellCoord,
  goal: CellCoord,
  rng: () => number
): CellCoord[] | null {
  const pickSignedMag = (maxMag: number): number => {
    const m = Math.max(1, Math.min(maxMag, 4));
    const mag = 1 + Math.floor(rng() * m);
    return rng() < 0.5 ? mag : -mag;
  };

  const dfsTail = (
    cur: CellCoord,
    prev: CellCoord,
    bendsLeft: number,
    visited: Set<string>,
    stack: CellCoord[]
  ): boolean => {
    stack.push(cur);
    visited.add(keyCell(cur.c, cur.r));
    if (cur.c === goal.c && cur.r === goal.r) {
      if (bendsLeft === 0) return true;
      stack.pop();
      visited.delete(keyCell(cur.c, cur.r));
      return false;
    }
    const dPrev = unitStepDir(cur.c - prev.c, cur.r - prev.r);
    if (!dPrev) {
      stack.pop();
      visited.delete(keyCell(cur.c, cur.r));
      return false;
    }

    const opts: Dir[] = [DIR.U, DIR.D, DIR.L, DIR.R];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [opts[i], opts[j]] = [opts[j]!, opts[i]!];
    }

    for (const d of opts) {
      const next = addCell(cur, d);
      if (next.c === prev.c && next.r === prev.r) continue;
      if (!inBounds(next.c, next.r, w, h) || !pathable[next.c]![next.r]) continue;
      const nk = keyCell(next.c, next.r);
      if (visited.has(nk)) continue;
      let newBL = bendsLeft;
      if (!dirsEqual(dPrev, d)) {
        if (!orthogonalDirs(dPrev, d)) continue;
        newBL -= 1;
      }
      if (newBL < 0) continue;
      const mh = Math.abs(next.c - goal.c) + Math.abs(next.r - goal.r);
      if (newBL > mh + 4) {
        continue;
      }
      if (dfsTail(next, cur, newBL, visited, stack)) return true;
    }
    stack.pop();
    visited.delete(keyCell(cur.c, cur.r));
    return false;
  };

  for (let attempt = 0; attempt < 48; attempt++) {
    const variantA = rng() < 0.5;
    const maxHorizA = Math.max(start.c, w - 1 - start.c) || 1;
    const maxHorizB = Math.max(goal.c, w - 1 - goal.c) || 1;
    const ds = variantA ? pickSignedMag(maxHorizA) : pickSignedMag(maxHorizB);

    if (variantA) {
      const S1 = { c: start.c + ds, r: start.r };
      if (!inBounds(S1.c, S1.r, w, h) || !pathable[S1.c]![S1.r]) continue;
      if (S1.c === start.c && S1.r === start.r) continue;
      const S2 = { c: S1.c, r: S1.r - 1 };
      if (!inBounds(S2.c, S2.r, w, h) || !pathable[S2.c]![S2.r]) continue;

      const visited = new Set<string>([keyCell(start.c, start.r), keyCell(S1.c, S1.r)]);
      const stack: CellCoord[] = [start, S1];
      if (!dfsTail(S2, S1, 5, visited, stack)) continue;
      const full = stack;
      if (!grade1NoRevisit(full)) continue;
      if (countRightAngles(full) !== 6) continue;
      return full;
    }

    const G1 = { c: goal.c + ds, r: goal.r };
    if (!inBounds(G1.c, G1.r, w, h) || !pathable[G1.c]![G1.r]) continue;
    if (G1.c === goal.c && G1.r === goal.r) continue;
    const G2 = { c: G1.c, r: G1.r + 1 };
    if (!inBounds(G2.c, G2.r, w, h) || !pathable[G2.c]![G2.r]) continue;

    const visited = new Set<string>([keyCell(goal.c, goal.r), keyCell(G1.c, G1.r)]);
    const hookStack: CellCoord[] = [goal, G1];
    if (!dfsTail(G2, G1, 5, visited, hookStack)) continue;
    const mid = hookStack;
    if (mid[mid.length - 1]!.c !== start.c || mid[mid.length - 1]!.r !== start.r) continue;
    const full = mid.slice().reverse();
    if (!grade1NoRevisit(full)) continue;
    if (countRightAngles(full) !== 6) continue;
    return full;
  }
  return null;
}

/**
 * 折れ 6：**Grade 2・折れ 4 とは異なり** `start` / `goal` にも斜めバンパーを置いてよい。
 * `placeDiagonalBumpers`（`startPad→start`・`goalPad→goal` の直交折れを含む）で一括配置し、
 * 本数は `totalDiagonalTurnCount(path, startPad, goalPad)` と一致する。
 */
function placeGrade2Bend6Bumpers(path: CellCoord[], _w: number, _h: number): Map<string, BumperCell> | null {
  if (countRightAngles(path) !== 6) return null;
  const start = path[0]!;
  const goal = path[path.length - 1]!;
  const startPad = { c: start.c, r: start.r + 1 };
  const prev = path[path.length - 2]!;
  const dLast = unitDirBetween(prev, goal);
  if (!dLast) return null;
  const goalPad = { c: goal.c + dLast.dx, r: goal.r + dLast.dy };
  const { bumpers, ok } = placeDiagonalBumpers(path, startPad, goalPad);
  if (!ok) return null;
  return bumpers;
}

function rotateBumperMapQuarterCCW(
  bumpers: Map<string, BumperCell>,
  w: number,
  h: number
): Map<string, BumperCell> {
  const out = new Map<string, BumperCell>();
  bumpers.forEach((cell, k) => {
    const { c, r } = ((): CellCoord => {
      const [a, b] = k.split(",").map(Number);
      return { c: a!, r: b! };
    })();
    const nc = r;
    const nr = w - 1 - c;
    out.set(keyCell(nc, nr), { display: cell.display, solution: cell.solution });
  });
  return out;
}

/** プリバンプ経路を 90° と `normalizeGrade2OppositePadPolyline` で向き調整（折れ6専用） */
function pickGrade2Bend6OrientedStage(
  pathable: boolean[][],
  path: CellCoord[],
  w0: number,
  h0: number,
  rng: () => number
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
    if (!fs) continue;

    const norm = normalizeGrade2OppositePadPolyline(p, pb, w, h);
    if (norm.kind === "retry") continue;
    p = norm.path;
    const padAdjustLabel = norm.label;
    const swapSlashKey = norm.swapSlashKey;

    let bumpers = placeGrade2Bend6Bumpers(p, w, h);
    if (!bumpers) continue;

    if (swapSlashKey) {
      const c = bumpers.get(swapSlashKey);
      if (c && (c.solution === "SLASH" || c.solution === "BACKSLASH")) {
        const sol = wrongDiagonal(c.solution);
        bumpers.set(swapSlashKey, { display: sol, solution: sol });
      }
    }

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
    if (!grade2BendNoRevisit(p, bendSet)) continue;

    const expectedBumpers = totalDiagonalTurnCount(p, startPad, goalPad);
    if (bumpers.size !== expectedBumpers) continue;

    const bumpDup = new Map(bumpers);
    winners.push({
      width: w,
      height: h,
      pathable: pb,
      start,
      goal,
      startPad,
      goalPad,
      solutionPath: p,
      bumpers: bumpDup,
      grade2PadAdjustLabel: padAdjustLabel,
    });
  }
  if (!winners.length) return null;
  return winners[Math.floor(rng() * winners.length)]!;
}

/** 開発用: Grade2 で折れ数を固定した単発試行の棄却理由を集計する */
export type Grade2ForcedBendDiag = {
  trials: number;
  successes: number;
  /** 1 試行あたり最終的な結果（ok / polyline_exhausted など） */
  trialOutcome: Record<string, number>;
  /** `pickGrade2OrientedStage` 相当の各回転で、最初に落ちたチェック（試行内で複数回転を評価） */
  rotationFail: Record<string, number>;
};

export function diagnoseGrade2ForcedBendAttempts(
  trials: number,
  seedBase: number,
  bends: 4 | 6
): Grade2ForcedBendDiag {
  const trialOutcome: Record<string, number> = {};
  const rotationFail: Record<string, number> = {};
  const inc = (m: Record<string, number>, k: string) => {
    m[k] = (m[k] ?? 0) + 1;
  };

  let successes = 0;
  const { w: W, h: H } = boardSizeForGrade(2);

  for (let t = 0; t < trials; t++) {
    const rng = createStageRng((seedBase + t * 0x9e3779b9) >>> 0);
    const pathable = makeRect(W, H);
    const bottoms = bottomCandidates(pathable);
    const tops = topCandidates(pathable);
    if (!bottoms.length || !tops.length) {
      inc(trialOutcome, "no_bottom_or_top");
      continue;
    }
    const start = bottoms[Math.floor(rng() * bottoms.length)]!;
    const goal = tops[Math.floor(rng() * tops.length)]!;
    const dc = goal.c - start.c;
    const dr = goal.r - start.r;
    if (bends === 4 && (dc === 0 || dr === 0)) {
      inc(trialOutcome, "g2_collinear_endpoints");
      continue;
    }

    let path: CellCoord[] | null = null;
    const polyTries = bends === 4 ? 40 : 24;
    for (let pt = 0; pt < polyTries; pt++) {
      const firstH = bends === 4 && pt < 2 ? pt % 2 === 0 : rng() < 0.5;
      path = tryOrthogonalPolyline(start, goal, bends, firstH, pathable, rng);
      if (path) break;
    }
    if (!path) {
      inc(trialOutcome, "polyline_exhausted");
      continue;
    }

    if (countRightAngles(path) !== bends) {
      inc(trialOutcome, "bend_count_mismatch");
      continue;
    }

    if (bends === 6) {
      if (!grade1NoRevisit(path)) {
        inc(trialOutcome, "path_cell_revisit");
        continue;
      }
    } else {
      if (!pathHasOrthogonalCrossCell(path)) {
        inc(trialOutcome, "no_orth_cross");
        continue;
      }
    }

    let anyWinner = false;
    for (let k = 0; k < 4; k++) {
      let p = path.map((x) => ({ ...x }));
      let pb = pathable.map((col) => [...col!]);
      let w = W;
      let h = H;
      for (let i = 0; i < k; i++) {
        const nx = applyQuarterCCWPathable(pb, p, w, h);
        p = nx.path;
        pb = nx.pathable;
        w = nx.w;
        h = nx.h;
      }
      const fs = pathFirstStepDir(p);
      if (!fs) {
        inc(rotationFail, "rot_first_step_undef");
        continue;
      }
      if (bends === 4 && !dirsEqual(fs, DIR.U)) {
        inc(rotationFail, "rot_first_step_not_u");
        continue;
      }
      const norm = normalizeGrade2OppositePadPolyline(p, pb, w, h);
      if (norm.kind === "retry") {
        inc(rotationFail, "norm_retry");
        continue;
      }
      p = norm.path;
      const startP = p[0]!;
      const goalP = p[p.length - 1]!;
      const startPad = { c: startP.c, r: startP.r + 1 };
      const prev = p[p.length - 2]!;
      const dLast = unitDirBetween(prev, goalP);
      if (!dLast) {
        inc(rotationFail, "goal_prev_not_axis_adjacent");
        continue;
      }
      const goalPad = { c: goalP.c + dLast.dx, r: goalP.r + dLast.dy };
      if (!isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) {
        inc(rotationFail, "goalpad_not_strictly_outside");
        continue;
      }
      const dEntry = unitOrthoDirBetween(startPad, startP);
      if (!dEntry || !dirsEqual(dEntry, DIR.U)) {
        inc(rotationFail, "startpad_entry_not_u");
        continue;
      }
      const bendSet = bendCellsInPath(p);
      if (!grade2BendNoRevisit(p, bendSet)) {
        inc(rotationFail, "bend_vertex_revisit_path");
        continue;
      }
      if (bends === 6) {
        const bump6 = placeGrade2Bend6Bumpers(p, w, h);
        const expB = totalDiagonalTurnCount(p, startPad, goalPad);
        if (!bump6 || bump6.size !== expB) {
          inc(rotationFail, "bend6_bumper_mismatch");
          continue;
        }
      } else {
        const { bumpers, ok } = placeDiagonalBumpersInterior(p);
        if (!ok || bumpers.size !== bends) {
          inc(rotationFail, "interior_bumper_mismatch");
          continue;
        }
      }
      anyWinner = true;
      break;
    }

    if (!anyWinner) {
      inc(trialOutcome, "pick_no_valid_rotation");
    } else {
      successes++;
      inc(trialOutcome, "ok");
    }
  }

  return { trials, successes, trialOutcome, rotationFail };
}

/** `generatePolylineStage(2)` と同型の外側ループで折れ 6 固定したときの棄却分布（1 シード分） */
export type Grade2Bend6SessionDiag = {
  seed: number;
  ok: boolean;
  outerAttemptsUsed: number;
  outerBucket: Record<string, number>;
  rotationFail: Record<string, number>;
};

export function diagnoseGrade2Bend6Session(seed: number, maxAttempts = 1200): Grade2Bend6SessionDiag {
  const rng = createStageRng(seed);
  const { w: W, h: H } = boardSizeForGrade(2);
  const outerBucket: Record<string, number> = {};
  const rotationFail: Record<string, number> = {};
  const inc = (m: Record<string, number>, k: string) => {
    m[k] = (m[k] ?? 0) + 1;
  };

  let attempt = 0;
  for (; attempt < maxAttempts; attempt++) {
    const pathable = makeRect(W, H);
    const bottoms = bottomCandidates(pathable);
    const tops = topCandidates(pathable);
    if (!bottoms.length || !tops.length) {
      inc(outerBucket, "no_bottom_or_top");
      return { seed, ok: false, outerAttemptsUsed: attempt + 1, outerBucket, rotationFail };
    }
    const start = bottoms[Math.floor(rng() * bottoms.length)]!;
    const goal = tops[Math.floor(rng() * tops.length)]!;
    const bends = 6;

    const path = tryGrade2Bend6Path(pathable, W, H, start, goal, rng);
    if (!path) {
      inc(outerBucket, "bend6_path_null");
      continue;
    }

    if (countRightAngles(path) !== bends) {
      inc(outerBucket, "bend_count_mismatch");
      continue;
    }
    if (!grade1NoRevisit(path)) {
      inc(outerBucket, "path_cell_revisit");
      continue;
    }

    const picked = pickGrade2Bend6OrientedStage(pathable, path, W, H, rng);
    if (!picked) {
      inc(outerBucket, "pick_grade2_oriented_null");
      for (let k = 0; k < 4; k++) {
        let p = path.map((x) => ({ ...x }));
        let pb = pathable.map((col) => [...col!]);
        let w = W;
        let h = H;
        for (let i = 0; i < k; i++) {
          const nx = applyQuarterCCWPathable(pb, p, w, h);
          p = nx.path;
          pb = nx.pathable;
          w = nx.w;
          h = nx.h;
        }
        const fs = pathFirstStepDir(p);
        if (!fs) {
          inc(rotationFail, "rot_first_step_undef");
          continue;
        }
        const norm = normalizeGrade2OppositePadPolyline(p, pb, w, h);
        if (norm.kind === "retry") {
          inc(rotationFail, "norm_retry");
          continue;
        }
        p = norm.path;
        const startP = p[0]!;
        const goalP = p[p.length - 1]!;
        const startPad = { c: startP.c, r: startP.r + 1 };
        const prev = p[p.length - 2]!;
        const dLast = unitDirBetween(prev, goalP);
        if (!dLast) {
          inc(rotationFail, "goal_prev_not_axis_adjacent");
          continue;
        }
        const goalPad = { c: goalP.c + dLast.dx, r: goalP.r + dLast.dy };
        if (!isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) {
          inc(rotationFail, "goalpad_not_strictly_outside");
          continue;
        }
        const dEntry = unitOrthoDirBetween(startPad, startP);
        if (!dEntry || !dirsEqual(dEntry, DIR.U)) {
          inc(rotationFail, "startpad_entry_not_u");
          continue;
        }
        const bendSet = bendCellsInPath(p);
        if (!grade2BendNoRevisit(p, bendSet)) {
          inc(rotationFail, "bend_vertex_revisit_path");
          continue;
        }
        const bump6 = placeGrade2Bend6Bumpers(p, w, h);
        const expBump = totalDiagonalTurnCount(p, startPad, goalPad);
        if (!bump6 || bump6.size !== expBump) {
          inc(rotationFail, "bend6_bumper_mismatch");
          continue;
        }
      }
      continue;
    }

    return {
      seed,
      ok: true,
      outerAttemptsUsed: attempt + 1,
      outerBucket,
      rotationFail,
    };
  }

  return { seed, ok: false, outerAttemptsUsed: maxAttempts, outerBucket, rotationFail };
}

/** Grade 3: 折れ 6・1 マス再訪（両回折れ・入射は逆または1回目反射と同一）→ Grade 2 と同型の向き調整 */
function generateGrade3Stage(seed: number): GridStage | null {
  const rng = createStageRng(seed);
  const { w: W, h: H } = boardSizeForGrade(3);
  const pathable = makeRect(W, H);
  const maxAttempts = 160;
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
    if (grade === 2 && bends === 6) {
      path = tryGrade2Bend6Path(pathable, W, H, start, goal, rng);
      if (!path) continue;
    } else {
      const polyTries = grade === 2 && bends === 4 ? 40 : 24;
      for (let t = 0; t < polyTries; t++) {
        const firstH = grade === 2 && bends === 4 && t < 2 ? t % 2 === 0 : rng() < 0.5;
        path = tryOrthogonalPolyline(start, goal, bends, firstH, pathable, rng);
        if (path) break;
      }
      if (!path) continue;
    }

    if (countRightAngles(path) !== bends) continue;

    if (grade === 2) {
      if (bends === 6) {
        if (!grade1NoRevisit(path)) continue;
      } else if (!pathHasOrthogonalCrossCell(path)) {
        continue;
      }
    }

    if (grade === 2) {
      const picked =
        bends === 6
          ? pickGrade2Bend6OrientedStage(pathable, path, W, H, rng)
          : pickGrade2OrientedStage(pathable, path, W, H, bends, rng);
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
        grade2PadAdjustLabel: picked.grade2PadAdjustLabel,
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
      grade2PadAdjustLabel: picked.grade2PadAdjustLabel,
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
