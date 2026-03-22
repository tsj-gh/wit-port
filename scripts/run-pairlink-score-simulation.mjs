/**
 * Pair-link 生成エンジン（board-worker.js）のスコア分布シミュレーション。
 * - 6 パターン × SIM_RUNS 回（既定 1000）を setImmediate でチャンク実行しイベントループを譲る
 * - 評価ロジックは board-worker 側のまま観測のみ（postMutationScoreBreakdown）
 *
 * 用法:
 *   node scripts/run-pairlink-score-simulation.mjs
 *   SIM_RUNS=50 node scripts/run-pairlink-score-simulation.mjs   # 短縮テスト
 *   SIM_OUT=./simulation_results.json node scripts/...
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";
import { performance } from "perf_hooks";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const WORKER_PATH = path.join(ROOT, "public", "workers", "board-worker.js");
const OUT_PATH = path.resolve(
  process.env.SIM_OUT || path.join(ROOT, "simulation_results.json")
);
const RUNS_PER_PATTERN = Math.max(
  1,
  parseInt(String(process.env.SIM_RUNS || "1000"), 10) || 1000
);
const YIELD_EVERY = Math.max(1, parseInt(String(process.env.SIM_YIELD_EVERY || "5"), 10) || 5);

const PATTERNS = [
  { label: "7x7_p7", boardSize: 7, pairs: 7 },
  { label: "7x7_p8", boardSize: 7, pairs: 8 },
  { label: "7x7_p9", boardSize: 7, pairs: 9 },
  { label: "8x8_p8", boardSize: 8, pairs: 8 },
  { label: "8x8_p9", boardSize: 8, pairs: 9 },
  { label: "8x8_p10", boardSize: 8, pairs: 10 },
];

function yieldEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

function loadBoardWorkerEngine() {
  let code = fs.readFileSync(WORKER_PATH, "utf8");
  code = code.replace(/\r?\nself\.onmessage[\s\S]*$/m, "\nvoid 0;\n");

  const sandbox = {
    console: {
      log() {},
      error() {},
      warn() {},
      time() {},
      timeEnd() {},
    },
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
    SyntaxError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    self: {},
  };

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const gen = sandbox.generatePairLinkPuzzle;
  if (typeof gen !== "function") {
    throw new Error(
      "generatePairLinkPuzzle not found on VM context after loading board-worker.js"
    );
  }
  return gen;
}

function makeBoardHash(pairs) {
  const sorted = [...pairs].sort((a, b) => a.id - b.id);
  const flat = sorted
    .map(
      (p) =>
        `${p.id}:${p.start[0]},${p.start[1]}-${p.end[0]},${p.end[1]}`
    )
    .join("|");
  return crypto.createHash("sha256").update(flat, "utf8").digest("hex");
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stddev(arr) {
  if (!arr.length) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) * (x - m))));
}

function percentileSorted(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(p * sorted.length) - 1)
  );
  return sorted[idx];
}

async function runOneTrial(generatePairLinkPuzzle, pattern, runIndex) {
  const maxAttempts = 12;
  for (let a = 0; a < maxAttempts; a++) {
    const seed = `sim-${pattern.label}-r${runIndex}-a${a}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    const result = generatePairLinkPuzzle(pattern.boardSize, seed, pattern.pairs, {
      generationMode: "edgeSwap",
    });
    if (!result || !result.postMutationScoreBreakdown) continue;
    const bd = result.postMutationScoreBreakdown;
    return {
      pattern: pattern.label,
      boardSize: pattern.boardSize,
      targetPairs: pattern.pairs,
      pairCount: result.pairCount,
      runIndex,
      seed: result.seed,
      totalScore: bd.finalScore,
      coverage: bd.coverageScore,
      interference: bd.interferenceScore,
      enclosures: bd.enclosureCount,
      adjRate: bd.adjRate,
      dist2: bd.adjCount,
      dist3: bd.semiAdjCount,
      generationTimeMs: result.totalMs,
      boardHash: makeBoardHash(result.pairs),
      interferenceEndpoint: bd.interferenceEndpoint,
      interferenceParallel: bd.interferenceParallel,
      adjacencyTierPenaltyRaw: bd.adjacencyTierPenaltyRaw,
      adjacencyPenaltyApplied: bd.adjacencyPenaltyApplied,
    };
  }
  return null;
}

async function main() {
  console.error(
    `[sim] Loading engine from ${WORKER_PATH}, ${RUNS_PER_PATTERN} runs × ${PATTERNS.length} patterns → ${OUT_PATH}`
  );
  const generatePairLinkPuzzle = loadBoardWorkerEngine();
  const trials = [];
  let done = 0;
  const total = PATTERNS.length * RUNS_PER_PATTERN;

  for (const pattern of PATTERNS) {
    for (let r = 0; r < RUNS_PER_PATTERN; r++) {
      if (done % YIELD_EVERY === 0) await yieldEventLoop();
      const row = await runOneTrial(generatePairLinkPuzzle, pattern, r);
      if (!row) {
        console.error(`[sim] FAILED trial ${pattern.label} run ${r} (no breakdown)`);
        process.exit(1);
      }
      trials.push(row);
      done++;
      if (done % 200 === 0 || done === total) {
        console.error(`[sim] progress ${done}/${total}`);
      }
    }
  }

  const scores = trials.map((t) => t.totalScore);
  const times = trials.map((t) => t.generationTimeMs);
  const adjRates = trials.map((t) => t.adjRate);
  const timesSorted = [...times].sort((a, b) => a - b);

  const overall = {
    trialCount: trials.length,
    expectedTrials: total,
    totalScore: {
      mean: mean(scores),
      median: median(scores),
      stddev: stddev(scores),
      max: scores.length ? Math.max(...scores) : 0,
      min: scores.length ? Math.min(...scores) : 0,
    },
    generationTimeMs: {
      max: times.length ? Math.max(...times) : 0,
      min: times.length ? Math.min(...times) : 0,
      mean: mean(times),
      p95: percentileSorted(timesSorted, 0.95),
    },
    adjRate: {
      mean: mean(adjRates),
    },
  };

  const top3ByTotalScore = [...trials]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 3)
    .map((t) => ({
      totalScore: t.totalScore,
      coverage: t.coverage,
      interference: t.interference,
      enclosures: t.enclosures,
      adjRate: t.adjRate,
      dist2: t.dist2,
      dist3: t.dist3,
      generationTimeMs: t.generationTimeMs,
      boardHash: t.boardHash,
      pattern: t.pattern,
      boardSize: t.boardSize,
      targetPairs: t.targetPairs,
      pairCount: t.pairCount,
      seed: t.seed,
    }));

  const output = {
    generatedAt: new Date().toISOString(),
    config: {
      runsPerPattern: RUNS_PER_PATTERN,
      patterns: PATTERNS,
      workerPath: path.relative(ROOT, WORKER_PATH),
    },
    overall,
    top3ByTotalScore,
    trials,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8");
  console.error(`[sim] Wrote ${trials.length} trials to ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
