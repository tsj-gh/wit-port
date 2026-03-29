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
  if (g === 1) return "Lv.1・バンパー2";
  if (g === 2) return "Lv.1・バンパー4+";
  if (g === 3) return "Lv.2・折れ4";
  if (g === 4) return "Lv.3・折れ6〜8";
  return "Lv.4・再訪1";
}

/** @deprecated 旧テンプレ盤用。新 Grade1〜5 では未使用 */
export function bumpersForGrade(grade: number): number {
  const g = Math.max(1, Math.min(5, Math.floor(grade)));
  if (g <= 2) return 0;
  if (g === 3) return 0;
  if (g === 4) return 2;
  return 3;
}

/** Grade1〜2: 4×4 / Grade3〜4: 5×5 / Grade5: 6×6 */
export function boardSizeForGrade(grade: number): { w: number; h: number } {
  const g = Math.max(1, Math.min(5, Math.floor(grade)));
  switch (g) {
    case 1:
    case 2:
      return { w: 4, h: 4 };
    case 3:
    case 4:
      return { w: 5, h: 5 };
    default:
      return { w: 6, h: 6 };
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

/** Grade2・折れ6: `goalPad` は常に `goal` の真上 1 マス（座標は `(goal.c, goal.r - 1)`。盤外になりうる） */
function grade2Bend6GoalPad(goal: CellCoord): CellCoord {
  return { c: goal.c, r: goal.r - 1 };
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

function validateGrade2RotatedPorts(
  p: CellCoord[],
  w: number,
  h: number,
  opts?: { bend6GoalPadAbove?: boolean }
): boolean {
  const fs = pathFirstStepDir(p);
  if (!fs || !dirsEqual(fs, DIR.U)) return false;
  const start = p[0]!;
  const goal = p[p.length - 1]!;
  const startPad = { c: start.c, r: start.r + 1 };
  const goalPad = opts?.bend6GoalPadAbove
    ? { c: goal.c, r: goal.r - 1 }
    : (() => {
        const prev = p[p.length - 2]!;
        const dLast = unitDirBetween(prev, goal);
        if (!dLast) return null;
        return { c: goal.c + dLast.dx, r: goal.r + dLast.dy };
      })();
  if (!goalPad || !isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) return false;
  const dEntry = unitOrthoDirBetween(startPad, start);
  if (!dEntry || !dirsEqual(dEntry, DIR.U)) return false;
  return true;
}

type Grade2PadNormResult =
  | { kind: "ok"; path: CellCoord[]; label?: Grade2PadAdjustLabel }
  | { kind: "retry" };

/**
 * startPad→start と goalPad→goal が反対向きだが、端が最下段／最上段に無い場合の経路上下反転（鏡映）。
 * 斜めバンパーは反転後の経路に対する `placeDiagonalBumpers*` のみで決め、`solution` は常に `applyBumper` と整合する。
 */
function normalizeGrade2OppositePadPolyline(
  p: CellCoord[],
  pathable: boolean[][],
  w: number,
  h: number,
  opts?: { grade2Bend6FixedGoalPad?: boolean }
): Grade2PadNormResult {
  const start = p[0]!;
  const goal = p[p.length - 1]!;
  const startPad = { c: start.c, r: start.r + 1 };
  const goalPad = opts?.grade2Bend6FixedGoalPad
    ? { c: goal.c, r: goal.r - 1 }
    : (() => {
        const prev = p[p.length - 2]!;
        const dLast = unitDirBetween(prev, goal);
        if (!dLast) return null;
        return { c: goal.c + dLast.dx, r: goal.r + dLast.dy };
      })();
  if (!goalPad) return { kind: "ok", path: p };
  if (
    opts?.grade2Bend6FixedGoalPad &&
    !isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)
  ) {
    return { kind: "ok", path: p };
  }
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
      if (
        !pathOrthStepValid(p2, pathable, w, h) ||
        !validateGrade2RotatedPorts(p2, w, h, { bend6GoalPadAbove: !!opts?.grade2Bend6FixedGoalPad })
      ) {
        continue;
      }
      const gN = p2[p2.length - 1]!;
      const prevN = p2[p2.length - 2]!;
      const padAboveOk = opts?.grade2Bend6FixedGoalPad
        ? isStrictlyOutsideBoard(gN.c, gN.r - 1, w, h)
        : grade2GoalPadIsGridAboveGoal(gN, prevN);
      if (!padAboveOk) continue;
      return { kind: "ok", path: p2, label: "goal->upside down" };
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
    if (
      !pathOrthStepValid(p3, pathable, w, h) ||
      !validateGrade2RotatedPorts(p3, w, h, { bend6GoalPadAbove: !!opts?.grade2Bend6FixedGoalPad })
    ) {
      continue;
    }
    const gN = p3[p3.length - 1]!;
    const prevN = p3[p3.length - 2]!;
    const padAboveOk3 = opts?.grade2Bend6FixedGoalPad
      ? isStrictlyOutsideBoard(gN.c, gN.r - 1, w, h)
      : grade2GoalPadIsGridAboveGoal(gN, prevN);
    if (!padAboveOk3) continue;
    return { kind: "ok", path: p3, label: "start->upside down" };
  }
  return { kind: "retry" };
}

type GoalUpsideDownStartExt =
  | { kind: "unchanged" }
  | { kind: "extended"; path: CellCoord[]; start: CellCoord; startPad: CellCoord }
  | { kind: "discard"; reason: string };

/**
 * `goal->upside down` のとき、経路の最深行 B（画面上最も下）に合わせて start / startPad を r 方向に延長する。
 * 仕様: `docs/REFLEC_SHOT_SPECIFICATION.md`（`goal->upside down` 時の start 延長）
 */
function maybeExtendStartForGoalUpsideDown(
  path0: CellCoord[],
  start: CellCoord,
  startPad: CellCoord,
  label: Grade2PadAdjustLabel | undefined,
  pathable: boolean[][],
  w: number,
  h: number,
  debugLog?: boolean
): GoalUpsideDownStartExt {
  if (label !== "goal->upside down" || path0.length < 2) return { kind: "unchanged" };

  let B = path0[0]!;
  let maxR = B.r;
  for (const p of path0) {
    if (p.r > maxR) {
      maxR = p.r;
      B = p;
    }
  }

  const S0 = { ...start };
  const y_b = B.r - S0.r;
  if (y_b <= 0) return { kind: "unchanged" };

  const newStart = { c: S0.c, r: S0.r + y_b };
  const newStartPad = { c: startPad.c, r: startPad.r + y_b };

  if (!inBounds(newStart.c, newStart.r, w, h) || !pathable[newStart.c]![newStart.r]) {
    if (debugLog) {
      console.warn(
        "[ReflecShot] goal->upside down start extend: 破棄 extended start が盤外／非 pathable",
        { newStart, S0, y_b }
      );
    }
    return { kind: "discard", reason: "extended_start_not_pathable" };
  }

  const pathKeys = new Set(path0.map((p) => keyCell(p.c, p.r)));
  const pathS: CellCoord[] = [];
  for (let r = newStart.r; r >= S0.r; r--) {
    const cell = { c: S0.c, r };
    if (!inBounds(cell.c, cell.r, w, h) || !pathable[cell.c]![cell.r]) {
      if (debugLog) {
        console.warn("[ReflecShot] goal->upside down start extend: 破棄 Path_S が pathable でない", {
          cell,
          S0,
          y_b,
        });
      }
      return { kind: "discard", reason: "path_s_not_pathable" };
    }
    pathS.push(cell);
  }

  for (let i = 0; i < pathS.length - 1; i++) {
    const c = pathS[i]!;
    const k = keyCell(c.c, c.r);
    if (pathKeys.has(k)) {
      if (debugLog) {
        console.warn("[ReflecShot] goal->upside down start extend: 破棄 Path_S が Path_0 と再訪", {
          cell: c,
          S0,
          y_b,
        });
      }
      return { kind: "discard", reason: "path_s_revisit" };
    }
  }

  const merged = pathS.concat(path0.slice(1));
  return { kind: "extended", path: merged, start: newStart, startPad: newStartPad };
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
  const W = 5;
  const H = 5;
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
  const goalPad = grade2Bend6GoalPad(gl);
  const exp = totalDiagonalTurnCount(path, startPad, goalPad);
  const b = placeGrade2Bend6Bumpers(path, W, H);
  return {
    path,
    bends: countRightAngles(path),
    bumpers: b?.size ?? -1,
    expectedBumpers: exp,
  };
}

/** `tryGrade2Bend6Path` 成否時のフック・尾の記録（検証・デバッグ用） */
export type Grade2Bend6PathTrace = {
  outerAttempt: number;
  innerAttempt: number;
  /** true: start 側フック A / false: goal 側フック B */
  variantA: boolean;
  ds: number;
  S1?: CellCoord;
  S2?: CellCoord;
  G1?: CellCoord;
  G2?: CellCoord;
  /** A: `S2` から `goal` まで（水平フックが 1 歩区間のとき `full.slice(horiz.length)`）/ B: `mid` 上で `G2` から `start` まで（`mid.slice(horizG.length)`） */
  tailPolyline: CellCoord[];
  /** 最終折れ線の goal 直前マス */
  Q: CellCoord;
};

/**
 * 直近の Grade2・折れ6 成功生成のフック情報（折れ6で return した直後のみ）。検証用。
 */
export let lastGrade2Bend6Trace: { trace: Grade2Bend6PathTrace; rawPath: CellCoord[] } | null = null;

/** 同一行上で `a` から `b` まで直交隣接 1 歩ずつ（両端含む）。`|b.c - a.c|` が歩数。 */
function horizontalRunSameRowInclusive(a: CellCoord, b: CellCoord): CellCoord[] | null {
  if (a.r !== b.r) return null;
  if (a.c === b.c) return [{ ...a }];
  const step = Math.sign(b.c - a.c);
  const out: CellCoord[] = [];
  for (let c = a.c; ; c += step) {
    out.push({ c, r: a.r });
    if (c === b.c) break;
  }
  return out;
}

function horizontalRunPathable(
  run: CellCoord[],
  pathable: boolean[][],
  w: number,
  h: number
): boolean {
  for (const cell of run) {
    if (!inBounds(cell.c, cell.r, w, h) || !pathable[cell.c]![cell.r]) return false;
  }
  return true;
}

/** Grade2・折れ6 生成時の上書き（開発者デバッグなど） */
export type ReflectShotPolylineGenOpts = {
  /**
   * 経路全体の目標直角折れ数（内角数 `countRightAngles`）。未指定時は各内側試行で 6/7/8 を乱択。
   * 尾 DFS の折れ予算は `targetBends - countRightAngles(フック多角形)`（3 固定・4 固定ではない）。
   */
  grade2Bend6TotalBends?: 6 | 7 | 8;
  /** `true` のとき Worker 側で `goal->upside down` start 延長の棄却を `console` に出す */
  debugReflecShotConsole?: boolean;
};

/** Grade2・折れ6（高速化）: フック＋DFS 尾で経路を生成 */
export function tryGrade2Bend6Path(
  pathable: boolean[][],
  w: number,
  h: number,
  start: CellCoord,
  goal: CellCoord,
  rng: () => number,
  traceOut?: Grade2Bend6PathTrace | null,
  outerAttempt?: number,
  genOpts?: ReflectShotPolylineGenOpts
): CellCoord[] | null {
  const pickSignedMag = (maxMag: number): number => {
    const m = Math.max(1, Math.min(maxMag, 4));
    const mag = 1 + Math.floor(rng() * m);
    return rng() < 0.5 ? mag : -mag;
  };

  const dfsTail = (
    tailTarget: CellCoord,
    cur: CellCoord,
    prev: CellCoord,
    bendsLeft: number,
    visited: Set<string>,
    stack: CellCoord[]
  ): boolean => {
    stack.push(cur);
    visited.add(keyCell(cur.c, cur.r));
    if (cur.c === tailTarget.c && cur.r === tailTarget.r) {
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
      const mh = Math.abs(next.c - tailTarget.c) + Math.abs(next.r - tailTarget.r);
      if (newBL > mh + 4) {
        continue;
      }
      if (dfsTail(tailTarget, next, cur, newBL, visited, stack)) return true;
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
    const targetBends =
      genOpts?.grade2Bend6TotalBends != null
        ? Math.max(6, Math.min(8, genOpts.grade2Bend6TotalBends))
        : 6 + Math.floor(rng() * 3);

    if (variantA) {
      const S1 = { c: start.c + ds, r: start.r };
      const horiz = horizontalRunSameRowInclusive(start, S1);
      if (!horiz || !horizontalRunPathable(horiz, pathable, w, h)) continue;

      const S2 = { c: S1.c, r: S1.r - 1 };
      if (!inBounds(S2.c, S2.r, w, h) || !pathable[S2.c]![S2.r]) continue;

      const preHook: CellCoord[] = [...horiz, S2];
      const preBends = countRightAngles(preHook);
      if (preBends > targetBends) continue;
      const bendsLeft = targetBends - preBends;
      if (bendsLeft < 0) continue;

      const visited = new Set<string>(horiz.map((cell) => keyCell(cell.c, cell.r)));
      const stack: CellCoord[] = [...horiz];
      if (!dfsTail(goal, S2, S1, bendsLeft, visited, stack)) continue;
      const full = stack;
      if (!grade1NoRevisit(full)) continue;
      const cra = countRightAngles(full);
      if (cra < 6 || cra > 8) continue;
      if (traceOut) {
        const Q = full[full.length - 2]!;
        Object.assign(traceOut, {
          outerAttempt: outerAttempt ?? -1,
          innerAttempt: attempt,
          variantA: true,
          ds,
          S1: { ...S1 },
          S2: { ...S2 },
          tailPolyline: full.slice(horiz.length).map((x) => ({ ...x })),
          Q: { ...Q },
        } satisfies Grade2Bend6PathTrace);
      }
      return full;
    }

    const G1 = { c: goal.c + ds, r: goal.r };
    const horizG = horizontalRunSameRowInclusive(goal, G1);
    if (!horizG || !horizontalRunPathable(horizG, pathable, w, h)) continue;
    if (G1.c === goal.c && G1.r === goal.r) continue;
    const G2 = { c: G1.c, r: G1.r + 1 };
    if (!inBounds(G2.c, G2.r, w, h) || !pathable[G2.c]![G2.r]) continue;

    const preHookB: CellCoord[] = [...horizG, G2];
    const preBendsB = countRightAngles(preHookB);
    if (preBendsB > targetBends) continue;
    const bendsLeftB = targetBends - preBendsB;
    if (bendsLeftB < 0) continue;

    const visited = new Set<string>(horizG.map((cell) => keyCell(cell.c, cell.r)));
    const hookStack: CellCoord[] = [...horizG];
    if (!dfsTail(start, G2, G1, bendsLeftB, visited, hookStack)) continue;
    const mid = hookStack;
    if (mid[mid.length - 1]!.c !== start.c || mid[mid.length - 1]!.r !== start.r) continue;
    const full = mid.slice().reverse();
    if (!grade1NoRevisit(full)) continue;
    const crb = countRightAngles(full);
    if (crb < 6 || crb > 8) continue;
    if (traceOut) {
      const tailForward = mid.slice(horizG.length).map((x) => ({ ...x }));
      const Q = full[full.length - 2]!;
      Object.assign(traceOut, {
        outerAttempt: outerAttempt ?? -1,
        innerAttempt: attempt,
        variantA: false,
        ds,
        G1: { ...G1 },
        G2: { ...G2 },
        tailPolyline: tailForward,
        Q: { ...Q },
      } satisfies Grade2Bend6PathTrace);
    }
    return full;
  }
  return null;
}

/**
 * 折れ 6：**Grade 2・折れ 4 とは異なり** `start` / `goal` にも斜めバンパーを置いてよい。
 * `goalPad` は常に `(goal.c, goal.r - 1)`。`placeDiagonalBumpers` で一括配置し、
 * 本数は `totalDiagonalTurnCount(path, startPad, goalPad)` と一致する。
 * `countRightAngles(path)` は **6〜8** を許容する。
 */
function placeGrade2Bend6Bumpers(path: CellCoord[], w: number, h: number): Map<string, BumperCell> | null {
  const cra = countRightAngles(path);
  if (cra < 6 || cra > 8) return null;
  const start = path[0]!;
  const goal = path[path.length - 1]!;
  const startPad = { c: start.c, r: start.r + 1 };
  const goalPad = grade2Bend6GoalPad(goal);
  if (!isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) return null;
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

    const norm = normalizeGrade2OppositePadPolyline(p, pb, w, h, {
      grade2Bend6FixedGoalPad: true,
    });
    if (norm.kind === "retry") continue;
    p = norm.path;
    const padAdjustLabel = norm.label;

    const bumpers = placeGrade2Bend6Bumpers(p, w, h);
    if (!bumpers) continue;

    const start = p[0]!;
    const goal = p[p.length - 1]!;
    const startPad = { c: start.c, r: start.r + 1 };
    const goalPad = grade2Bend6GoalPad(goal);
    if (!isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) continue;

    const dEntry = unitOrthoDirBetween(startPad, start);
    if (!dEntry || !dirsEqual(dEntry, DIR.U)) continue;

    const bendSet = bendCellsInPath(p);
    if (!grade2BendNoRevisit(p, bendSet)) continue;

    const expectedBumpers = totalDiagonalTurnCount(p, startPad, goalPad);
    if (bumpers.size !== expectedBumpers) continue;

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
  const W = 5;
  const H = 5;

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
    if (bends === 6) {
      path = tryGrade2Bend6Path(pathable, W, H, start, goal, rng);
    } else {
      const polyTries = 40;
      for (let pt = 0; pt < polyTries; pt++) {
        const firstH = pt < 2 ? pt % 2 === 0 : rng() < 0.5;
        path = tryOrthogonalPolyline(start, goal, bends, firstH, pathable, rng);
        if (path) break;
      }
    }
    if (!path) {
      inc(trialOutcome, "polyline_exhausted");
      continue;
    }

    const pathBends = countRightAngles(path);
    if (bends === 6 ? pathBends < 6 || pathBends > 8 : pathBends !== bends) {
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
      const norm =
        bends === 6
          ? normalizeGrade2OppositePadPolyline(p, pb, w, h, {
              grade2Bend6FixedGoalPad: true,
            })
          : normalizeGrade2OppositePadPolyline(p, pb, w, h);
      if (norm.kind === "retry") {
        inc(rotationFail, "norm_retry");
        continue;
      }
      p = norm.path;
      const startP = p[0]!;
      const goalP = p[p.length - 1]!;
      const startPad = { c: startP.c, r: startP.r + 1 };
      const goalPad =
        bends === 6
          ? grade2Bend6GoalPad(goalP)
          : (() => {
              const prev = p[p.length - 2]!;
              const dLast = unitDirBetween(prev, goalP);
              if (!dLast) return null;
              return { c: goalP.c + dLast.dx, r: goalP.r + dLast.dy };
            })();
      if (!goalPad || !isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) {
        inc(
          rotationFail,
          !goalPad && bends === 4 ? "goal_prev_not_axis_adjacent" : "goalpad_not_strictly_outside"
        );
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
  const W = 5;
  const H = 5;
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

    const path = tryGrade2Bend6Path(pathable, W, H, start, goal, rng);
    if (!path) {
      inc(outerBucket, "bend6_path_null");
      continue;
    }

    const pathCr = countRightAngles(path);
    if (pathCr < 6 || pathCr > 8) {
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
        const norm = normalizeGrade2OppositePadPolyline(p, pb, w, h, {
          grade2Bend6FixedGoalPad: true,
        });
        if (norm.kind === "retry") {
          inc(rotationFail, "norm_retry");
          continue;
        }
        p = norm.path;
        const startP = p[0]!;
        const goalP = p[p.length - 1]!;
        const startPad = { c: startP.c, r: startP.r + 1 };
        const goalPad = grade2Bend6GoalPad(goalP);
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

/** 盤面生成 Lv.4（旧 Grade3）：6×6・折れ6・1 マス再訪 → `pickGrade2OrientedStage` */
function generateBoardLv4Stage(seed: number, genOpts?: ReflectShotPolylineGenOpts): GridStage | null {
  const rng = createStageRng(seed);
  const { w: W, h: H } = boardSizeForGrade(5);
  const pathable = makeRect(W, H);
  const maxAttempts = 220;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const bottoms = bottomCandidates(pathable);
    const tops = topCandidates(pathable);
    if (!bottoms.length || !tops.length) return null;
    const botStart = bottoms[Math.floor(rng() * bottoms.length)]!;
    const topGoal = tops[Math.floor(rng() * tops.length)]!;
    const path = findGrade3SixBendPath(pathable, botStart, topGoal, rng);
    if (!path) continue;
    const picked = pickGrade2OrientedStage(pathable, path, W, H, 6, rng, { relaxBendVisit: true });
    if (!picked) continue;

    let solutionPath = picked.solutionPath;
    let start = picked.start;
    let startPad = picked.startPad;
    const goal = picked.goal;

    const ge = maybeExtendStartForGoalUpsideDown(
      solutionPath,
      start,
      startPad,
      picked.grade2PadAdjustLabel,
      picked.pathable,
      picked.width,
      picked.height,
      genOpts?.debugReflecShotConsole
    );
    if (ge.kind === "discard") continue;

    if (ge.kind === "extended") {
      solutionPath = ge.path;
      start = ge.start;
      startPad = ge.startPad;
      if (!pathOrthStepValid(solutionPath, picked.pathable, picked.width, picked.height)) continue;
      if (!grade3RevisitOneCellRule(solutionPath)) continue;
      const fs = pathFirstStepDir(solutionPath);
      if (!fs || !dirsEqual(fs, DIR.U)) continue;
      if (countRightAngles(solutionPath) !== 6) continue;
      const prev = solutionPath[solutionPath.length - 2]!;
      const dLast = unitDirBetween(prev, goal);
      if (!dLast) continue;
      const goalPad = { c: goal.c + dLast.dx, r: goal.r + dLast.dy };
      if (!isStrictlyOutsideBoard(goalPad.c, goalPad.r, picked.width, picked.height)) continue;
      const dEntry = unitOrthoDirBetween(startPad, start);
      if (!dEntry || !dirsEqual(dEntry, DIR.U)) continue;
      const bendSet = bendCellsInPath(solutionPath);
      const { bumpers, ok } = placeDiagonalBumpersInterior(solutionPath);
      if (!ok || bumpers.size !== bendSet.size) continue;
      const dup = new Map<string, BumperCell>();
      bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
      shuffleWrongDisplay(dup, rng);
      return {
        width: picked.width,
        height: picked.height,
        pathable: picked.pathable,
        start,
        goal,
        startPad,
        goalPad,
        bumpers: dup,
        solutionPath,
        grade: 5,
        seed,
        grade2PadAdjustLabel: picked.grade2PadAdjustLabel,
        reflecSourceStartExtended: true,
      };
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
      grade: 5,
      seed,
      grade2PadAdjustLabel: picked.grade2PadAdjustLabel,
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

/** 盤面生成 Lv.1（旧 Grade1）：4×4・折れ 1〜4・`placeDiagonalBumpers` 後の本数で採否 */
function generateBoardLv1Stage(consumerGrade: 1 | 2, seed: number): GridStage | null {
  const rng = createStageRng(seed);
  const { w: W, h: H } = boardSizeForGrade(consumerGrade);
  const pathable = makeRect(W, H);
  const maxAttempts = consumerGrade === 2 ? 3500 : 1500;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const bottoms = bottomCandidates(pathable);
    const tops = topCandidates(pathable);
    if (!bottoms.length || !tops.length) return null;

    const start = bottoms[Math.floor(rng() * bottoms.length)]!;
    const goal = tops[Math.floor(rng() * tops.length)]!;

    const bends = Math.floor(rng() * 4) + 1;
    let path: CellCoord[] | null = null;
    for (let t = 0; t < 24; t++) {
      const firstH = rng() < 0.5;
      path = tryOrthogonalPolyline(start, goal, bends, firstH, pathable, rng);
      if (path) break;
    }
    if (!path) continue;
    if (countRightAngles(path) !== bends) continue;
    if (!grade1NoRevisit(path)) continue;

    const startPad = { c: start.c, r: start.r + 1 };
    const goalPad = { c: goal.c, r: goal.r - 1 };

    const { bumpers, ok } = placeDiagonalBumpers(path, startPad, goalPad);
    if (!ok || bumpers.size === 0) continue;
    if (consumerGrade === 1) {
      if (bumpers.size !== 2) continue;
    } else if (bumpers.size < 4) continue;

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
      grade: consumerGrade,
      seed,
    };
  }
  return null;
}

/** 盤面生成 Lv.2（旧 Grade2・折れ4）：5×5 */
function generateBoardLv2Stage(seed: number, genOpts?: ReflectShotPolylineGenOpts): GridStage | null {
  const rng = createStageRng(seed);
  const W = 5;
  const H = 5;
  const pathable = makeRect(W, H);
  const maxAttempts = 1200;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const bottoms = bottomCandidates(pathable);
    const tops = topCandidates(pathable);
    if (!bottoms.length || !tops.length) return null;

    const polyStart = bottoms[Math.floor(rng() * bottoms.length)]!;
    const polyGoal = tops[Math.floor(rng() * tops.length)]!;
    const dc = polyGoal.c - polyStart.c;
    const dr = polyGoal.r - polyStart.r;
    const bends = 4;
    if (dc === 0 || dr === 0) continue;

    let path: CellCoord[] | null = null;
    for (let t = 0; t < 40; t++) {
      const firstH = t < 2 ? t % 2 === 0 : rng() < 0.5;
      path = tryOrthogonalPolyline(polyStart, polyGoal, bends, firstH, pathable, rng);
      if (path) break;
    }
    if (!path) continue;
    if (countRightAngles(path) !== bends) continue;
    if (!pathHasOrthogonalCrossCell(path)) continue;

    const picked = pickGrade2OrientedStage(pathable, path, W, H, bends, rng);
    if (!picked) continue;

    let solutionPath = picked.solutionPath;
    let start = picked.start;
    let startPad = picked.startPad;
    let reflecSourceStartExtended = false;

    const ge = maybeExtendStartForGoalUpsideDown(
      solutionPath,
      start,
      startPad,
      picked.grade2PadAdjustLabel,
      picked.pathable,
      picked.width,
      picked.height,
      genOpts?.debugReflecShotConsole
    );
    if (ge.kind === "discard") continue;

    if (ge.kind === "extended") {
      solutionPath = ge.path;
      start = ge.start;
      startPad = ge.startPad;
      reflecSourceStartExtended = true;
      if (!pathOrthStepValid(solutionPath, picked.pathable, picked.width, picked.height)) continue;
      if (countRightAngles(solutionPath) !== bends) continue;
      if (!pathHasOrthogonalCrossCell(solutionPath)) continue;
      const bendSet = bendCellsInPath(solutionPath);
      if (!grade2BendNoRevisit(solutionPath, bendSet)) continue;
      const { bumpers, ok } = placeDiagonalBumpersInterior(solutionPath);
      if (!ok || bumpers.size !== bends) continue;
      const dup = new Map<string, BumperCell>();
      bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
      shuffleWrongDisplay(dup, rng);
      return {
        width: picked.width,
        height: picked.height,
        pathable: picked.pathable,
        start,
        goal: picked.goal,
        startPad,
        goalPad: picked.goalPad,
        bumpers: dup,
        solutionPath,
        grade: 3,
        seed,
        grade2PadAdjustLabel: picked.grade2PadAdjustLabel,
        reflecSourceStartExtended: true,
      };
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
      grade: 3,
      seed,
      grade2PadAdjustLabel: picked.grade2PadAdjustLabel,
    };
  }
  return null;
}

/** 盤面生成 Lv.3（旧 Grade2・折れ6）：5×5 */
function generateBoardLv3Stage(seed: number, polyOpts?: ReflectShotPolylineGenOpts): GridStage | null {
  const rng = createStageRng(seed);
  const W = 5;
  const H = 5;
  const pathable = makeRect(W, H);
  lastGrade2Bend6Trace = null;
  const maxAttempts = 1200;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const bottoms = bottomCandidates(pathable);
    const tops = topCandidates(pathable);
    if (!bottoms.length || !tops.length) return null;

    const bend6Start = bottoms[Math.floor(rng() * bottoms.length)]!;
    const bend6Goal = tops[Math.floor(rng() * tops.length)]!;

    const bend6Trace: Grade2Bend6PathTrace = {
      outerAttempt: attempt,
      innerAttempt: -1,
      variantA: true,
      ds: 0,
      tailPolyline: [],
      Q: { c: -1, r: -1 },
    };
    const path = tryGrade2Bend6Path(pathable, W, H, bend6Start, bend6Goal, rng, bend6Trace, attempt, polyOpts);
    if (!path || !pathOrthStepValid(path, pathable, W, H)) continue;

    const pathCr = countRightAngles(path);
    if (pathCr < 6 || pathCr > 8) continue;
    if (!grade1NoRevisit(path)) continue;

    const picked = pickGrade2Bend6OrientedStage(pathable, path, W, H, rng);
    if (!picked) continue;

    let solutionPath = picked.solutionPath;
    let start = picked.start;
    let startPad = picked.startPad;
    const goal = picked.goal;

    const ge = maybeExtendStartForGoalUpsideDown(
      solutionPath,
      start,
      startPad,
      picked.grade2PadAdjustLabel,
      picked.pathable,
      picked.width,
      picked.height,
      polyOpts?.debugReflecShotConsole
    );
    if (ge.kind === "discard") continue;

    if (ge.kind === "extended") {
      solutionPath = ge.path;
      start = ge.start;
      startPad = ge.startPad;
      if (!pathOrthStepValid(solutionPath, picked.pathable, W, H)) continue;
      const pcra = countRightAngles(solutionPath);
      if (pcra < 6 || pcra > 8) continue;
      if (!grade1NoRevisit(solutionPath)) continue;
      const bendSet = bendCellsInPath(solutionPath);
      if (!grade2BendNoRevisit(solutionPath, bendSet)) continue;
      const goalPad = grade2Bend6GoalPad(goal);
      const bump6 = placeGrade2Bend6Bumpers(solutionPath, picked.width, picked.height);
      if (!bump6 || bump6.size !== totalDiagonalTurnCount(solutionPath, startPad, goalPad)) continue;

      const dup = new Map<string, BumperCell>();
      bump6.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
      lastGrade2Bend6Trace = { trace: bend6Trace, rawPath: path.map((x) => ({ ...x })) };
      shuffleWrongDisplay(dup, rng);
      return {
        width: picked.width,
        height: picked.height,
        pathable: picked.pathable,
        start,
        goal,
        startPad,
        goalPad,
        bumpers: dup,
        solutionPath,
        grade: 4,
        seed,
        grade2PadAdjustLabel: picked.grade2PadAdjustLabel,
        reflecSourceStartExtended: true,
      };
    }

    const dup = new Map<string, BumperCell>();
    picked.bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
    lastGrade2Bend6Trace = { trace: bend6Trace, rawPath: path.map((x) => ({ ...x })) };
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
      grade: 4,
      seed,
      grade2PadAdjustLabel: picked.grade2PadAdjustLabel,
    };
  }
  return null;
}

export function generateGridStage(
  grade: number,
  seed: number,
  polyOpts?: ReflectShotPolylineGenOpts
): GridStage | null {
  const g = Math.max(1, Math.min(5, Math.floor(grade)));
  if (g === 1 || g === 2) return generateBoardLv1Stage(g, seed);
  if (g === 3) return generateBoardLv2Stage(seed, polyOpts);
  if (g === 4) return generateBoardLv3Stage(seed, polyOpts);
  return generateBoardLv4Stage(seed, polyOpts);
}

/** 乱数シードをずらして `generateGridStage` と同型の生成を再試行 */
export function fallbackGridStage(grade: number, seed: number): GridStage {
  const g = Math.max(1, Math.min(5, Math.floor(grade)));
  if (g === 1) {
    for (let t = 0; t < 500; t++) {
      const st = generateBoardLv1Stage(1, (seed + t * 0x9e3779b9) >>> 0);
      if (st) return { ...st, grade: g, seed };
    }
    throw new Error("fallbackGridStage(1): Lv.1・バンパー2 の生成に失敗");
  }
  if (g === 2) {
    for (let t = 0; t < 500; t++) {
      const st = generateBoardLv1Stage(2, (seed + t * 0x9e3779b9) >>> 0);
      if (st) return { ...st, grade: g, seed };
    }
    throw new Error("fallbackGridStage(2): Lv.1・バンパー4+ の生成に失敗");
  }
  if (g === 3) {
    for (let t = 0; t < 200; t++) {
      const st = generateBoardLv2Stage((seed + t * 130051) >>> 0);
      if (st) return { ...st, grade: g, seed };
    }
    throw new Error("fallbackGridStage(3): Lv.2 の生成に失敗");
  }
  if (g === 4) {
    for (let t = 0; t < 200; t++) {
      const st = generateBoardLv3Stage((seed + t * 130051) >>> 0);
      if (st) return { ...st, grade: g, seed };
    }
    throw new Error("fallbackGridStage(4): Lv.3 の生成に失敗");
  }
  for (let t = 0; t < 200; t++) {
    const st = generateBoardLv4Stage((seed + t * 130051) >>> 0);
    if (st) return { ...st, grade: g, seed };
  }
  throw new Error("fallbackGridStage(5): Lv.4 の生成に失敗");
}

export function generateGridStageWithFallback(
  grade: number,
  seed: number,
  polyOpts?: ReflectShotPolylineGenOpts
): GridStage {
  return generateGridStage(grade, seed, polyOpts) ?? fallbackGridStage(grade, seed);
}
