import { bumperKindForTurn, diagonalBumperForTurn } from "./bumperRules";
import {
  keyCell,
  type BumperCell,
  type CellCoord,
  type GridStage,
  type BumperKind,
  DIR,
  type Dir,
} from "./gridTypes";

function inBounds(c: number, r: number, w: number, h: number) {
  return c >= 0 && c < w && r >= 0 && r < h;
}

/** UI 用：折れ回数目安（Grade3+ は従来のバンパー個数目安） */
export function bendOrBumperHint(grade: number): string {
  const g = Math.max(1, Math.min(5, Math.floor(grade)));
  if (g === 1) return "折れ2〜4";
  if (g === 2) return "折れ4〜6";
  if (g <= 4) return "バンパー2";
  return "バンパー3";
}

export function bumpersForGrade(grade: number): number {
  const g = Math.max(1, Math.min(5, Math.floor(grade)));
  if (g <= 2) return 0;
  if (g <= 4) return 2;
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
  if (g === 3) return [rect, () => templateL(w, h), () => templateT(w, h)];
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
      const nc = u.c + d.dx;
      const nr = u.r + d.dy;
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

function dirBetween(from: CellCoord, to: CellCoord): Dir {
  return { dx: to.c - from.c, dy: to.r - from.r };
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
      const nc = cell.c + d.dx;
      const nr = cell.r + d.dy;
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
      let cc = cell.c + d.dx;
      let rr = cell.r + d.dy;
      let steps = 0;
      while (steps < 4 && inBounds(cc, rr, w, h) && !pathable[cc]![rr] && used < budget) {
        pathable[cc]![rr] = true;
        used++;
        steps++;
        if (rng() < 0.35) break;
        cc += d.dx;
        rr += d.dy;
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

function unitStepDir(deltaC: number, deltaR: number): Dir | null {
  if (deltaC === 1 && deltaR === 0) return DIR.R;
  if (deltaC === -1 && deltaR === 0) return DIR.L;
  if (deltaC === 0 && deltaR === 1) return DIR.U;
  if (deltaC === 0 && deltaR === -1) return DIR.D;
  return null;
}

function orthogonalDirs(a: Dir, b: Dir): boolean {
  return a.dx * b.dx + a.dy * b.dy === 0 && a.dx * a.dx + a.dy * a.dy === 1 && b.dx * b.dx + b.dy * b.dy === 1;
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
    else d = lens[i]! > 0 ? DIR.U : DIR.D;
    const steps = Math.abs(lens[i]!);
    for (let s = 0; s < steps; s++) {
      cur = { c: cur.c + d.dx, r: cur.r + d.dy };
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

function portalBendAtStart(path: CellCoord[], launch: CellCoord): boolean {
  if (path.length < 2) return false;
  const dIn = unitDirBetween(launch, path[0]!);
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

function totalDiagonalTurnCount(path: CellCoord[], launch: CellCoord, goalPad: CellCoord): number {
  let n = countRightAngles(path);
  if (portalBendAtStart(path, launch)) n++;
  if (portalBendAtGoal(path, goalPad)) n++;
  return n;
}

function bendCellsInPathWithPortals(path: CellCoord[], launch: CellCoord, goalPad: CellCoord): Set<string> {
  const s = bendCellsInPath(path);
  if (portalBendAtStart(path, launch)) s.add(keyCell(path[0]!.c, path[0]!.r));
  if (portalBendAtGoal(path, goalPad)) s.add(keyCell(path[path.length - 1]!.c, path[path.length - 1]!.r));
  return s;
}

/** 盤内経路＋射出→入口・出口→ゴールパッドの直交にも斜めバンパーを置く */
function placeDiagonalBumpers(
  path: CellCoord[],
  launch: CellCoord,
  goalPad: CellCoord
): {
  bumpers: Map<string, BumperCell>;
  ok: boolean;
} {
  const bumpers = new Map<string, BumperCell>();

  if (path.length >= 2 && portalBendAtStart(path, launch)) {
    const dIn = unitDirBetween(launch, path[0]!)!;
    const dOut = unitDirBetween(path[0]!, path[1]!)!;
    const sol = diagonalBumperForTurn(dIn, dOut);
    if (sol) bumpers.set(keyCell(path[0]!.c, path[0]!.r), { display: sol, solution: sol });
  }

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1]!;
    const cur = path[i]!;
    const next = path[i + 1]!;
    const dIn = dirBetween(prev, cur);
    const dOut = dirBetween(cur, next);
    if (dIn.dx === 0 && dIn.dy === 0) continue;
    if (dOut.dx === 0 && dOut.dy === 0) continue;
    if (Math.abs(dIn.dx) + Math.abs(dIn.dy) !== 1 || Math.abs(dOut.dx) + Math.abs(dOut.dy) !== 1) continue;
    const sol = diagonalBumperForTurn(dIn, dOut);
    if (sol == null) continue;
    bumpers.set(keyCell(cur.c, cur.r), { display: sol, solution: sol });
  }

  if (path.length >= 2 && portalBendAtGoal(path, goalPad)) {
    const g = path[path.length - 1]!;
    const prev = path[path.length - 2]!;
    const dIn = unitDirBetween(prev, g)!;
    const dOut = unitDirBetween(g, goalPad)!;
    const sol = diagonalBumperForTurn(dIn, dOut);
    if (sol) bumpers.set(keyCell(g.c, g.r), { display: sol, solution: sol });
  }

  const expected = totalDiagonalTurnCount(path, launch, goalPad);
  const ok = bumpers.size === expected && expected > 0;
  return { bumpers, ok };
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

  const maxAttempts = 350;
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
      bends = rng() < 0.5 ? 2 : 4;
      if (bends === 2 && start.c === goal.c) bends = 4;
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

    const launch = { c: start.c, r: start.r + 1 };
    const goalPad = { c: goal.c, r: goal.r - 1 };

    if (grade === 1) {
      if (!grade1NoRevisit(path)) continue;
    } else {
      const bendSet = bendCellsInPathWithPortals(path, launch, goalPad);
      if (!grade2BendNoRevisit(path, bendSet)) continue;
    }

    const { bumpers, ok } = placeDiagonalBumpers(path, launch, goalPad);
    if (!ok || bumpers.size === 0) continue;

    const dup = new Map<string, BumperCell>();
    bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
    shuffleWrongDisplay(dup, rng);

    return {
      width: W,
      height: H,
      pathable,
      start,
      goal,
      launch,
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
      const dIn = dirBetween(prev, cur);
      const dOut = dirBetween(cur, next);
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
      launch: { c: start.c, r: start.r + 1 },
      goalPad: { c: goal.c, r: goal.r - 1 },
      bumpers,
      solutionPath: path,
      grade,
      seed,
    };
  }

  return null;
}

/** 手組みフォールバック（Grade1/2 は折れ線、3+ は直線＋矩形） */
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
    const launch = { c: start.c, r: start.r + 1 };
    const goalPad = { c: goal.c, r: goal.r - 1 };
    const { bumpers, ok } = placeDiagonalBumpers(path, launch, goalPad);
    const dup = new Map<string, BumperCell>();
    if (ok) bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
    if (dup.size) shuffleWrongDisplay(dup, createStageRng(seed));
    return {
      width: w,
      height: h,
      pathable,
      start,
      goal,
      launch,
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
    const start = { c: 1, r: 4 };
    const goal = { c: 3, r: 0 };
    const path: CellCoord[] = [
      { c: 1, r: 4 },
      { c: 2, r: 4 },
      { c: 3, r: 4 },
      { c: 3, r: 3 },
      { c: 3, r: 2 },
      { c: 2, r: 2 },
      { c: 1, r: 2 },
      { c: 0, r: 2 },
      { c: 0, r: 1 },
      { c: 0, r: 0 },
      { c: 1, r: 0 },
      { c: 2, r: 0 },
      { c: 3, r: 0 },
    ];
    const launch = { c: start.c, r: start.r + 1 };
    const goalPad = { c: goal.c, r: goal.r - 1 };
    const { bumpers, ok } = placeDiagonalBumpers(path, launch, goalPad);
    const dup = new Map<string, BumperCell>();
    if (ok) {
      bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
      shuffleWrongDisplay(dup, createStageRng(seed));
    }
    return {
      width: w,
      height: h,
      pathable,
      start,
      goal,
      launch,
      goalPad,
      bumpers: dup,
      solutionPath: path,
      grade,
      seed,
    };
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
  const dIn = dirBetween({ c: mid, r: bumperR + 1 }, bumperCell);
  const dOut = dirBetween(bumperCell, { c: mid, r: bumperR - 1 });
  const sol = bumperKindForTurn(dIn, dOut) ?? "PIPE";
  const bumpers = new Map<string, BumperCell>();
  bumpers.set(keyCell(bumperCell.c, bumperCell.r), { display: "HYPHEN", solution: sol });
  return {
    width: w,
    height: h,
    pathable,
    start,
    goal,
    launch: { c: start.c, r: start.r + 1 },
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
