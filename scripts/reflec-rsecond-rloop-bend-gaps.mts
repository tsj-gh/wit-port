/**
 * Grade5 (R-Second) 再訪区間 R→…→R の折れ点間（沿線）距離の統計。
 * 実行: npx --yes tsx scripts/reflec-rsecond-rloop-bend-gaps.mts [試行回数]
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gridStageGen = await import(
  pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridStageGen.ts")).href
);
const { generateGridStage } = gridStageGen;
const GT = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridTypes.ts")).href);

type CellCoord = GT.CellCoord;

function unitStepDir(dc: number, dr: number) {
  if (!((Math.abs(dc) === 1 && dr === 0) || (dc === 0 && Math.abs(dr) === 1))) return null;
  return GT.gridDeltaToScreenDir({ dx: dc, dy: dr });
}

function orthogonalDirs(a: { dx: number; dy: number }, b: { dx: number; dy: number }) {
  return a.dx * b.dx + a.dy * b.dy === 0 && a.dx * a.dx + a.dy * a.dy === 1 && b.dx * b.dx + b.dy * b.dy === 1;
}

function isBendVertex(path: CellCoord[], i: number): boolean {
  if (i <= 0 || i >= path.length - 1) return false;
  const d0 = unitStepDir(path[i]!.c - path[i - 1]!.c, path[i]!.r - path[i - 1]!.r);
  const d1 = unitStepDir(path[i + 1]!.c - path[i]!.c, path[i + 1]!.r - path[i]!.r);
  return !!(d0 && d1 && orthogonalDirs(d0, d1));
}

/** 再訪セル（1 マスだけ 2 回出現）の [firstIdx, secondIdx] */
function revisitSegment(path: CellCoord[]): { i0: number; i1: number; key: string } | null {
  const seen = new Map<string, number>();
  for (let i = 0; i < path.length; i++) {
    const k = GT.keyCell(path[i]!.c, path[i]!.r);
    if (seen.has(k)) return { i0: seen.get(k)!, i1: i, key: k };
    seen.set(k, i);
  }
  return null;
}

/** 部分路 path[i0..i1] 上の 90° 折れ頂点の添字（両端 R は含めない：内部頂点のみ） */
function bendIndicesOnSubpath(sub: CellCoord[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < sub.length - 1; i++) {
    if (isBendVertex(sub, i)) out.push(i);
  }
  return out;
}

/** 隣接折れ頂点間の沿線距離（辺の本数 = 添字差） */
function gapsBetweenBends(bendIdx: number[]): number[] {
  const g: number[] = [];
  for (let k = 0; k < bendIdx.length - 1; k++) {
    g.push(bendIdx[k + 1]! - bendIdx[k]!);
  }
  return g;
}

const trials = Math.max(1, parseInt(process.argv[2] ?? "100", 10) || 100);
const globalGapHist = new Map<number, number>();
const rLoopLenHist = new Map<number, number>();
let okCount = 0;
let nullCount = 0;
let noRevisitCount = 0;
const examplesGe2: { seed: number; gaps: number[]; subLen: number; bendIdx: number[] }[] = [];

for (let t = 0; t < trials; t++) {
  const seed = (t * 0x9e3779b9 + 0x517cc1b7) >>> 0;
  const st = generateGridStage(5, seed, { lv4GenMode: "rSecond" });
  if (!st) {
    nullCount++;
    continue;
  }
  const path = st.solutionPath;
  const seg = revisitSegment(path);
  if (!seg) {
    noRevisitCount++;
    continue;
  }
  okCount++;
  const sub = path.slice(seg.i0, seg.i1 + 1);
  const sl = sub.length;
  rLoopLenHist.set(sl, (rLoopLenHist.get(sl) ?? 0) + 1);
  const bendIdx = bendIndicesOnSubpath(sub);
  const gaps = gapsBetweenBends(bendIdx);
  for (const d of gaps) {
    globalGapHist.set(d, (globalGapHist.get(d) ?? 0) + 1);
  }
  const maxG = gaps.length ? Math.max(...gaps) : 0;
  if (maxG >= 2) {
    examplesGe2.push({ seed, gaps: [...gaps], subLen: sub.length, bendIdx: [...bendIdx] });
  }
}

console.log(`Grade5 R-Second trials=${trials} generated=${okCount} null=${nullCount} noRevisit=${noRevisitCount}`);
console.log("再訪区間 R→…→R のセル数（両端 R 含む）ヒストグラム:");
for (const L of [...rLoopLenHist.keys()].sort((a, b) => a - b)) {
  console.log(`  len ${L}: ${rLoopLenHist.get(L)}`);
}
console.log("沿線距離（隣接折れ頂点間の辺数）ヒストグラム（全試行・全ギャップ合算）:");
const sorted = [...globalGapHist.keys()].sort((a, b) => a - b);
for (const d of sorted) {
  console.log(`  ${d}: ${globalGapHist.get(d)}`);
}
if (examplesGe2.length) {
  console.log(`\n距離>=2 のギャップを含む例 (${examplesGe2.length} 件、最大5件表示):`);
  for (const ex of examplesGe2.slice(0, 5)) {
    console.log(JSON.stringify(ex));
  }
} else {
  console.log(`\n${trials} 試行中、隣接折れ点間の沿線距離が 2 以上になる例は 0 件。`);
}
