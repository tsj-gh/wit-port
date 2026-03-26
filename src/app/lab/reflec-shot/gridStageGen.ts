import { bumperKindForTurn } from "./bumperRules";
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

export function bumpersForGrade(grade: number): number {
  const g = Math.max(1, Math.min(5, Math.floor(grade)));
  if (g <= 2) return 1;
  if (g <= 4) return 2;
  return 3;
}

/** Grade に応じた盤面の論理サイズ（キャンバス枠は UI 側で固定・セルはこれに合わせて拡大縮小） */
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

/** L字：右上ブロックを void */
function templateL(w: number, h: number): boolean[][] {
  const p = makeRect(w, h);
  const c0 = Math.ceil(w * 0.5);
  const r1 = Math.floor(h * 0.45);
  for (let c = c0; c < w; c++) {
    for (let r = 0; r < r1; r++) p[c]![r] = false;
  }
  return p;
}

/** T字：中央横溝 */
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

/** 十字：腕以外 void */
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

/** メインパスから行き止まり枝を追加（ループなし・void を埋めるのみ） */
function addDeadEndBranches(pathable: boolean[][], mainKeys: Set<string>, rng: () => number, budget: number) {
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
      while (
        steps < 4 &&
        inBounds(cc, rr, w, h) &&
        !pathable[cc]![rr] &&
        used < budget
      ) {
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

export function generateGridStage(grade: number, seed: number): GridStage | null {
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

/** ゴール手前まで届かないフォールバック（矩形・直線＋1バンパー） */
export function fallbackGridStage(grade: number, seed: number): GridStage {
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
