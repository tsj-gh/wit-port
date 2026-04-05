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
 * 十型など「頂点列では再訪がなくても辺が内部交差する」盤の宝石想定に用いる。
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

function unitOrthoGridStep(a: CellCoord, b: CellCoord): { dc: number; dr: number } | null {
  const dc = b.c - a.c;
  const dr = b.r - a.r;
  if (Math.abs(dc) + Math.abs(dr) !== 1) return null;
  return { dc, dr };
}

/** 頂点 i で前後 1 マスずつ直進（折れずに通過）しているか */
function passesStraightThroughSolutionIndex(path: CellCoord[], i: number): boolean {
  if (i <= 0 || i >= path.length - 1) return false;
  const a = path[i - 1]!;
  const b = path[i]!;
  const c = path[i + 1]!;
  const ins = unitOrthoGridStep(a, b);
  const outs = unitOrthoGridStep(b, c);
  return !!(ins && outs && ins.dc === outs.dc && ins.dr === outs.dr);
}

function entryDirsPerpendicular(e1: { dc: number; dr: number }, e2: { dc: number; dr: number }): boolean {
  return e1.dc * e2.dc + e1.dr * e2.dr === 0;
}

/**
 * 再訪十字に該当するマスの `keyCell` 集合（`countRevisitCrossCellsOnSolutionPath` と同じ判定）。
 * ダミーバンパー配置禁止など生成側の除外に用いる。
 */
export function revisitCrossCellKeysOnSolutionPath(st: GridStage): Set<string> {
  const path = st.solutionPath;
  const indicesByKey = new Map<string, number[]>();
  for (let i = 0; i < path.length; i++) {
    const k = keyCell(path[i]!.c, path[i]!.r);
    if (!indicesByKey.has(k)) indicesByKey.set(k, []);
    indicesByKey.get(k)!.push(i);
  }
  const out = new Set<string>();
  for (const [k, idxs] of Array.from(indicesByKey.entries())) {
    if (idxs.length < 2) continue;
    const i0 = idxs[0]!;
    const i1 = idxs[1]!;
    if (!passesStraightThroughSolutionIndex(path, i0)) continue;
    if (!passesStraightThroughSolutionIndex(path, i1)) continue;
    const e0 = unitOrthoGridStep(path[i0 - 1]!, path[i0]!);
    const e1 = unitOrthoGridStep(path[i1 - 1]!, path[i1]!);
    if (!e0 || !e1) continue;
    if (!entryDirsPerpendicular(e0, e1)) continue;
    out.add(k);
  }
  return out;
}

/**
 * 再訪十字: 同一マスが solutionPath で 2 回現れ、1 回目・2 回目ともそのマスで直進し、
 * 1 回目と 2 回目の進入方向が直交するマスの個数（各マス 1 回まで数える）。
 */
export function countRevisitCrossCellsOnSolutionPath(st: GridStage): number {
  return revisitCrossCellKeysOnSolutionPath(st).size;
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
