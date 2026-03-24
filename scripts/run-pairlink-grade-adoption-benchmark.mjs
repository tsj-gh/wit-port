#!/usr/bin/env node
/**
 * B案: G1〜G11 それぞれ「採用可能な1盤面」までを5回計測（本番 fetchOneForGrade と同一フィルタ、リトライ込み）。
 *
 * 1回分 = 壁時計で、Worker を何度呼んでもよいが、採用条件を満たす盤面（描画可能）が得られるまでの合計時間。
 * 採用条件: usePuzzleStockByGrade の fetchOneForGrade と同じ（囲い・スコア閾値・adjRate < 0.4）。
 *
 * 出力: グレードを「5回の平均採用時間」降順（遅い順）に並べた表 + JSON。
 *
 * 用法: node scripts/run-pairlink-grade-adoption-benchmark.mjs
 * 環境変数:
 *   SIM_OUT_DIR — JSON 出力先ディレクトリ（既定: リポジトリルート）
 *   BENCH_ADOPTIONS_PER_GRADE — グレードあたり採用回数（既定 5）
 *   BENCH_MAX_WORKER_CALLS_PER_ADOPTION — 1採用あたり Worker 呼び出し上限（既定 10000。本番の保険切替前は 1000 回だが、統計用には長めに取れる）
 *   BENCH_GRADE_MIN / BENCH_GRADE_MAX — この範囲のグレードだけ実行（既定 1〜11）
 *   BENCH_PROGRESS_EVERY_CALLS — 指定した Worker 呼び出しごとに進捗を stderr へ（既定 0 = 無効、例: 500）
 *
 * 定数 PAIR_LINK_* / GRADE_ADOPTION_MAX_ADJ_RATE は src/lib/pair-link-grade-constants.ts と同期すること。
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
const OUT_FILE = "pairlink_grade_adoption_benchmark_b.json";

const ADOPTIONS_PER_GRADE = Math.max(1, parseInt(String(process.env.BENCH_ADOPTIONS_PER_GRADE || "5"), 10) || 5);
const MAX_WORKER_CALLS_PER_ADOPTION = Math.max(
  1,
  parseInt(String(process.env.BENCH_MAX_WORKER_CALLS_PER_ADOPTION || "10000"), 10) || 10000
);
const GRADE_MIN = Math.max(1, parseInt(String(process.env.BENCH_GRADE_MIN || "1"), 10) || 1);
const GRADE_MAX = Math.min(11, parseInt(String(process.env.BENCH_GRADE_MAX || "11"), 10) || 11);
const PROGRESS_EVERY_CALLS = Math.max(0, parseInt(String(process.env.BENCH_PROGRESS_EVERY_CALLS || "0"), 10) || 0);

/** @typedef {{ type: 'any' } | { type: 'eq'; value: number } | { type: 'gte'; value: number }} GradeEnclosureRequirement */
/** @typedef {{ grade: number; size: number; pairs: number; enclosureReq: GradeEnclosureRequirement; scoreThreshold: number; theme: string }} PairLinkGradeDef */

/** pair-link-grade-constants.ts と同期 */
const GRADE_ADOPTION_MAX_ADJ_RATE = 0.4;

