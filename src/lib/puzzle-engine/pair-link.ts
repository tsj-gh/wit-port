/**
 * ペアリンク（ナンバーリンク）パズルエンジン（サーバー専用）
 * クライアントには一切エクスポートしない
 */

export type Pair = { id: number; start: [number, number]; end: [number, number] };

export type NumberCell = { x: number; y: number; val: number; color: string };

export type PuzzleResult = {
  numbers: NumberCell[];
  pairs: Pair[];
  gridSize: number;
  pairCount: number;
  profile?: GenerationProfile;
  /** 完成までに要した試行回数（再試行ループ） */
  attempts?: number;
  /** 生成開始から終了までの全体所要時間（ms） */
  totalMs?: number;
};

/** 工程別の所要時間（ms）デバッグ用 */
export type GenerationProfile = Record<string, number>;

const COLORS = [
  "#ff4757", "#2e86de", "#2ed573", "#ffa502", "#a29bfe",
  "#e17055", "#00cec9", "#6c5ce7", "#fdcb6e",
];

function getPairCount(gridSize: number): number {
  switch (gridSize) {
    case 4: return 3;
    case 6: return 5;
    case 8: return 7;
    case 10:
    default: return 9;
  }
}

function countSolutions(
  grid: number[][],
  pairs: Pair[],
  pairIndex: number,
  maxSolutions: number,
  stats: { nodes: number; nodeLimit: number }
): number {
  const n = grid.length;
  if (pairIndex === pairs.length) {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (grid[r][c] === 0) return 0;
      }
    }
    return 1;
  }

  const pair = pairs[pairIndex];
  const id = pair.id;
  const [sr, sc] = pair.start;
  const [tr, tc] = pair.end;

  const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }

  let solutions = 0;
  const visited = Array.from({ length: n }, () => Array(n).fill(false));

  function dfs(r: number, c: number): void {
    if (solutions >= maxSolutions) return;
    stats.nodes++;
    if (stats.nodes > stats.nodeLimit) return;

    if (r === tr && c === tc) {
      solutions += countSolutions(grid, pairs, pairIndex + 1, maxSolutions - solutions, stats);
      return;
    }

    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      const cell = grid[nr][nc];
      if (!((nr === tr && nc === tc) || cell === 0)) continue;
      if (visited[nr][nc]) continue;

      visited[nr][nc] = true;
      const prev = grid[nr][nc];
      if (!(nr === tr && nc === tc)) grid[nr][nc] = id;

      dfs(nr, nc);

      grid[nr][nc] = prev;
      visited[nr][nc] = false;
      if (solutions >= maxSolutions) return;
    }
  }

  visited[sr][sc] = true;
  dfs(sr, sc);
  visited[sr][sc] = false;

  return solutions;
}

function solveSat(
  numVars: number,
  clauses: number[][],
  timeLimitMs: number
): Int8Array | null {
  const assignment = new Int8Array(numVars + 1);
  const start = performance.now();

  function unitProp(): boolean {
    while (true) {
      let changed = false;
      for (let ci = 0; ci < clauses.length; ci++) {
        const clause = clauses[ci];
        let satisfied = false;
        let unassignedCount = 0;
        let lastUnassigned = 0;

        for (let k = 0; k < clause.length; k++) {
          const lit = clause[k];
          const v = lit > 0 ? lit : -lit;
          const val = assignment[v];
          if (val === 0) {
            unassignedCount++;
            lastUnassigned = lit;
          } else {
            const isTrue = (val === 1 && lit > 0) || (val === -1 && lit < 0);
            if (isTrue) { satisfied = true; break; }
          }
        }

        if (!satisfied) {
          if (unassignedCount === 0) return false;
          if (unassignedCount === 1) {
            const lit = lastUnassigned;
            const v = lit > 0 ? lit : -lit;
            const val = lit > 0 ? 1 : -1;
            if (assignment[v] === 0) {
              assignment[v] = val as 0 | 1 | -1;
              changed = true;
            } else if (assignment[v] !== val) return false;
          }
        }
      }
      if (!changed) return true;
    }
  }

  function chooseVar(): number {
    for (let v = 1; v <= numVars; v++) {
      if (assignment[v] === 0) return v;
    }
    return 0;
  }

  function dpll(): boolean | null {
    if (performance.now() - start > timeLimitMs) return null;
    if (!unitProp()) return false;

    const v = chooseVar();
    if (v === 0) return true;

    const saved = assignment.slice();
    assignment[v] = 1;
    let res = dpll();
    if (res === true) return true;
    if (res === null) return null;

    assignment.set(saved);
    assignment[v] = -1;
    res = dpll();
    if (res === true) return true;
    if (res === null) return null;

    assignment.set(saved);
    return false;
  }

  const ok = dpll();
  return ok === true ? assignment : null;
}

