/**
 * G5 / G6 / G7 それぞれ n 回生成し、再訪折れ閉路上の「折れ点間で辺数が 1 の区間」個数（revisitLoopUnitLegCount）を集計する。
 * 用法: npx tsx scripts/stats-revisit-loop-unit-legs.mts [試行回数=30]
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const grid = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridStageGen.ts")).href);
const { generateGridStageWithFallback, revisitLoopUnitLegCount, g7RevisitCrossCountInsideBendLoop } = grid as {
  generateGridStageWithFallback: (
    grade: number,
    seed: number,
    opts?: { lv4GenMode?: "default" | "rFirst" | "rSecond" }
  ) => import("../src/app/lab/reflec-shot/gridTypes.ts").GridStage;
  revisitLoopUnitLegCount: (path: { c: number; r: number }[]) => number | null;
  g7RevisitCrossCountInsideBendLoop: (path: { c: number; r: number }[]) => number | null;
};

const n = Math.max(1, Math.min(200, Math.floor(Number(process.argv[2]) || 30)));

function runGrade(
  label: string,
  grade: number,
  opts?: { lv4GenMode?: "default" | "rFirst" | "rSecond" }
) {
  const hist = new Map<number, number>();
  let nullCount = 0;
  let le3 = 0;
  let crossOutsideLoop = 0;
  for (let i = 0; i < n; i++) {
    const seed = (i * 0x9e3779b9 + grade * 17) >>> 0;
    const st = generateGridStageWithFallback(grade, seed, opts);
    const u = revisitLoopUnitLegCount(st.solutionPath);
    if (u == null) {
      nullCount++;
      continue;
    }
    hist.set(u, (hist.get(u) ?? 0) + 1);
    if (u <= 3) le3++;
    if (grade === 7) {
      const cin = g7RevisitCrossCountInsideBendLoop(st.solutionPath);
      if (cin === 0) crossOutsideLoop++;
    }
  }
  const ok = n - nullCount;
  const frac = ok > 0 ? le3 / ok : 0;
  const keys = [...hist.keys()].sort((a, b) => a - b);
  console.log(`\n${label} (n=${n}, 算出不可=${nullCount})`);
  console.log(`  P(unitLegs<=3 | 成功) = ${(frac * 100).toFixed(1)}% (${le3}/${ok})`);
  if (grade === 7) {
    const cf = ok > 0 ? crossOutsideLoop / ok : 0;
    console.log(`  P(cross outside bend-loop | 成功) = ${(cf * 100).toFixed(1)}% (${crossOutsideLoop}/${ok})`);
  }
  console.log("  unitLegs ヒストグラム:");
  for (const k of keys) {
    const c = hist.get(k) ?? 0;
    const bar = "#".repeat(ok > 0 ? Math.min(40, Math.round((c / ok) * 80)) : 0);
    console.log(`    ${String(k).padStart(2)} : ${String(c).padStart(3)} ${bar}`);
  }
}

console.log("再訪折れ閉路: 折れ点境界どうしの添字差が 1 の区間の個数（revisitLoopUnitLegCount）");
runGrade("G5 (lv4 rSecond)", 5, { lv4GenMode: "rSecond" });
runGrade("G6", 6);
runGrade("G7", 7);
