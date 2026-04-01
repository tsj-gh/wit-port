/**
 * R-Second 成功時の (b0,b1,b2) ヒスト。実行: npx --yes tsx scripts/rsecond-win-split-hist.mts [試行数]
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { generateGridStage } = await import(
  pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridStageGen.ts")).href
);

const n = Math.max(1, parseInt(process.argv[2] ?? "400", 10) || 400);
const hist = new Map<string, number>();
const legHist = new Map<string, number>();
for (let t = 0; t < n; t++) {
  const seed = (t * 0x9e3779b9 + 0x517cc1b7) >>> 0;
  const bench = {
    outerAttemptsUsed: 0,
    rejectedNoPath: 0,
    rejectedPickOrient: 0,
    rejectedExtendDiscard: 0,
    rejectedAfterExtend: 0,
  };
  generateGridStage(5, seed, { lv4GenMode: "rSecond", lv4BenchStats: bench });
  const k = bench.rSecondWinningSplit?.join(",") ?? "null";
  hist.set(k, (hist.get(k) ?? 0) + 1);
  const leg = bench.rSecondWinningMiddleLeg ?? "?";
  legHist.set(leg, (legHist.get(leg) ?? 0) + 1);
}
console.log(`trials=${n} winning (b0,b1,b2) histogram:`);
for (const k of [...hist.keys()].sort()) {
  console.log(`  (${k}): ${hist.get(k)}`);
}
console.log(`winning middle leg (long = S1–P2 with bends=min(b1,b1Open+1)):`);
for (const k of [...legHist.keys()].sort()) {
  console.log(`  ${k}: ${legHist.get(k)}`);
}