function computeDegreesAndEndpoints(grid: number[][]): {
  deg: number[][];
  endpointsPerId: Map<number, { r: number; c: number }[]>;
  filled: number;
} {
  const n = grid.length;
  const deg = Array.from({ length: n }, () => Array(n).fill(0));
  let filled = 0;

  const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const id = grid[r][c];
      if (!id) continue;
      filled++;
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (grid[nr][nc] === id) deg[r][c]++;
      }
    }
  }

  const endpointsPerId = new Map<number, { r: number; c: number }[]>();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const id = grid[r][c];
      if (!id) continue;
      if (deg[r][c] === 1 || deg[r][c] === 0) {
        if (!endpointsPerId.has(id)) endpointsPerId.set(id, []);
        endpointsPerId.get(id)!.push({ r, c });
      }
    }
  }

  return { deg, endpointsPerId, filled };
}

function evaluateForestGrid(grid: number[][]): number {
  const n = grid.length;
  let score = 0;
  let filled = 0;
  let emptyIsolatedPenalty = 0;
  const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c]) {
        filled++;
      } else {
        let emptyNeighbors = 0;
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
          if (!grid[nr][nc]) emptyNeighbors++;
        }
        if (emptyNeighbors <= 1) emptyIsolatedPenalty += 5;
      }
    }
  }

  score += filled * 10;
  score -= emptyIsolatedPenalty;
  return score;
}

function generateFullCoverByBeam(gridSize: number, pairCount: number): number[][] | null {
  const n = gridSize;
  const beamWidth = 20;
  const maxSteps = n * n * 8;

  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push({ r, c });
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const initGrid = Array.from({ length: n }, () => Array(n).fill(0));
  for (let id = 1; id <= pairCount; id++) {
    const cell = cells[id - 1];
    initGrid[cell.r][cell.c] = id;
  }

  let beam: { grid: number[][]; score: number }[] = [
    { grid: initGrid, score: evaluateForestGrid(initGrid) },
  ];
  const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (let step = 0; step < maxSteps; step++) {
    for (const state of beam) {
      const { endpointsPerId, filled } = computeDegreesAndEndpoints(state.grid);
      if (filled === n * n) {
        let ok = true;
        for (let id = 1; id <= pairCount; id++) {
          let hasCell = false;
          for (let r = 0; r < n && !hasCell; r++)
            for (let c = 0; c < n; c++)
              if (state.grid[r][c] === id) { hasCell = true; break; }
          const eps = endpointsPerId.get(id) || [];
          if (!hasCell || eps.length < 2) { ok = false; break; }
        }
        if (ok) return state.grid;
      }
    }

    const nextStates: { grid: number[][]; score: number }[] = [];

    for (const state of beam) {
      const { endpointsPerId } = computeDegreesAndEndpoints(state.grid);

      for (let id = 1; id <= pairCount; id++) {
        const endpoints = endpointsPerId.get(id) || [];
        for (const ep of endpoints) {
          for (const [dr, dc] of dirs) {
            const nr = ep.r + dr, nc = ep.c + dc;
            if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
            if (state.grid[nr][nc] !== 0) continue;

            const newGrid = state.grid.map(row => row.slice());
            newGrid[nr][nc] = id;

            nextStates.push({ grid: newGrid, score: evaluateForestGrid(newGrid) });
          }
        }
      }
    }

    if (nextStates.length === 0) break;

    nextStates.sort((a, b) => b.score - a.score);
    beam = nextStates.slice(0, beamWidth);
  }

  return null;
}

function generateCandidate6x6(
  gridSize: number,
  pairCount: number,
  profile?: GenerationProfile
): {
  grid: number[][];
  pairs: Pair[];
  difficultyScore: number;
} | null {
  const n = gridSize;
  let t0 = performance.now();
  const forestGrid = generateFullCoverByBeam(n, pairCount);
  if (profile) profile.BeamSearch = Math.round(performance.now() - t0);
  if (!forestGrid) return null;

  t0 = performance.now();
  const pairs: Pair[] = [];
  const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (let id = 1; id <= pairCount; id++) {
    const cells: { r: number; c: number }[] = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (forestGrid[r][c] === id) cells.push({ r, c });
      }
    }
    if (!cells.length) return null;

    const deg = Array.from({ length: n }, () => Array(n).fill(0));
    for (const { r, c } of cells) {
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (forestGrid[nr][nc] === id) deg[r][c]++;
      }
    }

    const endpoints = cells.filter(({ r, c }) => deg[r][c] === 1 || deg[r][c] === 0);
    if (endpoints.length < 2) return null;

    pairs.push({ id, start: [endpoints[0].r, endpoints[0].c], end: [endpoints[1].r, endpoints[1].c] });
  }

  const solveGrid = Array.from({ length: n }, () => Array(n).fill(0));
  pairs.forEach(p => {
    solveGrid[p.start[0]][p.start[1]] = p.id;
    solveGrid[p.end[0]][p.end[1]] = p.id;
  });
  if (profile) profile.ExtractPairs = Math.round(performance.now() - t0);

  t0 = performance.now();
  const stats = { nodes: 0, nodeLimit: n * n * pairCount * 40 };
  const solCount = countSolutions(solveGrid, pairs, 0, 2, stats);
  if (profile) profile.UniqueCheck = Math.round(performance.now() - t0);
  if (solCount !== 1) return null;

  return { grid: forestGrid, pairs, difficultyScore: stats.nodes };
}

