#!/usr/bin/env node
/**
 * Pair-link 修正評価ロジックベンチマーク: 9パターン × 1,000回 = 9,000サンプル
 * - Score閾値による破棄なし（負のスコアもカウント）
 * - Mutation完了後・全マス埋まり・パス確定状態のデータでスコア算出
 *
 * 出力: pairlink_benchmark_9k_revised.json
 *
 * 用法: node scripts/run-pairlink-benchmark-9k-revised.mjs
 * 環境変数: SIM_OUT_DIR (出力先), SIM_TRIALS (既定 1000)
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { performance } from "perf_hooks";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const WORKER_PATH = path.join(ROOT, "public", "workers", "board-worker.js");
const OUT_DIR = path.resolve(process.env.SIM_OUT_DIR || ROOT);

const CONFIGS = [
  { size: 4, pairs: 3 },
  { size: 5, pairs: 4 },
  { size: 6, pairs: 5 },
  { size: 7, pairs: 7 },
  { size: 8, pairs: 8 },
  { size: 8, pairs: 9 },
  { size: 9, pairs: 9 },
  { size: 9, pairs: 10 },
  { size: 10, pairs: 10 },
];

const TRIALS_PER_CONFIG = Math.max(1, parseInt(String(process.env.SIM_TRIALS || "1000"), 10) || 1000);
const YIELD_EVERY = 5;
const PROGRESS_EVERY = 100;

function yieldEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

function loadBoardWorker() {
  let code = fs.readFileSync(WORKER_PATH, "utf8");
  code = code.replace(/\r?\nself\.onmessage[\s\S]*$/m, "\nvoid 0;\n");
  const sandbox = {
    console: { log: () => {}, error: () => {}, warn: () => {}, time: () => {}, timeEnd: () => {} },
    performance: { now: () => Date.now() },
    Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set,
    Error, TypeError, RangeError, parseInt, parseFloat, isNaN, isFinite, self: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.generatePairLinkPuzzle;
}

function countBends(path) {
  if (!path || path.length < 3) return 0;
  let bends = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1], cur = path[i], next = path[i + 1];
    const d1Horz = Math.abs(prev.x - cur.x) > 0;
    const d2Horz = Math.abs(cur.x - next.x) > 0;
    if (d1Horz !== d2Horz) bends++;
  }
  return bends;
}

function runOneTrial(gen, size, pairs) {
  const seed = `bench-${size}x${pairs}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const t0 = performance.now();
  const result = gen(size, seed, pairs, {
    generationMode: "edgeSwap",
    scoreThreshold: -1,
  });
  const genTime = performance.now() - t0;
  if (!result || !result.postMutationScoreBreakdown) return null;
  const bd = result.postMutationScoreBreakdown;
  const paths = result.solutionPaths || {};
  const pathLengths = [];
  let totalBends = 0;
  for (const p of result.pairs || []) {
    const pl = paths[String(p.id)]?.[0];
    if (pl) {
      pathLengths.push(pl.length);
      totalBends += countBends(pl);
    }
  }
  pathLengths.sort((a, b) => b - a);
  const top2Sum = (pathLengths[0] || 0) + (pathLengths[1] || 0);
  const top2Share = size * size > 0 ? top2Sum / (size * size) : 0;
  const totalCells = pathLengths.reduce((a, b) => a + b, 0);
  const fillRate = size * size > 0 ? totalCells / (size * size) : 1;
  return {
    TotalScore: bd.finalScore,
    enclosureCount: bd.enclosureCount ?? 0,
    top2Share,
    totalBends,
    fillRate: Math.min(1, fillRate),
    pathLengths,
    genTimeMs: genTime,
    boardData: result.seed,
  };
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function patternLabel(config) {
  return `${config.size}x${config.size}_Pairs${config.pairs}`;
}

async function runConfig(gen, config, configIndex) {
  const { size, pairs } = config;
  const trials = [];
  let attempts = 0;
  while (trials.length < TRIALS_PER_CONFIG) {
    if (attempts % YIELD_EVERY === 0) await yieldEventLoop();
    attempts++;
    const row = runOneTrial(gen, size, pairs);
    if (row) {
      trials.push(row);
      if (trials.length % PROGRESS_EVERY === 0 || trials.length === TRIALS_PER_CONFIG) {
        console.error(`  [${configIndex + 1}/9] ${patternLabel(config)}: ${trials.length}/${TRIALS_PER_CONFIG} (100回ごと進捗)`);
      }
    }
  }
  const scores = trials.map((t) => t.TotalScore);
  const positiveCount = trials.filter((t) => t.TotalScore > 0).length;
  const scoreGt500Count = trials.filter((t) => t.TotalScore > 500).length;
  const encZeroCount = trials.filter((t) => t.enclosureCount === 0).length;
  const encGe1Count = trials.filter((t) => t.enclosureCount >= 1).length;
  const genTimes = trials.map((t) => t.genTimeMs);

  const top10 = [...trials]
    .sort((a, b) => b.TotalScore - a.TotalScore)
    .slice(0, 10)
    .map((t) => ({
      Score: Math.round(t.TotalScore * 100) / 100,
      enclosureCount: t.enclosureCount,
      pathLengths: t.pathLengths,
      top2Share: Math.round(t.top2Share * 1000) / 1000,
      totalBends: t.totalBends,
      boardData: t.boardData,
    }));

  return {
    pattern: patternLabel(config),
    config: { size, pairs },
    basicStats: {
      mean: Math.round(mean(scores) * 100) / 100,
      median: Math.round(median(scores) * 100) / 100,
      max: Math.round(Math.max(...scores) * 100) / 100,
      min: Math.round(Math.min(...scores) * 100) / 100,
    },
    generationEfficiency: {
      avgGenTimeMs: Math.round(mean(genTimes) * 100) / 100,
      positiveScoreRate: Math.round((positiveCount / trials.length) * 10000) / 100,
    },
    qualityDistribution: {
      scoreGt500Rate: Math.round((scoreGt500Count / trials.length) * 10000) / 100,
      enclosureEq0Rate: Math.round((encZeroCount / trials.length) * 10000) / 100,
      enclosureGe1Rate: Math.round((encGe1Count / trials.length) * 10000) / 100,
    },
    top10,
  };
}

async function main() {
  console.error(`[bench] Loading worker: ${WORKER_PATH}`);
  const gen = loadBoardWorker();
  if (typeof gen !== "function") {
    throw new Error("generatePairLinkPuzzle not found");
  }
  console.error(`[bench] 9 patterns × ${TRIALS_PER_CONFIG} trials = ${9 * TRIALS_PER_CONFIG} total\n`);

  const results = [];
  for (let i = 0; i < CONFIGS.length; i++) {
    const c = CONFIGS[i];
    console.error(`[bench] --- ${patternLabel(c)} ---`);
    results.push(await runConfig(gen, c, i));
  }

  const out = {
    results,
    generatedAt: new Date().toISOString(),
    totalTrials: 9 * TRIALS_PER_CONFIG,
    note: "Score閾値による破棄なし。Mutation完了・全マス埋まり・パス確定状態でスコア算出。",
  };
  const outPath = path.join(OUT_DIR, "pairlink_benchmark_9k_revised.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.error(`\n[bench] Done. Wrote ${outPath}`);
  return outPath;
}

main()
  .then((p) => {
    console.error(`[bench] Output: ${p}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
