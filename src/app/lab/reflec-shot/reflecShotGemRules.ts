import {
  countBumpersOnSolutionPath,
  dirsEqual,
  gemAwardBumperCellKeys,
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
 * 理想ポリライン上で直交2辺が厳密内部で交わるマス（重複なし）。
 * Grade3+ の目標数「再訪マス（十字）」はこのセル数と一致（経路がそのマスを複数回踏む幾何）。
 */
export function distinctOrthogonalCrossCells(pts: CellCoord[]): CellCoord[] {
  if (pts.length < 4) return [];
  type Seg = { a: CellCoord; b: CellCoord };
  const segs: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (a.c === b.c && a.r === b.r) continue;
    if (Math.abs(a.c - b.c) + Math.abs(a.r - b.r) !== 1) continue;
    segs.push({ a, b });
  }
  const seen = new Set<string>();
  const out: CellCoord[] = [];
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i]!;
      const t = segs[j]!;
      const pt = strictInnerCrossPoint(s.a, s.b, t.a, t.b);
      if (!pt) continue;
      const k = keyCell(pt.c, pt.r);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ ...pt });
    }
  }
  return out;
}

/** `solutionPath` 上で 2 回以上現れるセル（再訪）のうち、理想経路の十字交差マスに含まれる個数 */
export function countRevisitCrossCellsOnSolutionPath(st: GridStage): number {
  const pts = idealPathPointsForGemRules(st);
  const crossKeys = new Set(distinctOrthogonalCrossCells(pts).map((p) => keyCell(p.c, p.r)));
  if (crossKeys.size === 0) return 0;
  const visit = new Map<string, number>();
  for (const p of st.solutionPath) {
    const k = keyCell(p.c, p.r);
    visit.set(k, (visit.get(k) ?? 0) + 1);
  }
  let n = 0;
  for (const k of Array.from(crossKeys)) {
    if ((visit.get(k) ?? 0) >= 2) n++;
  }
  return n;
}

/**
 * 想定正解経路をなぞったとき、同一折れ点バンパーに正反対の入射方向で 2 回目に入る回数（Grade5・再訪折れ）。
 */
export function countExpectedTwoSidedBendsOnIdealPath(st: GridStage): number {
  const eligible = gemAwardBumperCellKeys(st);
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
    if (!eligible.has(cellKey)) continue;
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
  revisitCrossCells: number;
  twoSidedBends: number;
  required: number;
} {
  const baseBends = countBumpersOnSolutionPath(st);
  const pts = idealPathPointsForGemRules(st);
  const crossings = countPolylineOrthogonalCrossings(pts);
  const revisitCrossCells = countRevisitCrossCellsOnSolutionPath(st);
  const twoSidedBends = countExpectedTwoSidedBendsOnIdealPath(st);
  const g = Math.max(1, Math.min(5, Math.floor(st.grade)));
  let required = baseBends;
  if (g >= 3) {
    /** 十型など「十字だが solution の頂点列では 1 回しか出てこない」交差は crossings で数える */
    required += Math.max(revisitCrossCells, crossings);
  }
  if (g >= 5) required += 3 * twoSidedBends;
  return { baseBends, crossings, revisitCrossCells, twoSidedBends, required };
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
  const r = computeRequiredGemCountForStage(st);
  st.gemRuleBaseBends = r.baseBends;
  st.gemExpectedCrossings = Math.max(r.revisitCrossCells, r.crossings);
  st.gemExpectedTwoSidedBends = r.twoSidedBends;
  st.requiredGemCount = r.required;
}
