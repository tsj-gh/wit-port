#!/usr/bin/env node
/**
 * 6x6 5ペア Defaultでシード mn321dvk-cz0dws5va を生成し、
 * 現在の評価軸（computeMutationScoreBreakdown）でスコアを算出する。
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const WORKER_PATH = path.join(ROOT, "public", "workers", "board-worker.js");

function loadBoardWorker() {
  let code = fs.readFileSync(WORKER_PATH, "utf8");
  code = code.replace(/\r?\nself\.onmessage[\s\S]*$/m, "\nvoid 0;\n");
  const sandbox = {
    console: { log: (...a) => console.log(...a), error: () => {}, warn: () => {}, time: () => {}, timeEnd: () => {} },
    performance: { now: () => Date.now() },
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
  return sandbox;
}

function pathsToGridAndAdj(solutionPaths, pairs, n) {
  const grid = Array.from({ length: n }, () => Array(n).fill(0));
  const adj = Array.from({ length: n }, () => Array.from({ length: n }, () => []));
  const key = (r, c) => r * n + c;
  for (const p of pairs) {
    const pathList = solutionPaths[String(p.id)];
    if (!pathList || pathList.length === 0) continue;
    const path = pathList[0];
    for (const pt of path) {
      const r = pt.y;
      const c = pt.x;
      if (r >= 0 && r < n && c >= 0 && c < n) grid[r][c] = p.id;
    }
  }
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const pid = grid[r][c];
      if (!pid) continue;
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (grid[nr][nc] === pid) adj[r][c].push(key(nr, nc));
      }
    }
  }
  return { grid, adj };
}

function main() {
  const sandbox = loadBoardWorker();
  const gen = sandbox.generatePairLinkPuzzle;
  const computeMutationScoreBreakdown = sandbox.computeMutationScoreBreakdown;
  if (typeof gen !== "function" || typeof computeMutationScoreBreakdown !== "function") {
    throw new Error("Required functions not found in worker");
  }

  const gridSize = 6;
  const numPairs = 5;
  const seed = "mn321dvk-cz0dws5va";
  const config = { generationMode: "default" };

  const result = gen(gridSize, seed, numPairs, config);
  if (!result) {
    console.error("生成に失敗しました");
    process.exit(1);
  }

  const { pairs, solutionPaths } = result;
  if (!solutionPaths || !pairs) {
    console.error("solutionPaths または pairs がありません");
    process.exit(1);
  }

  const { grid, adj } = pathsToGridAndAdj(solutionPaths, pairs, gridSize);
  const scoreParams = sandbox.mergeEdgeSwapScoreParams ? sandbox.mergeEdgeSwapScoreParams({}) : {};
  const bd = computeMutationScoreBreakdown(grid, adj, gridSize, null, scoreParams);

  console.log("=== シード mn321dvk-cz0dws5va: 6x6 5ペア Default ===\n");
  console.log("■ 生成結果");
  console.log("  グリッド: " + gridSize + "x" + gridSize + ", ペア数: " + pairs.length);
  console.log("  シード: " + result.seed);
  console.log("");
  console.log("■ 現在の評価軸（computeMutationScoreBreakdown）");
  console.log("  Coverage:           " + bd.coverageScore.toFixed(2));
  console.log("  Coverage(重み付き): " + (bd.coverageWeighted != null ? bd.coverageWeighted.toFixed(2) : "—"));
  console.log("  Interference:       " + bd.interferenceScore);
  console.log("  Enclosures:         " + bd.enclosureCount);
  console.log("  AdjRate:            " + (bd.adjRate != null ? (bd.adjRate * 100).toFixed(1) : "—") + "%");
  console.log("  Dist2/Dist3:        " + (bd.adjCount ?? "—") + " / " + (bd.semiAdjCount ?? "—"));
  console.log("  AdjacencyPenalty:   " + (bd.adjacencyPenaltyApplied ?? 0));
  if (bd.straightPairRatio != null) console.log("  直線ペア割合:       " + (bd.straightPairRatio * 100).toFixed(1) + "%");
  if (bd.straightPenalty != null) console.log("  StraightPenalty:    " + bd.straightPenalty);
  if (bd.dominanceRatio != null) console.log("  上位2支配率:        " + (bd.dominanceRatio * 100).toFixed(1) + "%");
  if (bd.dominancePenalty != null) console.log("  DominancePenalty:   " + bd.dominancePenalty);
  console.log("");
  console.log("■ Total Score (finalScore): " + bd.finalScore);
}

main();
