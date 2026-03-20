/**
 * Pair-link 難易度調査スクリプト（一時的・調査用）
 * 本番コードは変更せず、board-worker のロジックを Node で実行可能な形で利用
 *
 * 実行: node scripts/investigate-abc.js
 */

const { generatePairLinkPuzzle } = require("./board-gen-standalone");

// ABC スコア計算（pair-link-abc-score.ts のロジックを JS で再実装）
function pointInPolygon(px, py, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function buildGridFromPaths(n, pairs, solutionPaths) {
  const grid = Array.from({ length: n }, () => Array(n).fill(0));
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
  return grid;
}

function computeABCScore(pairs, solutionPaths, gridSize) {
  const n = gridSize;
  let detourSum = 0;
  let detourCount = 0;
  for (const p of pairs) {
    const pathList = solutionPaths[String(p.id)];
    if (!pathList || pathList.length === 0) continue;
    const path = pathList[0];
    const pathLen = path.length;
    const [r1, c1] = p.start;
    const [r2, c2] = p.end;
    const manhattan = Math.abs(r1 - r2) + Math.abs(c1 - c2);
    detourSum += pathLen / Math.max(1, manhattan);
    detourCount++;
  }
  const detourScore = detourCount > 0 ? detourSum / detourCount : 0;

  let enclosureCount = 0;
  for (const p of pairs) {
    const pathList = solutionPaths[String(p.id)];
    if (!pathList || pathList.length === 0) continue;
    const path = pathList[0];
    if (path.length < 3) continue;
    const polygon = [...path.map((pt) => ({ x: pt.x, y: pt.y })), path[0]];
    for (const other of pairs) {
      if (other.id === p.id) continue;
      const [sr, sc] = other.start;
      const [er, ec] = other.end;
      if (pointInPolygon(sc, sr, polygon)) enclosureCount++;
      if (pointInPolygon(ec, er, polygon)) enclosureCount++;
    }
  }

  const grid = buildGridFromPaths(n, pairs, solutionPaths);
  let totalFalseBranches = 0;
  let totalCells = 0;
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  for (const p of pairs) {
    const pathList = solutionPaths[String(p.id)];
    if (!pathList || pathList.length === 0) continue;
    const path = pathList[0];
    for (const pt of path) {
      const r = pt.y;
      const c = pt.x;
      let falseBranches = 0;
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        const neighbourId = grid[nr][nc];
        if (neighbourId !== 0 && neighbourId !== p.id) falseBranches++;
      }
      totalFalseBranches += falseBranches;
      totalCells++;
    }
  }
  const junctionComplexity =
    totalCells > 0 ? totalFalseBranches / totalCells : 0;

  return { detourScore, enclosureScore: enclosureCount, junctionComplexity };
}

