import {
  bendCellKeysInSolutionPath,
  countBumpersOnSolutionPath,
  dirsEqual,
  keyCell,
  negateDir,
  unitOrthoDirBetween,
  type CellCoord,
  type Dir,
  type GridStage,
} from "./gridTypes";

/** 宝石・十字路・両面ヒット用の想定エージェント経路（パッド含む） */
export function idealPathPointsForGemRules(st: GridStage): CellCoord[] {
  const p = st.solutionPath;
  if (p.length === 0) return [{ ...st.startPad }, { ...st.goalPad }];
  return [{ ...st.startPad }, ...p.map((x) => ({ ...x })), { ...st.goalPad }];
}

/** 直交2辺の厳密内部交点（マス座標）。なければ null */
export function strictInnerCrossPoint(
  a: CellCoord,
  b: CellCoord,
  c: CellCoord,
  d: CellCoord
): CellCoord | null {
  let h1 = a.r === b.r;
  const h2 = c.r === d.r;
  if (h1 === h2) return null;
  if (!h1 && !h2) return null;
  if (!h1) {
    return strictInnerCrossPoint(c, d, a, b);
  }
  const r0 = a.r;
  const cmin = Math.min(a.c, b.c);
  const cmax = Math.max(a.c, b.c);
  const c0 = c.c;
  const rmin = Math.min(c.r, d.r);
  const rmax = Math.max(c.r, d.r);
  if (!(cmin < c0 && c0 < cmax && rmin < r0 && r0 < rmax)) return null;
  return { c: c0, r: r0 };
}

export function orthoSegStrictInnerCross(a: CellCoord, b: CellCoord, c: CellCoord, d: CellCoord): boolean {
  return strictInnerCrossPoint(a, b, c, d) != null;
}

/** 正解ポリライン（パッド含む）の辺どうしが直交し、互いに内部で交わる回数 */
export function countPolylineOrthogonalCrossings(pts: CellCoord[]): number {
  if (pts.length < 4) return 0;
  type Seg = { a: CellCoord; b: CellCoord };
  const segs: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (a.c === b.c && a.r === b.r) continue;
    if (Math.abs(a.c - b.c) + Math.abs(a.r - b.r) !== 1) continue;
    segs.push({ a, b });
  }
  let cnt = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i]!;
      const t = segs[j]!;
      if (orthoSegStrictInnerCross(s.a, s.b, t.a, t.b)) cnt++;
    }
  }
  return cnt;
}

/**
 * 想定正解経路をなぞったとき、同一折れ点バンパーに正反対の入射方向で 2 回目に入る回数（Grade5・再訪折れ）。
 */
export function countExpectedTwoSidedBendsOnIdealPath(st: GridStage): number {
  const bendKeys = bendCellKeysInSolutionPath(st.solutionPath);
  const poly = idealPathPointsForGemRules(st);
  const firstIn = new Map<string, Dir>();
  const done = new Set<string>();
  let n = 0;
  for (let k = 1; k < poly.length; k++) {
    const prev = poly[k - 1]!;
    const cur = poly[k]!;
    const incoming = unitOrthoDirBetween(prev, cur);
    if (!incoming) continue;
    const cellKey = keyCell(cur.c, cur.r);
    if (!bendKeys.has(cellKey)) continue;
    const bump = st.bumpers.get(cellKey);
    if (!bump || bump.isDummy) continue;
    const was = firstIn.get(cellKey);
    if (was == null) {
      firstIn.set(cellKey, incoming);
    } else if (!done.has(cellKey) && dirsEqual(incoming, negateDir(was))) {
      n++;
      done.add(cellKey);
    }
  }
  return n;
}

export function computeRequiredGemCountForStage(st: GridStage): {
  baseBends: number;
  crossings: number;
  twoSidedBends: number;
  required: number;
} {
  const baseBends = countBumpersOnSolutionPath(st);
  const pts = idealPathPointsForGemRules(st);
  const crossings = countPolylineOrthogonalCrossings(pts);
  const twoSidedBends = countExpectedTwoSidedBendsOnIdealPath(st);
  const g = Math.max(1, Math.min(5, Math.floor(st.grade)));
  let required = baseBends;
  if (g >= 3) required += crossings;
  if (g >= 5) required += 3 * twoSidedBends;
  return { baseBends, crossings, twoSidedBends, required };
}

/** 新セグメントと過去セグメントの直交内部交差マス（先頭の1つ）。なければ null */
export function findCrossCellForNewAgentSegment(
  prior: { a: CellCoord; b: CellCoord }[],
  from: CellCoord,
  to: CellCoord
): CellCoord | null {
  if (from.c === to.c && from.r === to.r) return null;
  if (Math.abs(from.c - to.c) + Math.abs(from.r - to.r) !== 1) return null;
  for (const old of prior) {
    const pt = strictInnerCrossPoint(from, to, old.a, old.b);
    if (pt) return pt;
  }
  return null;
}

/** 移動直後のセグメントが、それ以前のセグメントと直交内部交差するか（ランタイム用） */
export function newAgentSegmentCrossesPriorPath(
  prior: { a: CellCoord; b: CellCoord }[],
  from: CellCoord,
  to: CellCoord
): boolean {
  return findCrossCellForNewAgentSegment(prior, from, to) != null;
}

export function applyGemRuleMetadataToStage(st: GridStage): void {
  const { baseBends, crossings, twoSidedBends, required } = computeRequiredGemCountForStage(st);
  st.gemRuleBaseBends = baseBends;
  st.gemExpectedCrossings = crossings;
  st.gemExpectedTwoSidedBends = twoSidedBends;
  st.requiredGemCount = required;
}
