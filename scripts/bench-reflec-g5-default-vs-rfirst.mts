/**
 * Grade5・Lv.4 の Default と R-First を同一シード集合で各 10 回計測し比較する。
 * npx --yes tsx scripts/bench-reflec-g5-default-vs-rfirst.mts
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const __dirname = dirname(fileURLToPath(import.meta.url));
const grid = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridStageGen.ts")).href);
const { generateGridStage } = grid;

const N = 10;
const MAX_SCAN = 400_000;

console.log("シード探索（Default 成功 → R-First 成功の順で両方取れるものを N 個）…");

const seedsBoth: number[] = [];
for (let s = 1; seedsBoth.length < N && s < MAX_SCAN; s++) {
  const stDef = generateGridStage(5, s >>> 0, {});
  if (!stDef) continue;
  const stRf = generateGridStage(5, s >>> 0, { lv4GenMode: "rFirst" });
  if (stRf) seedsBoth.push(s);
}

if (seedsBoth.length < N) {
  console.error("両方成功するシードが不足:", seedsBoth.length);
  process.exit(1);
}

type Row = { i: number; seed: number; msDefault: number; msRFirst: number; ratio: number };
const rows: Row[] = [];

for (let i = 0; i < N; i++) {
  const seed = seedsBoth[i]!;

  const t0 = performance.now();
  const d = generateGridStage(5, seed >>> 0, {});
  const msDefault = performance.now() - t0;
  if (!d) {
    console.error("Default が失敗 seed=", seed);
    process.exit(1);
  }

  const t1 = performance.now();
  const r = generateGridStage(5, seed >>> 0, { lv4GenMode: "rFirst" });
  const msRFirst = performance.now() - t1;
  if (!r) {
    console.error("R-First が失敗 seed=", seed);
    process.exit(1);
  }

  rows.push({
    i: i + 1,
    seed,
    msDefault,
    msRFirst,
    ratio: msRFirst / msDefault,
  });
}

const sumD = rows.reduce((a, r) => a + r.msDefault, 0);
const sumR = rows.reduce((a, r) => a + r.msRFirst, 0);
const avgD = sumD / N;
const avgR = sumR / N;

console.log("Grade5 Lv.4: Default vs R-First（同一シード・各モード `generateGridStage` を 1 回ずつ計測）\n");
console.log("シード:", seedsBoth.join(", "));
console.log("");
console.log("| # | seed | Default ms | R-First ms | R/Def |");
console.log("|---|------|------------|------------|-------|");
for (const r of rows) {
  console.log(
    `| ${r.i} | ${r.seed} | ${r.msDefault.toFixed(3)} | ${r.msRFirst.toFixed(3)} | ${r.ratio.toFixed(2)}× |`
  );
}
console.log("");
console.log("集計（ms）");
console.log(`| | Default | R-First |`);
console.log(`| 平均 | ${avgD.toFixed(3)} | ${avgR.toFixed(3)} |`);
console.log(`| 最小 | ${Math.min(...rows.map((x) => x.msDefault)).toFixed(3)} | ${Math.min(...rows.map((x) => x.msRFirst)).toFixed(3)} |`);
console.log(`| 最大 | ${Math.max(...rows.map((x) => x.msDefault)).toFixed(3)} | ${Math.max(...rows.map((x) => x.msRFirst)).toFixed(3)} |`);
console.log(`| 合計 | ${sumD.toFixed(3)} | ${sumR.toFixed(3)} |`);
console.log("");
if (avgD < avgR) console.log(`平均では Default が ${(avgR / avgD).toFixed(2)}× 速い（R-First の方が遅い）。`);
else console.log(`平均では R-First が ${(avgD / avgR).toFixed(2)}× 速い（Default の方が遅い）。`);