function computeStats(values) {
  if (values.length === 0)
    return { min: 0, max: 0, avg: 0, std: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  return { min, max, avg, std };
}

// --- メイン調査 ---
const GRID_SIZE = 6;
const RUNS = 100;

function runBaseline() {
  console.log("\n=== ベースライン: 100回生成 & ABC 分布 ===\n");
  const aVals = [];
  const bVals = [];
  const cVals = [];
  let success = 0;

  for (let i = 0; i < RUNS; i++) {
    const result = generatePairLinkPuzzle(GRID_SIZE);
    if (!result || !result.solutionPaths) continue;
    success++;
    const score = computeABCScore(
      result.pairs,
      result.solutionPaths,
      result.gridSize
    );
    aVals.push(score.detourScore);
    bVals.push(score.enclosureScore);
    cVals.push(score.junctionComplexity);
  }

  const aStat = computeStats(aVals);
  const bStat = computeStats(bVals);
  const cStat = computeStats(cVals);

  console.log(`成功率: ${success}/${RUNS} (${((success / RUNS) * 100).toFixed(1)}%)`);
  console.log(`A. Detour:     min=${aStat.min.toFixed(3)} max=${aStat.max.toFixed(3)} avg=${aStat.avg.toFixed(3)} std=${aStat.std.toFixed(3)}`);
  console.log(`B. Enclosure:  min=${bStat.min} max=${bStat.max} avg=${bStat.avg.toFixed(2)} std=${bStat.std.toFixed(2)}`);
  console.log(`C. Junction:   min=${cStat.min.toFixed(3)} max=${cStat.max.toFixed(3)} avg=${cStat.avg.toFixed(3)} std=${cStat.std.toFixed(3)}`);

  return { aVals, bVals, cVals, success };
}

function runTest1() {
  console.log("\n=== テスト1: Low Difficulty (Level 1) ===\n");
  console.log("目標: A < 1.2, B = 0（直線的・囲い込みなし）\n");

  let success = 0;
  const samples = [];

  for (let i = 0; i < RUNS; i++) {
    const result = generatePairLinkPuzzle(GRID_SIZE);
    if (!result || !result.solutionPaths) continue;
    const score = computeABCScore(
      result.pairs,
      result.solutionPaths,
      result.gridSize
    );
    if (score.detourScore < 1.2 && score.enclosureScore === 0) {
      success++;
      samples.push(score);
    }
  }

  console.log(`成功率: ${success}/${RUNS} (${((success / RUNS) * 100).toFixed(1)}%)`);
  if (samples.length > 0) {
    const a = samples.map((s) => s.detourScore);
    const b = samples.map((s) => s.enclosureScore);
    const c = samples.map((s) => s.junctionComplexity);
    console.log(`条件を満たした場合の実測: A avg=${(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3)}, B=${b[0]}, C avg=${(c.reduce((x,y)=>x+y,0)/c.length).toFixed(3)}`);
  }
  return success;
}

function runTest2() {
  console.log("\n=== テスト2: High Enclosure (Level 10) ===\n");
  console.log("目標: B > 10（全てのペアが他ペアを複雑に抱き込む）\n");

  let success = 0;
  const samples = [];

  for (let i = 0; i < RUNS; i++) {
    const result = generatePairLinkPuzzle(GRID_SIZE);
    if (!result || !result.solutionPaths) continue;
    const score = computeABCScore(
      result.pairs,
      result.solutionPaths,
      result.gridSize
    );
    if (score.enclosureScore > 10) {
      success++;
      samples.push(score);
    }
  }

  console.log(`成功率: ${success}/${RUNS} (${((success / RUNS) * 100).toFixed(1)}%)`);
  if (samples.length > 0) {
    const b = samples.map((s) => s.enclosureScore);
    console.log(`条件を満たした場合の B 実測: min=${Math.min(...b)} max=${Math.max(...b)} avg=${(b.reduce((x,y)=>x+y,0)/b.length).toFixed(1)}`);
  }
  return success;
}

function runTest3() {
  console.log("\n=== テスト3: High Junction (Level 10) ===\n");
  console.log("目標: C > 2.0（偽のルート・袋小路への分岐が多い）\n");

  let success = 0;
  const samples = [];

  for (let i = 0; i < RUNS; i++) {
    const result = generatePairLinkPuzzle(GRID_SIZE);
    if (!result || !result.solutionPaths) continue;
    const score = computeABCScore(
      result.pairs,
      result.solutionPaths,
      result.gridSize
    );
    if (score.junctionComplexity > 2.0) {
      success++;
      samples.push(score);
    }
  }

  console.log(`成功率: ${success}/${RUNS} (${((success / RUNS) * 100).toFixed(1)}%)`);
  if (samples.length > 0) {
    const c = samples.map((s) => s.junctionComplexity);
    console.log(`条件を満たした場合の C 実測: min=${Math.min(...c).toFixed(3)} max=${Math.max(...c).toFixed(3)} avg=${(c.reduce((x,y)=>x+y,0)/c.length).toFixed(3)}`);
  }
  return success;
}

console.log("Pair-link 難易度調査 (6x6, 100回/テスト)");
console.log("========================================");

runBaseline();
runTest1();
runTest2();
runTest3();

console.log("\n=== 調査完了 ===\n");
