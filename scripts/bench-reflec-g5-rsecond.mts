/**
 * Grade5・Lv.4・R-Second 生成を複数回計測する。
 * npx --yes tsx scripts/bench-reflec-g5-rsecond.mts
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const __dirname = dirname(fileURLToPath(import.meta.url));

const grid = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridStageGen.ts")).href);

const { generateGridStage } = grid;

const RSECOND: { lv4GenMode: "rSecond" } = { lv4GenMode: "rSecond" };

function emptyStats() {
  return {
    outerAttemptsUsed: 0,
    rejectedNoPath: 0,
    rejectedPickOrient: 0,
    rejectedExtendDiscard: 0,
    rejectedAfterExtend: 0,
    rFirstPolyCalls: 0,
    rFirstBfsPruned: 0,
    rFirstComboCacheSkips: 0,
    rFirstBudgetExhausted: 0,
    rFirstLastTryR: 0,
  };
}

const N = 10;

console.log("Grade5 R-Second 生成ベンチ（成功した `generateGridStage` を先頭から N 回、各 1 回だけ計測）\n");

const rows: { i: number; seed: number; ms: number; stats: ReturnType<typeof emptyStats> }[] = [];

for (let s = 1; rows.length < N && s < 2_000_000; s++) {
  const stats = emptyStats();
  const t0 = performance.now();
  const stage = generateGridStage(5, s >>> 0, { ...RSECOND, lv4BenchStats: stats });
  const ms = performance.now() - t0;
  if (!stage) continue;
  rows.push({ i: rows.length + 1, seed: s, ms, stats });
}

if (rows.length < N) {
  console.error("成功が不足:", rows.length);
  process.exit(1);
}

console.log("使用シード:", rows.map((r) => r.seed).join(", "));
console.log("");

const times = rows.map((r) => r.ms);
const sum = times.reduce((a, b) => a + b, 0);
const avg = sum / times.length;
const min = Math.min(...times);
const max = Math.max(...times);

console.log(
  "| # | seed | ms | 外側試行 | path却下 | pick却下 | extend棄却 | 延長後却下 | poly試行 | BFS棄却 | combo省 | 予算切 | lastTryR |"
);
console.log("|---|------|-----|----------|----------|----------|------------|------------|----------|---------|---------|--------|----------|");
for (const r of rows) {
  const st = r.stats;
  console.log(
    `| ${r.i} | ${r.seed} | ${r.ms.toFixed(3)} | ${st.outerAttemptsUsed} | ${st.rejectedNoPath} | ${st.rejectedPickOrient} | ${st.rejectedExtendDiscard} | ${st.rejectedAfterExtend} | ${st.rFirstPolyCalls} | ${st.rFirstBfsPruned} | ${st.rFirstComboCacheSkips} | ${st.rFirstBudgetExhausted} | ${st.rFirstLastTryR} |`
  );
}

console.log("");
console.log("集計（ms）:");
console.log(`- 平均: ${avg.toFixed(3)}`);
console.log(`- 最小: ${min.toFixed(3)}`);
console.log(`- 最大: ${max.toFixed(3)}`);

const agg = rows.reduce(
  (a, r) => ({
    path: a.path + r.stats.rejectedNoPath,
    pick: a.pick + r.stats.rejectedPickOrient,
    extD: a.extD + r.stats.rejectedExtendDiscard,
    extA: a.extA + r.stats.rejectedAfterExtend,
    att: a.att + r.stats.outerAttemptsUsed,
    poly: a.poly + r.stats.rFirstPolyCalls,
    bfs: a.bfs + r.stats.rFirstBfsPruned,
    combo: a.combo + r.stats.rFirstComboCacheSkips,
    budgetHit: a.budgetHit + (r.stats.rFirstBudgetExhausted ? 1 : 0),
  }),
  { path: 0, pick: 0, extD: 0, extA: 0, att: 0, poly: 0, bfs: 0, combo: 0, budgetHit: 0 }
);
console.log("");
console.log("10 回累計（リトライ内訳）:");
console.log(`- path 不成立: ${agg.path}`);
console.log(`- pickGrade2Oriented 不採用: ${agg.pick}`);
console.log(`- goal->upside down 延長棄却: ${agg.extD}`);
console.log(`- 延長後再検証却下: ${agg.extA}`);
console.log(`- 成功までの外側試行の合計: ${agg.att}（各盤で 1 以上）`);
console.log("");
console.log("R-Second 内部（R-First 系ポリ探索・ベンチフィールド再利用）10 回累計:");
console.log(`- tryOrthogonalPolylineRFirst 相当呼び出し: ${agg.poly}`);
console.log(`- BFS 事前棄却: ${agg.bfs}`);
console.log(`- 失敗コンボキャッシュヒット: ${agg.combo}`);
console.log(`- ポリ予算枯渇で終了した回数（1 試行中に該当）: ${agg.budgetHit}`);
