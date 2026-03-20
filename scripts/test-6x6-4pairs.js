/**
 * 6x6 / 4ペア で10回生成テスト
 * node scripts/test-6x6-4pairs.js
 */
const { generatePairLinkPuzzle } = require("./board-gen-standalone");

function pointInPolygon(px, py, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y, xj = polygon[j].x, yj = polygon[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function computeABCScore(pairs, solutionPaths, gridSize) {
  const n = gridSize;
  let detourSum = 0, detourCount = 0;
  for (const p of pairs) {
    const pathList = solutionPaths[String(p.id)];
    if (!pathList || pathList.length === 0) continue;
    const path = pathList[0];
    const manhattan = Math.abs(p.start[0] - p.end[0]) + Math.abs(p.start[1] - p.end[1]);
    detourSum += path.length / Math.max(1, manhattan);
    detourCount++;
  }
  let enclosureCount = 0;
  for (const p of pairs) {
    const pathList = solutionPaths[String(p.id)];
    if (!pathList || pathList.length === 0 || pathList[0].length < 3) continue;
    const polygon = [...pathList[0].map((pt) => ({ x: pt.x, y: pt.y })), pathList[0][0]];
    for (const other of pairs) {
      if (other.id === p.id) continue;
      if (pointInPolygon(other.start[1], other.start[0], polygon)) enclosureCount++;
      if (pointInPolygon(other.end[1], other.end[0], polygon)) enclosureCount++;
    }
  }
  const grid = Array.from({ length: n }, () => Array(n).fill(0));
  for (const p of pairs) {
    const pathList = solutionPaths[String(p.id)];
    if (!pathList || pathList.length === 0) continue;
    for (const pt of pathList[0]) {
      if (pt.y >= 0 && pt.y < n && pt.x >= 0 && pt.x < n) grid[pt.y][pt.x] = p.id;
    }
  }
  let total = 0, cells = 0;
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const p of pairs) {
    const pathList = solutionPaths[String(p.id)];
    if (!pathList || pathList.length === 0) continue;
    for (const pt of pathList[0]) {
      let fb = 0;
      for (const [dr, dc] of dirs) {
        const nr = pt.y + dr, nc = pt.x + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n) {
          const id = grid[nr][nc];
          if (id !== 0 && id !== p.id) fb++;
        }
      }
      total += fb;
      cells++;
    }
  }
  return {
    detourScore: detourCount ? detourSum / detourCount : 0,
    enclosureScore: enclosureCount,
    junctionComplexity: cells ? total / cells : 0,
  };
}

const RUNS = 10;
const GRID_SIZE = 6;
const NUM_PAIRS = 4;

let success = 0;
const times = [];
let lastAbc = null;

console.log(`Testing ${GRID_SIZE}x${GRID_SIZE} / ${NUM_PAIRS} pairs, ${RUNS} runs...\n`);

for (let i = 0; i < RUNS; i++) {
  const t0 = performance.now();
  const result = generatePairLinkPuzzle(GRID_SIZE, undefined, NUM_PAIRS);
  const elapsed = Math.round(performance.now() - t0);

  if (result && result.solutionPaths && result.pairs) {
    success++;
    times.push(elapsed);
    lastAbc = computeABCScore(result.pairs, result.solutionPaths, result.gridSize);
    process.stdout.write(".");
  } else {
    process.stdout.write("x");
  }
}

console.log("\n");
console.log(`成功: ${success}/${RUNS}`);
console.log(`平均時間: ${times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0}ms`);
if (lastAbc) {
  console.log(`ABC (最終成功): A=${lastAbc.detourScore.toFixed(3)} B=${lastAbc.enclosureScore} C=${lastAbc.junctionComplexity.toFixed(3)}`);
}