function generateCandidate8x8(
  gridSize: number,
  pairCount: number,
  profile?: GenerationProfile
): { grid: null; pairs: Pair[]; difficultyScore: number } | null {
  const n = gridSize;
  let t0 = performance.now();
  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push({ r, c });
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const terminals: { id: number; r1: number; c1: number; r2: number; c2: number }[] = [];
  const isTerminal = Array.from({ length: n }, () => Array(n).fill(false));
  let idx = 0;

  for (let id = 1; id <= pairCount; id++) {
    if (idx + 1 >= cells.length) return null;
    const c1 = cells[idx++];
    const c2 = cells[idx++];
    terminals.push({ id, r1: c1.r, c1: c1.c, r2: c2.r, c2: c2.c });
    isTerminal[c1.r][c1.c] = true;
    isTerminal[c2.r][c2.c] = true;
  }
  if (profile) profile.InitTerminals = Math.round(performance.now() - t0);

  t0 = performance.now();
  const vertCount = (n - 1) * n;
  const horizCount = n * (n - 1);
  const edgeOffset = 0;
  const edgeHOffset = vertCount;
  const labelOffset = vertCount + horizCount;

  const vertEdgeVar = (i: number, j: number) => edgeOffset + (i * n + j) + 1;
  const horizEdgeVar = (i: number, j: number) => edgeHOffset + (i * (n - 1) + j) + 1;
  const labelVar = (i: number, j: number, a: number) =>
    labelOffset + ((i * n + j) * pairCount + (a - 1)) + 1;

  const numVars = labelOffset + n * n * pairCount;
  const clauses: number[][] = [];
  const addClause = (lits: number[]) => clauses.push(lits);

  const incidentEdges = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => [] as number[])
  );
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const list = incidentEdges[i][j];
      if (i > 0) list.push(vertEdgeVar(i - 1, j));
      if (i < n - 1) list.push(vertEdgeVar(i, j));
      if (j > 0) list.push(horizEdgeVar(i, j - 1));
      if (j < n - 1) list.push(horizEdgeVar(i, j));
    }
  }

  function addAtLeastOne(vars: number[]) {
    if (vars.length > 0) addClause([...vars]);
  }
  function addAtMostOne(vars: number[]) {
    for (let i = 0; i < vars.length; i++) {
      for (let j = i + 1; j < vars.length; j++) {
        addClause([-vars[i], -vars[j]]);
      }
    }
  }
  function addAtMostTwo(vars: number[]) {
    for (let i = 0; i < vars.length; i++) {
      for (let j = i + 1; j < vars.length; j++) {
        for (let k = j + 1; k < vars.length; k++) {
          addClause([-vars[i], -vars[j], -vars[k]]);
        }
      }
    }
  }
  function addNotEqualOne(vars: number[]) {
    const m = vars.length;
    for (let i = 0; i < m; i++) {
      const lits = vars.map((v, j) => (i === j ? -v : v));
      addClause(lits);
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const edges = incidentEdges[i][j];
      if (edges.length === 0) continue;
      if (isTerminal[i][j]) {
        addAtLeastOne(edges);
        addAtMostOne(edges);
      } else {
        addAtMostTwo(edges);
        addNotEqualOne(edges);
        addAtLeastOne(edges);
      }
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const vars = [];
      for (let a = 1; a <= pairCount; a++) vars.push(labelVar(i, j, a));
      addClause(vars);
      for (let a = 0; a < pairCount; a++) {
        for (let b = a + 1; b < pairCount; b++) {
          addClause([-vars[a], -vars[b]]);
        }
      }
    }
  }

  terminals.forEach(t => {
    addClause([labelVar(t.r1, t.c1, t.id)]);
    addClause([labelVar(t.r2, t.c2, t.id)]);
  });

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n; j++) {
      const sVar = vertEdgeVar(i, j);
      for (let a = 1; a <= pairCount; a++) {
        const p1 = labelVar(i, j, a);
        const p2 = labelVar(i + 1, j, a);
        addClause([-sVar, -p1, p2]);
        addClause([-sVar, p1, -p2]);
      }
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - 1; j++) {
      const eVar = horizEdgeVar(i, j);
      for (let a = 1; a <= pairCount; a++) {
        const p1 = labelVar(i, j, a);
        const p2 = labelVar(i, j + 1, a);
        addClause([-eVar, -p1, p2]);
        addClause([-eVar, p1, -p2]);
      }
    }
  }
  if (profile) profile.BuildClauses = Math.round(performance.now() - t0);

  t0 = performance.now();
  const assign = solveSat(numVars, clauses, 2000);
  if (profile) profile.SolveSat = Math.round(performance.now() - t0);
  if (!assign) return null;

  let difficultyScore = 0;
  const pairs: Pair[] = terminals.map(t => {
    difficultyScore += Math.abs(t.r1 - t.r2) + Math.abs(t.c1 - t.c2);
    return { id: t.id, start: [t.r1, t.c1], end: [t.r2, t.c2] };
  });

  return { grid: null, pairs, difficultyScore };
}

