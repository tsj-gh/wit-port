/**
 * Pair-link 盤面の ABC スコア計算
 * A: Detour Score (迂回率)
 * B: Enclosure Score (エンクロージャ数)
 * C: Junction Complexity (分岐の複雑性)
 */

export type Pair = { id: number; start: [number, number]; end: [number, number] };
export type PathPoint = { x: number; y: number };

export type ABCScore = {
  detourScore: number;
  enclosureScore: number;
  junctionComplexity: number;
};

/** 点が多角形の内側にあるか（ray casting） */
function pointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** パスからグリッドを構築（各セルの id） */
function buildGridFromPaths(
  n: number,
  pairs: Pair[],
  solutionPaths: Record<string, PathPoint[][]>
): number[][] {
  const grid = Array.from({ length: n }, () => Array(n).fill(0));
  for (const p of pairs) {
    const pathList = solutionPaths[String(p.id)];
    if (!pathList || pathList.length === 0) continue;
    const path = pathList[0];
    for (const pt of path) {
      const r = pt.y;
      const c = pt.x;
      if (r >= 0 && r < n && c >= 0 && c < n) {
        grid[r][c] = p.id;
      }
    }
  }
  return grid;
}

/**
 * ABC スコアを計算
 * @param pairs ペア定義
 * @param solutionPaths 正解の paths（id -> [path]）
 * @param gridSize グリッドサイズ
 */
export function computeABCScore(
  pairs: Pair[],
  solutionPaths: Record<string, PathPoint[][]>,
  gridSize: number
): ABCScore | null {
  const n = gridSize;

  // A. Detour Score
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
    const ratio = pathLen / Math.max(1, manhattan);
    detourSum += ratio;
    detourCount++;
  }
  const detourScore = detourCount > 0 ? detourSum / detourCount : 0;

  // B. Enclosure Score
  let enclosureCount = 0;
  for (const p of pairs) {
    const pathList = solutionPaths[String(p.id)];
    if (!pathList || pathList.length === 0) continue;
    const path = pathList[0];
    if (path.length < 3) continue;

    // パスを閉じて多角形にする
    const polygon = [...path.map((pt) => ({ x: pt.x, y: pt.y })), path[0]];

    for (const other of pairs) {
      if (other.id === p.id) continue;
      const [sr, sc] = other.start;
      const [er, ec] = other.end;
      if (pointInPolygon(sc, sr, polygon)) enclosureCount++;
      if (pointInPolygon(ec, er, polygon)) enclosureCount++;
    }
  }

  // C. Junction Complexity
  const grid = buildGridFromPaths(n, pairs, solutionPaths);
  let totalFalseBranches = 0;
  let totalCells = 0;
  const dirs: [number, number][] = [
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
        if (neighbourId !== 0 && neighbourId !== p.id) {
          falseBranches++;
        }
      }
      totalFalseBranches += falseBranches;
      totalCells++;
    }
  }

  const junctionComplexity = totalCells > 0 ? totalFalseBranches / totalCells : 0;

  return {
    detourScore,
    enclosureScore: enclosureCount,
    junctionComplexity,
  };
}

/** 統計: 最小・最大・平均・標準偏差 */
export function computeStats(values: number[]): {
  min: number;
  max: number;
  avg: number;
  std: number;
} {
  if (values.length === 0) return { min: 0, max: 0, avg: 0, std: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  return { min, max, avg, std };
}
