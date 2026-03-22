/**
 * Pair-link 生成統計（6 パターン × SIM_RUNS、既定 1000）。
 * スコアは Final Board 時点（postMutationScoreBreakdown = クロール後再計算）。
 *
 * 出力: パターンごと simulation_results_{N}x{N}_p{M}_fixed.json（既定はリポジトリルート）
 *
 * 用法:
 *   npm run sim:pairlink-scores
 *   SIM_RUNS=50 node scripts/run-pairlink-score-simulation.mjs
 *   SIM_OUT_DIR=./out node scripts/run-pairlink-score-simulation.mjs
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
const OUT_DIR = path.resolve(process.env.SIM_OUT_DIR || ROOT);
const RUNS_PER_PATTERN = Math.max(
  1,
  parseInt(String(process.env.SIM_RUNS || "1000"), 10) || 1000
);
const YIELD_EVERY = Math.max(1, parseInt(String(process.env.SIM_YIELD_EVERY || "5"), 10) || 5);
const PROGRESS_EVERY = Math.max(
  1,
  parseInt(String(process.env.SIM_PROGRESS_EVERY || "100"), 10) || 100
);

const PATTERNS = [
  { label: "7x7_p7", boardSize: 7, pairs: 7 },
  { label: "7x7_p8", boardSize: 7, pairs: 8 },
  { label: "7x7_p9", boardSize: 7, pairs: 9 },
  { label: "8x8_p8", boardSize: 8, pairs: 8 },
  { label: "8x8_p9", boardSize: 8, pairs: 9 },
  { label: "8x8_p10", boardSize: 8, pairs: 10 },
];

function patternFileKey(p) {
  return `${p.boardSize}x${p.boardSize}_p${p.pairs}`;
}

function patternDisplayName(p) {
  return `${p.boardSize}x${p.boardSize}_Pairs${p.pairs}`;
}

function outputFilename(p) {
  return `simulation_results_${p.boardSize}x${p.boardSize}_p${p.pairs}_fixed.json`;
}

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

function basicStats(values) {
  if (!values.length) {
    return { mean: 0, median: 0, stddev: 0, max: 0, min: 0 };
  }
  return {
    mean: mean(values),
    median: median(values),
    stddev: stddev(values),
    max: Math.max(...values),
    min: Math.min(...values),
  };
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
      patternKey: patternFileKey(pattern),
      boardSize: pattern.boardSize,
      targetPairs: pattern.pairs,
      pairCount: result.pairCount,
      runIndex,
      seed: result.seed,
      scoreTiming: "finalBoard",
      totalScore: bd.finalScore,
      coverage: bd.coverageScore,
      interference: bd.interferenceScore,
      enclosures: bd.enclosureCount,
      adjRate: bd.adjRate,
      dist2: bd.adjCount,
      dist3: bd.semiAdjCount,
      generationTimeMs: result.totalMs,
      boardHash: makeBoardHash(result.pairs),
    };
  }
  return null;
}

function buildPatternReport(pattern, trials) {
  const scores = trials.map((t) => t.totalScore);
  const times = trials.map((t) => t.generationTimeMs);
  const timesSorted = [...times].sort((a, b) => a - b);

  const countScoreGt500 = trials.filter((t) => t.totalScore > 500).length;
  const countEncGe1 = trials.filter((t) => t.enclosures >= 1).length;
  const n = trials.length;

  const top5ByTotalScore = [...trials]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5)
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
      runIndex: t.runIndex,
      seed: t.seed,
      pairCount: t.pairCount,
    }));

  return {
    generatedAt: new Date().toISOString(),
    pattern: patternDisplayName(pattern),
    patternLabel: pattern.label,
    patternKey: patternFileKey(pattern),
    boardSize: pattern.boardSize,
    targetPairs: pattern.pairs,
    scoreTiming: "finalBoard",
    config: {
      runsPerPattern: RUNS_PER_PATTERN,
      workerPath: path.relative(ROOT, WORKER_PATH),
    },
    basicStatistics: {
      totalScore: basicStats(scores),
    },
    generationEfficiency: {
      timeMs: {
        mean: mean(times),
        p95: percentileSorted(timesSorted, 0.95),
      },
    },
    qualityDistribution: {
      totalScoreGreaterThan500Percent:
        n > 0 ? (100 * countScoreGt500) / n : 0,
      enclosuresAtLeast1Percent: n > 0 ? (100 * countEncGe1) / n : 0,
    },
    top5ByTotalScore,
    trialCount: n,
    trials,
  };
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.error(
    `[sim] Engine: ${WORKER_PATH}\n[sim] ${RUNS_PER_PATTERN} runs × ${PATTERNS.length} patterns → ${OUT_DIR}/simulation_results_{N}x{N}_p{M}_fixed.json\n[sim] Score: Final Board (post crawl)`
  );

  const generatePairLinkPuzzle = loadBoardWorkerEngine();
  let globalDone = 0;
  const globalTotal = PATTERNS.length * RUNS_PER_PATTERN;

  for (const pattern of PATTERNS) {
    const trials = [];
    const name = patternDisplayName(pattern);
    console.error(`[sim] --- start ${name} (${RUNS_PER_PATTERN} trials) ---`);

    for (let r = 0; r < RUNS_PER_PATTERN; r++) {
      if (globalDone % YIELD_EVERY === 0) await yieldEventLoop();
      const row = await runOneTrial(generatePairLinkPuzzle, pattern, r);
      if (!row) {
        console.error(`[sim] FAILED ${pattern.label} run ${r}`);
        process.exit(1);
      }
      trials.push(row);
      globalDone++;

      const withinPattern = r + 1;
      if (
        withinPattern % PROGRESS_EVERY === 0 ||
        withinPattern === RUNS_PER_PATTERN
      ) {
        console.error(
          `[sim] progress ${name}: ${withinPattern}/${RUNS_PER_PATTERN} | global ${globalDone}/${globalTotal}`
        );
      }
    }

    const report = buildPatternReport(pattern, trials);
    const outPath = path.join(OUT_DIR, outputFilename(pattern));
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
    console.error(`[sim] wrote ${trials.length} trials → ${outPath}`);
  }

  console.error(`[sim] done. All ${globalTotal} trials across ${PATTERNS.length} files.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