/** @type {PairLinkGradeDef[]} */
const PAIR_LINK_GRADE_CONSTANTS = [
  { grade: 1, size: 4, pairs: 3, enclosureReq: { type: "eq", value: 0 }, scoreThreshold: -1, theme: "【超入門】まずはつないでみよう" },
  { grade: 2, size: 4, pairs: 3, enclosureReq: { type: "gte", value: 1 }, scoreThreshold: 0, theme: "【導入】最短以外のルートを意識" },
  { grade: 3, size: 5, pairs: 4, enclosureReq: { type: "eq", value: 0 }, scoreThreshold: 100, theme: "【初級】空間を埋める楽しさ" },
  { grade: 4, size: 5, pairs: 4, enclosureReq: { type: "gte", value: 1 }, scoreThreshold: 400, theme: "【初級】回り込みの概念を知る" },
  { grade: 5, size: 6, pairs: 5, enclosureReq: { type: "eq", value: 0 }, scoreThreshold: 200, theme: "【中級】効率的なルート設計" },
  { grade: 6, size: 6, pairs: 5, enclosureReq: { type: "gte", value: 1 }, scoreThreshold: 800, theme: "【中級】回り込みを使いこなす" },
  { grade: 7, size: 7, pairs: 7, enclosureReq: { type: "eq", value: 0 }, scoreThreshold: 0, theme: "【難関への扉】高密度な盤面の整理" },
  { grade: 8, size: 8, pairs: 8, enclosureReq: { type: "eq", value: 0 }, scoreThreshold: 300, theme: "【上級】広い盤面でのルート俯瞰" },
  { grade: 9, size: 8, pairs: 9, enclosureReq: { type: "gte", value: 1 }, scoreThreshold: 1500, theme: "【特級】複雑な干渉を解き明かす" },
  { grade: 10, size: 9, pairs: 10, enclosureReq: { type: "gte", value: 1 }, scoreThreshold: 2500, theme: "【達人】AIが選んだ迷宮に挑む" },
  { grade: 11, size: 10, pairs: 10, enclosureReq: { type: "gte", value: 2 }, scoreThreshold: 4000, theme: "【神・隠し】極限の思考の先へ" },
];

const YIELD_EVERY_INNER = 20;

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

/**
 * @param {number | undefined} enc
 * @param {GradeEnclosureRequirement} req
 */
function matchesEnclosure(enc, req) {
  const count = enc ?? 0;
  switch (req.type) {
    case "any":
      return true;
    case "eq":
      return count === req.value;
    case "gte":
      return count >= req.value;
    default:
      return true;
  }
}

/**
 * fetchOneForGrade と同一の採用判定
 * @param {any} result
 * @param {PairLinkGradeDef} def
 */
function isAdopted(result, def) {
  if (!result || result.error || !result.numbers?.length) return false;
  const bd = result.postMutationScoreBreakdown;
  if (!bd) return false;
  const enclosureCount = bd.enclosureCount ?? 0;
  if (!matchesEnclosure(enclosureCount, def.enclosureReq)) return false;
  const score = bd.finalScore ?? -Infinity;
  if (def.scoreThreshold >= 0 && score < def.scoreThreshold) return false;
  const adjRate = typeof bd.adjRate === "number" ? bd.adjRate : NaN;
  if (!(adjRate < GRADE_ADOPTION_MAX_ADJ_RATE)) return false;
  return true;
}

/**
 * @param {any} gen
 * @param {PairLinkGradeDef} def
 * @param {number} adoptionIndex
 * @param {number} adoptionOrdinal 1-based（ログ用）
 */
