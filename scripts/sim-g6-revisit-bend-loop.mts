/**
 * G6 を連続生成し、再訪折れマスの「1回目〜2回目出現までの辺数」（grade6RevisitBendLoopSpanSteps）の分布を表示する。
 * 用法: npx tsx scripts/sim-g6-revisit-bend-loop.mts [試行回数=50]
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const grid = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridStageGen.ts")).href);
const { generateGridStage, grade6RevisitBendLoopSpanSteps } = grid as {
  generateGridStage: (grade: number, seed: number) => import("../src/app/lab/reflec-shot/gridTypes.ts").GridStage | null;
  grade6RevisitBendLoopSpanSteps: (path: { c: number; r: number }[]) => number | null;
};

const n = Math.max(1, Math.min(500, Math.floor(Number(process.argv[2]) || 50)));
const hist = new Map<number, number>();
let nullStages = 0;
let nullSpan = 0;

for (let i = 0; i < n; i++) {
  const st = generateGridStage(6, i >>> 0);
  if (!st) {
    nullStages++;
    continue;
  }
  const span = grade6RevisitBendLoopSpanSteps(st.solutionPath);
  if (span == null) {
    nullSpan++;
    continue;
  }
  hist.set(span, (hist.get(span) ?? 0) + 1);
}

const spans = [...hist.keys()].sort((a, b) => a - b);
const totalOk = n - nullStages - nullSpan;
let sum = 0;
for (const s of spans) sum += s * (hist.get(s) ?? 0);
const mean = totalOk > 0 ? sum / totalOk : 0;

console.log(`G6 シミュレーション n=${n}`);
console.log(`  生成失敗(null): ${nullStages}`);
console.log(`  span 算出不可: ${nullSpan}`);
console.log(`  成功: ${totalOk} 平均ループ辺数≈${mean.toFixed(2)}`);
console.log("  再訪折れ閉路（solution 上 i1-i0）ヒストグラム:");
for (const s of spans) {
  const c = hist.get(s) ?? 0;
  const bar = "#".repeat(totalOk > 0 ? Math.min(40, Math.round((c / totalOk) * 80)) : 0);
  console.log(`    ${String(s).padStart(2)} : ${String(c).padStart(3)} ${bar}`);
}