function generateCandidate(gridSize: number, profile?: GenerationProfile): {
  grid: number[][] | null;
  pairs: Pair[];
  difficultyScore?: number;
} | null {
  const pairCount = getPairCount(gridSize);

  if (gridSize <= 6) {
    return generateCandidate6x6(gridSize, pairCount, profile);
  }
  return generateCandidate8x8(gridSize, pairCount, profile);
}

function addToCumulative(cumulative: GenerationProfile, delta: GenerationProfile): void {
  for (const [k, v] of Object.entries(delta)) {
    cumulative[k] = (cumulative[k] ?? 0) + v;
  }
}

/**
 * パズルを生成（サーバー専用）
 */
export function generatePairLinkPuzzle(gridSize: number): PuzzleResult | null {
  const pairCount = getPairCount(gridSize);
  const baseThreshold = gridSize * pairCount * 10;
  const timeLimitMs = 50000;
  const totalStart = performance.now();
  const cumulativeProfile: GenerationProfile = {};
  let attempts = 0;

  for (;;) {
    if (performance.now() - totalStart > timeLimitMs) return null;
    attempts += 1;

    const attemptProfile: GenerationProfile = {};
    const candidate = generateCandidate(gridSize, attemptProfile);
    if (!candidate) {
      addToCumulative(cumulativeProfile, attemptProfile);
      continue;
    }

    if (gridSize <= 6 && candidate.difficultyScore != null && candidate.difficultyScore < baseThreshold) {
      addToCumulative(cumulativeProfile, attemptProfile);
      continue;
    }

    const t0 = performance.now();
    const numbers: NumberCell[] = [];
    candidate.pairs.forEach((p, idx) => {
      const color = COLORS[idx % COLORS.length];
      const [r1, c1] = p.start;
      const [r2, c2] = p.end;
      numbers.push({ x: c1, y: r1, val: p.id, color });
      numbers.push({ x: c2, y: r2, val: p.id, color });
    });
    attemptProfile.Format = Math.round(performance.now() - t0);
    addToCumulative(cumulativeProfile, attemptProfile);

    const totalMs = Math.round(performance.now() - totalStart);
    return {
      numbers,
      pairs: candidate.pairs,
      gridSize,
      pairCount,
      profile: cumulativeProfile,
      attempts,
      totalMs,
    };
  }
}

/** クリア判定：paths が正しくすべてのセルを埋めているか（サーバー専用） */
export function validatePaths(
  paths: Record<string, { x: number; y: number }[][]>,
  pairs: Pair[],
  gridSize: number
): { ok: boolean; msg: string } {
  const n = gridSize;
  const used = new Set<string>();

  for (const p of pairs) {
    const id = String(p.id);
    const pathList = paths[id];
    if (!pathList || pathList.length !== 1) {
      return { ok: false, msg: `ペア ${p.id} の線が正しく繋がっていません。` };
    }

    const path = pathList[0];
    const [sr, sc] = p.start;
    const [tr, tc] = p.end;

    const first = path[0];
    const last = path[path.length - 1];

    const startMatch = (first.x === sc && first.y === sr) || (first.x === tc && first.y === tr);
    const endMatch = (last.x === sc && last.y === sr) || (last.x === tc && last.y === tr);

    if (!startMatch || !endMatch) {
      return { ok: false, msg: `ペア ${p.id} の端点が正しくありません。` };
    }

    for (const pt of path) {
      used.add(`${pt.x},${pt.y}`);
    }
  }

  const expected = n * n;
  if (used.size !== expected) {
    return { ok: false, msg: `全マスが埋まっていません。（${used.size}/${expected}）` };
  }

  return { ok: true, msg: "正解です！" };
}