async function measureOneAdoption(gen, def, adoptionIndex, adoptionOrdinal) {
  const t0 = performance.now();
  let workerCalls = 0;
  while (workerCalls < MAX_WORKER_CALLS_PER_ADOPTION) {
    if (workerCalls > 0 && workerCalls % YIELD_EVERY_INNER === 0) {
      await yieldEventLoop();
    }
    workerCalls++;
    if (PROGRESS_EVERY_CALLS > 0 && workerCalls % PROGRESS_EVERY_CALLS === 0) {
      const elapsed = Math.round((performance.now() - t0) * 100) / 100;
      console.error(
        `[bench-b]   G${def.grade} adoption ${adoptionOrdinal}/${ADOPTIONS_PER_GRADE}: ${workerCalls} worker calls, ${elapsed} ms elapsed (no adoption yet)`
      );
    }
    const seed = `benchB-g${def.grade}-a${adoptionIndex}-c${workerCalls}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const result = gen(def.size, seed, def.pairs, {
      generationMode: "edgeSwap",
      scoreThreshold: def.scoreThreshold >= 0 ? def.scoreThreshold : -1,
    });
    if (isAdopted(result, def)) {
      const wallMs = performance.now() - t0;
      return {
        wallMs: Math.round(wallMs * 100) / 100,
        workerCalls,
        seed: result.seed ?? seed,
      };
    }
  }
  return null;
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

async function main() {
  console.error(`[bench-b] Loading worker: ${WORKER_PATH}`);
  const gen = loadBoardWorker();
  if (typeof gen !== "function") {
    throw new Error("generatePairLinkPuzzle not found");
  }

  const gradesToRun = PAIR_LINK_GRADE_CONSTANTS.filter((g) => g.grade >= GRADE_MIN && g.grade <= GRADE_MAX);
  if (gradesToRun.length === 0) {
    throw new Error(`No grades in range BENCH_GRADE_MIN=${GRADE_MIN} .. BENCH_GRADE_MAX=${GRADE_MAX}`);
  }

  console.error(
    `[bench-b] ${gradesToRun.length} grades (G${GRADE_MIN}–G${GRADE_MAX}) × ${ADOPTIONS_PER_GRADE} adoptions | max ${MAX_WORKER_CALLS_PER_ADOPTION} worker calls / adoption\n`
  );

  /** @type {any[]} */
  const gradeRows = [];

  for (const def of gradesToRun) {
    const runs = [];
    for (let i = 0; i < ADOPTIONS_PER_GRADE; i++) {
      console.error(`[bench-b] G${def.grade} adoption ${i + 1}/${ADOPTIONS_PER_GRADE} ...`);
      const row = await measureOneAdoption(gen, def, i, i + 1);
      if (!row) {
        throw new Error(
          `G${def.grade} adoption ${i + 1}: 上限 ${MAX_WORKER_CALLS_PER_ADOPTION} 回で採用に至りませんでした（fetchOneForGrade 相当）`
        );
      }
      runs.push(row);
    }
    const wallMsList = runs.map((r) => r.wallMs);
    const workerCallsList = runs.map((r) => r.workerCalls);
    gradeRows.push({
      grade: def.grade,
      theme: def.theme,
      size: def.size,
      pairs: def.pairs,
      runs,
      wallMsTotal: Math.round(wallMsList.reduce((a, b) => a + b, 0) * 100) / 100,
      wallMsAvg: Math.round(mean(wallMsList) * 100) / 100,
      wallMsMin: Math.round(Math.min(...wallMsList) * 100) / 100,
      wallMsMax: Math.round(Math.max(...wallMsList) * 100) / 100,
      workerCallsAvg: Math.round(mean(workerCallsList) * 10) / 10,
    });
  }

  const sortedByAvgDesc = [...gradeRows].sort((a, b) => b.wallMsAvg - a.wallMsAvg);
  const sortedByTotalDesc = [...gradeRows].sort((a, b) => b.wallMsTotal - a.wallMsTotal);

  console.error("\n=== 平均採用時間（壁時計 ms）降順（遅いグレードが上）===\n");
  console.error(
    `grade | avgMs | totalMs(${ADOPTIONS_PER_GRADE}) | min | max | avgWorkerCalls\n` +
      sortedByAvgDesc
        .map(
          (r) =>
            `  G${String(r.grade).padStart(2)} | ${String(r.wallMsAvg).padStart(8)} | ${String(r.wallMsTotal).padStart(10)} | ${String(r.wallMsMin).padStart(6)} | ${String(r.wallMsMax).padStart(6)} | ${r.workerCallsAvg}`
        )
        .join("\n")
  );
  console.error("");

  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      definition:
        "1 adoption = wall-clock until first board passing fetchOneForGrade filters (enclosure, scoreThreshold, adjRate < GRADE_ADOPTION_MAX_ADJ_RATE), including all worker retries",
      adoptionsPerGrade: ADOPTIONS_PER_GRADE,
      maxWorkerCallsPerAdoption: MAX_WORKER_CALLS_PER_ADOPTION,
      gradeRange: { min: GRADE_MIN, max: GRADE_MAX },
      gradeAdoptionMaxAdjRate: GRADE_ADOPTION_MAX_ADJ_RATE,
      sortedByAvgWallMsDesc: sortedByAvgDesc.map((r) => r.grade),
      sortedByTotalWallMsDesc: sortedByTotalDesc.map((r) => r.grade),
    },
    grades: gradeRows,
    rankingByAvgWallMsDesc: sortedByAvgDesc,
  };

  const outPath = path.join(OUT_DIR, OUT_FILE);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.error(`[bench-b] Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
