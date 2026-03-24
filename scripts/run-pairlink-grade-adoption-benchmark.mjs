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
 *   BENCH_MAX_WORKER_CALLS_PER_ADOPTION — 1採用あたり Worker 呼び出し上限（既定 1000。上限まで採用できなければ当該回の wallMs は NaN／JSON では "NaN"、グレード平均も NaN 扱いでランキング最遅）
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
  parseInt(String(process.env.BENCH_MAX_WORKER_CALLS_PER_ADOPTION || "1000"), 10) || 1000
);
const GRADE_MIN = Math.max(1, parseInt(String(process.env.BENCH_GRADE_MIN || "1"), 10) || 1);
const GRADE_MAX = Math.min(11, parseInt(String(process.env.BENCH_GRADE_MAX || "11"), 10) || 11);
const PROGRESS_EVERY_CALLS = Math.max(0, parseInt(String(process.env.BENCH_PROGRESS_EVERY_CALLS || "0"), 10) || 0);

/** @typedef {{ type: 'any' } | { type: 'eq'; value: number } | { type: 'gte'; value: number } | { type: 'lte'; value: number }} GradeEnclosureRequirement */
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
  { grade: 7, size: 7, pairs: 7, enclosureReq: { type: "lte", value: 1 }, scoreThreshold: 0, theme: "【難関への扉】高密度な盤面の整理" },
  { grade: 8, size: 8, pairs: 8, enclosureReq: { type: "lte", value: 1 }, scoreThreshold: 300, theme: "【上級】広い盤面でのルート俯瞰" },
  { grade: 9, size: 8, pairs: 9, enclosureReq: { type: "gte", value: 2 }, scoreThreshold: 1500, theme: "【特級】複雑な干渉を解き明かす" },
  { grade: 10, size: 9, pairs: 10, enclosureReq: { type: "gte", value: 1 }, scoreThreshold: 2500, theme: "【達人】AIが選んだ迷宮に挑む" },
  { grade: 11, size: 10, pairs: 10, enclosureReq: { type: "gte", value: 2 }, scoreThreshold: 3500, theme: "【神・隠し】極限の思考の先へ" },
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
    case "lte":
      return count <= req.value;
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
        failed: false,
      };
    }
  }
  console.error(
    `[bench-b]   G${def.grade} adoption ${adoptionOrdinal}/${ADOPTIONS_PER_GRADE}: 上限 ${MAX_WORKER_CALLS_PER_ADOPTION} 回で未採用 → wallMs=NaN（測定不能）として続行`
  );
  return {
    wallMs: NaN,
    workerCalls: MAX_WORKER_CALLS_PER_ADOPTION,
    seed: null,
    failed: true,
  };
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** JSON では NaN を "NaN" 文字列として出す（仕様上 number の NaN は無効のため） */
function jsonReplacer(_key, value) {
  return typeof value === "number" && Number.isNaN(value) ? "NaN" : value;
}

/** グレード並び: 平均が NaN（いずれかの回が測定不能）を最遅。同格は失敗回数多い方を上、さらにグレード番号大きい方を上 */
function compareGradeByAvgDesc(a, b) {
  const aNaN = a.failedAdoptions > 0;
  const bNaN = b.failedAdoptions > 0;
  if (aNaN !== bNaN) return aNaN ? -1 : 1;
  if (aNaN && bNaN) {
    if (b.failedAdoptions !== a.failedAdoptions) return b.failedAdoptions - a.failedAdoptions;
    return b.grade - a.grade;
  }
  if (b.wallMsAvg !== a.wallMsAvg) return b.wallMsAvg - a.wallMsAvg;
  return b.grade - a.grade;
}

function compareGradeByTotalDesc(a, b) {
  const aNaN = a.failedAdoptions > 0;
  const bNaN = b.failedAdoptions > 0;
  if (aNaN !== bNaN) return aNaN ? -1 : 1;
  if (aNaN && bNaN) {
    if (b.failedAdoptions !== a.failedAdoptions) return b.failedAdoptions - a.failedAdoptions;
    return b.grade - a.grade;
  }
  if (b.wallMsTotal !== a.wallMsTotal) return b.wallMsTotal - a.wallMsTotal;
  return b.grade - a.grade;
}

function fmtMsCell(v) {
  return typeof v === "number" && Number.isNaN(v) ? "     NaN" : String(v).padStart(8);
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
      runs.push(row);
    }
    const failedAdoptions = runs.filter((r) => r.failed).length;
    const okWallMs = runs.filter((r) => !r.failed).map((r) => r.wallMs);
    const workerCallsList = runs.map((r) => r.workerCalls);
    const anyFailed = failedAdoptions > 0;
    gradeRows.push({
      grade: def.grade,
      theme: def.theme,
      size: def.size,
      pairs: def.pairs,
      runs,
      failedAdoptions,
      wallMsTotal: anyFailed
        ? NaN
        : Math.round(okWallMs.reduce((a, b) => a + b, 0) * 100) / 100,
      wallMsAvg: anyFailed ? NaN : Math.round(mean(okWallMs) * 100) / 100,
      wallMsMin: anyFailed ? NaN : Math.round(Math.min(...okWallMs) * 100) / 100,
      wallMsMax: anyFailed ? NaN : Math.round(Math.max(...okWallMs) * 100) / 100,
      workerCallsAvg: Math.round(mean(workerCallsList) * 10) / 10,
    });
  }

  const sortedByAvgDesc = [...gradeRows].sort(compareGradeByAvgDesc);
  const sortedByTotalDesc = [...gradeRows].sort(compareGradeByTotalDesc);

  console.error("\n=== 平均採用時間（壁時計 ms）降順（NaN=測定不能は最遅扱い）===\n");
  console.error(
    `grade | avgMs | totalMs(${ADOPTIONS_PER_GRADE}) | min | max | fails | avgWorkerCalls\n` +
      sortedByAvgDesc
        .map(
          (r) =>
            `  G${String(r.grade).padStart(2)} | ${fmtMsCell(r.wallMsAvg)} | ${fmtMsCell(r.wallMsTotal)} | ${fmtMsCell(r.wallMsMin)} | ${fmtMsCell(r.wallMsMax)} | ${String(r.failedAdoptions).padStart(5)} | ${r.workerCallsAvg}`
        )
        .join("\n")
  );
  console.error("");

  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      definition:
        "1 adoption = wall-clock until first board passing fetchOneForGrade filters (enclosure, scoreThreshold, adjRate < GRADE_ADOPTION_MAX_ADJ_RATE), including all worker retries",
      nanPolicy:
        "If max worker calls reached without adoption, that run's wallMs is NaN (JSON string \"NaN\"). Grade aggregates avg/total/min/max become NaN if any run failed. Ranking treats NaN grades as slowest; tie-break by failedAdoptions desc then grade desc.",
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
  fs.writeFileSync(outPath, JSON.stringify(out, jsonReplacer, 2), "utf8");
  console.error(`[bench-b] Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
