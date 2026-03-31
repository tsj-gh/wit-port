/**
 * 単一 seed の R-Second トレース（lv4RSecondTrace）
 * npx --yes tsx scripts/trace-reflec-rsecond-once.mts [hexSeed]
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const hex = process.argv[2] ?? "411fcb19";
const seed = Number.parseInt(hex, 16) >>> 0;

const __dirname = dirname(fileURLToPath(import.meta.url));
const grid = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridStageGen.ts")).href);
const { generateGridStage } = grid;

const trace: string[] = [];
const bench = {
  outerAttemptsUsed: 220,
  rejectedNoPath: 0,
  rejectedPickOrient: 0,
  rejectedExtendDiscard: 0,
  rejectedAfterExtend: 0,
};

const st = generateGridStage(5, seed, {
  lv4GenMode: "rSecond",
  lv4BenchStats: bench,
  lv4RSecondTrace: trace,
});

console.log(`seed=0x${hex} (${seed >>> 0}) ok=${!!st}`);
console.log("--- trace ---");
for (const line of trace) console.log(line);
console.log("--- bench ---");
console.log(JSON.stringify(bench, null, 2));
