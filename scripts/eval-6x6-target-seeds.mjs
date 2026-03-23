#!/usr/bin/env node
/**
 * 6x6 5ペア Default で target seeds を評価し、高スコアにするための提案材料を収集。
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const WORKER_PATH = path.join(ROOT, "public", "workers", "board-worker.js");

const TARGET_SEEDS = ["mn321dvk-cz0dws5va", "mn32eext-2pj99sayi"];

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
  return sandbox;
}

function pathsToGridAndAdj(solutionPaths, pairs, n) {
  const grid = Array.from({ length: n }, () => Array(n).fill(0));
  const adj = Array.from({ length: n }, () => Array.from({ length: n }, () => []));
  const key = (r, c) => r * n + c;
  for (const p of pairs) {
    const pathList = solutionPaths[String(p.id)];
    if (!pathList || pathList.length === 0) continue;
    for (const pt of pathList[0]) {
      const r = pt.y, c = pt.x;
      if (r >= 0 && r < n && c >= 0 && c < n) grid[r][c] = p.id;
    }
  }
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const pid = grid[r][c];
    if (!pid) continue;
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n && grid[nr][nc] === pid) adj[r][c].push(key(nr, nc));
    }
  }
  return { grid, adj };
}

function extraMetrics(pairs, solutionPaths) {
  const pathLens = [];
  let detourSum = 0;
  let manhattanSum = 0;
  for (const p of pairs) {
    const pl = solutionPaths[String(p.id)]?.[0];
    if (!pl) continue;
    const len = pl.length;
    pathLens.push(len);
    const [r1, c1] = p.start, [r2, c2] = p.end;
    const manhattan = Math.abs(r1 - r2) + Math.abs(c1 - c2);
    detourSum += len / Math.max(1, manhattan);
    manhattanSum += manhattan;
  }
  pathLens.sort((a, b) => b - a);
  const top2 = (pathLens[0] || 0) + (pathLens[1] || 0);
  const nn = 36;
  return { pathLens, top2, top2Ratio: top2 / nn, detourAvg: detourSum / pathLens.length, manhattanSum };
}

function main() {
  const sandbox = loadBoardWorker();
  const gen = sandbox.generatePairLinkPuzzle;
  const computeMutationScoreBreakdown = sandbox.computeMutationScoreBreakdown;
  const spDefaults = sandbox.mergeEdgeSwapScoreParams?.({}) ?? {};

  console.log("=== 6x6 5ペア target seeds 評価 ===\n");

  for (const seed of TARGET_SEEDS) {
    const result = gen(6, seed, 5, { generationMode: "default" });
    if (!result?.solutionPaths || !result?.pairs) {
      console.log("[" + seed + "] 生成失敗\n");
      continue;
    }
    const { grid, adj } = pathsToGridAndAdj(result.solutionPaths, result.pairs, 6);
    const bd = computeMutationScoreBreakdown(grid, adj, 6, null, spDefaults);
    const ext = extraMetrics(result.pairs, result.solutionPaths);

    console.log("■ シード: " + seed);
    console.log("  Coverage: " + bd.coverageScore.toFixed(2) + ", Interference: " + bd.interferenceScore);
    console.log("  Enclosures: " + bd.enclosureCount + ", AdjRate: " + (bd.adjRate * 100).toFixed(1) + "%");
    console.log("  AdjacencyPenalty: " + bd.adjacencyPenaltyApplied);
    console.log("  StraightPenalty: " + (bd.straightPenalty ?? 0) + ", DominancePenalty: " + (bd.dominancePenalty ?? 0));
    console.log("  EnclosureBonus: " + (bd.enclosureBonus ?? 0));
    console.log("  経路長: " + ext.pathLens.join(",") + " → 上位2合計 " + ext.top2 + " / 36 (" + (ext.top2Ratio * 100).toFixed(1) + "%)");
    console.log("  迂回率平均: " + ext.detourAvg.toFixed(2) + ", マンハッタン合計: " + ext.manhattanSum);
    console.log("  → finalScore: " + bd.finalScore);
    console.log("");
  }
}

main();
