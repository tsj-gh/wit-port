#!/usr/bin/env node
/**
 * Pair-link 9パターン × 1000回 = 9000回 生成統計（2026-03-24 仕様）
 * - Score閾値による破棄なし（scoreThreshold: -1）
 * - Mutation完了・全マス埋まり・パス確定後の postMutationScoreBreakdown でスコア算出
 *
 * 出力: simulation_results_2026_0324.json（既定はリポジトリルート）
 *
 * 用法: node scripts/run-pairlink-simulation-2026-0324.mjs
 * 環境変数: SIM_OUT_DIR, SIM_TRIALS (既定 1000), SIM_INCLUDE_ALL_TRIALS (既定 1, 0 で集計のみ)
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { performance } from "perf_hooks";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const WORKER_PATH = path.join(ROOT, "public", "workers", "board-worker.js");
const OUT_DIR = path.resolve(process.env.SIM_OUT_DIR || ROOT);
const OUT_FILE = "simulation_results_2026_0324.json";

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
const INCLUDE_ALL_TRIALS = String(process.env.SIM_INCLUDE_ALL_TRIALS ?? "1") !== "0";
const YIELD_EVERY = 5;
const PROGRESS_EVERY = 100;
const MAX_ATTEMPTS_PER_TRIAL = 500;

function yieldEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

function loadBoardWorker() {
  let code = fs.readFileSync(WORKER_PATH, "utf8");
  code = code.replace(/\r?\nself\.onmessage[\s\S]*$/m, "\nvoid 0;\n");
  const sandbox = {
    console: { log: () => {}, error: () => {}, warn: () => {}, time: () => {}, timeEnd: () => {} },
    performance,
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Error,
    TypeError,
    RangeError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    self: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.generatePairLinkPuzzle;
}

function countBends(path) {
  if (!path || path.length < 3) return 0;
  let bends = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1],
      cur = path[i],
      next = path[i + 1];
    const d1Horz = Math.abs(prev.x - cur.x) > 0;
    const d2Horz = Math.abs(cur.x - next.x) > 0;
    if (d1Horz !== d2Horz) bends++;
  }
  return bends;
}

function boardHashFromPairs(pairs) {
  const sorted = [...pairs].sort((a, b) => a.id - b.id);
  const flat = sorted
    .map((p) => `${p.id}:${p.start[0]},${p.start[1]}-${p.end[0]},${p.end[1]}`)
    .join("|");
  return crypto.createHash("sha256").update(flat, "utf8").digest("hex");
}

function runOneTrial(gen, size, pairs) {
  const seed = `sim0324-${size}x${size}_p${pairs}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const t0 = performance.now();
  const result = gen(size, seed, pairs, {
    generationMode: "edgeSwap",
    scoreThreshold: -1,
  });
  const genTimeMs = performance.now() - t0;
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
  const boardData = {
    seed: result.seed ?? seed,
    boardHash: boardHashFromPairs(result.pairs || []),
  };
  return {
    TotalScore: bd.finalScore,
    enclosureCount: bd.enclosureCount ?? 0,
    top2Share,
    totalBends,
    fillRate: Math.min(1, fillRate),
    pathLengths,
    genTimeMs: Math.round(genTimeMs * 100) / 100,
    boardData,
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

function trialToJson(t) {
  return {
    TotalScore: Math.round(t.TotalScore * 100) / 100,
    enclosureCount: t.enclosureCount,
    top2Share: Math.round(t.top2Share * 1000) / 1000,
    totalBends: t.totalBends,
    fillRate: Math.round(t.fillRate * 1000) / 1000,
    pathLengths: t.pathLengths,
    genTimeMs: t.genTimeMs,
    boardData: t.boardData,
  };
}

async function runConfig(gen, config, configIndex) {
  const { size, pairs } = config;
  const trials = [];
  let outerAttempts = 0;
  while (trials.length < TRIALS_PER_CONFIG) {
    if (outerAttempts % YIELD_EVERY === 0) await yieldEventLoop();
    outerAttempts++;
    if (outerAttempts > TRIALS_PER_CONFIG * MAX_ATTEMPTS_PER_TRIAL) {
      throw new Error(
        `Too many failed generations for ${patternLabel(config)} (got ${trials.length}/${TRIALS_PER_CONFIG})`
      );
    }
    const row = runOneTrial(gen, size, pairs);
    if (!row) continue;
    trials.push(row);
    if (trials.length % PROGRESS_EVERY === 0 || trials.length === TRIALS_PER_CONFIG) {
      console.error(
        `  [${configIndex + 1}/9] ${patternLabel(config)}: ${trials.length}/${TRIALS_PER_CONFIG} (100回ごと進捗)`
      );
    }
  }

  const scores = trials.map((t) => t.TotalScore);
  const positiveCount = trials.filter((t) => t.TotalScore > 0).length;
  const scoreGt500Count = trials.filter((t) => t.TotalScore > 500).length;
  const encZeroCount = trials.filter((t) => t.enclosureCount === 0).length;
  const encGe1Count = trials.filter((t) => t.enclosureCount >= 1).length;
  const genTimes = trials.map((t) => t.genTimeMs);

  const top10Summary = [...trials]
    .sort((a, b) => b.TotalScore - a.TotalScore)
    .slice(0, 10)
    .map((t) => ({
      Score: Math.round(t.TotalScore * 100) / 100,
      enclosureCount: t.enclosureCount,
      pathLengths: t.pathLengths,
      top2Share: Math.round(t.top2Share * 1000) / 1000,
      totalBends: t.totalBends,
      fillRate: Math.round(t.fillRate * 1000) / 1000,
      boardData: t.boardData,
    }));

  const base = {
    pattern: patternLabel(config),
    config: { size, pairs },
    /** TotalScore の基本統計 */
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
    top10Summary,
  };

  if (INCLUDE_ALL_TRIALS) {
    base.trials = trials.map(trialToJson);
  }

  return base;
}

async function main() {
  console.error(`[sim] Loading worker: ${WORKER_PATH}`);
  const gen = loadBoardWorker();
  if (typeof gen !== "function") {
    throw new Error("generatePairLinkPuzzle not found");
  }
  console.error(
    `[sim] 9 patterns × ${TRIALS_PER_CONFIG} trials = ${9 * TRIALS_PER_CONFIG} total | out: ${path.join(OUT_DIR, OUT_FILE)}\n`
  );

  const results = [];
  for (let i = 0; i < CONFIGS.length; i++) {
    const c = CONFIGS[i];
    console.error(`[sim] --- ${patternLabel(c)} ---`);
    results.push(await runConfig(gen, c, i));
  }

  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      totalTrials: 9 * TRIALS_PER_CONFIG,
      patterns: CONFIGS.length,
      trialsPerPattern: TRIALS_PER_CONFIG,
      scoreTiming: "postMutation_finalBoard",
      scoreThresholdApplied: false,
      note:
        "Score閾値による破棄なし（scoreThreshold:-1）。Mutation完了・全マス埋まり・パス確定状態の postMutationScoreBreakdown で算出。",
    },
    results,
  };
  const outPath = path.join(OUT_DIR, OUT_FILE);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.error(`\n[sim] Done. Wrote ${outPath}`);
  return outPath;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
