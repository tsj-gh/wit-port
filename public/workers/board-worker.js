/**
 * Board Worker: Pair-link puzzle generation
 * Plain JS port of src/lib/puzzle-engine/pair-link.ts
 * シード値指定可能な PRNG（Mulberry32）で再現性を確保
 */

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRandom(seed) {
  if (seed != null && String(seed).trim() !== "") {
    return mulberry32(hashString(String(seed)));
  }
  return () => Math.random();
}

const COLORS = [
  "#ff4757", "#2e86de", "#2ed573", "#ffa502", "#a29bfe",
  "#e17055", "#00cec9", "#6c5ce7", "#fdcb6e",
];

function getPairCount(gridSize) {
  switch (gridSize) {
    case 4: return 3;
    case 6: return 5;
    case 8: return 7;
    case 10:
    default: return 9;
  }
}

function countSolutions(grid, pairs, pairIndex, maxSolutions, stats, random) {
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

  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }

  let solutions = 0;
  const visited = Array.from({ length: n }, () => Array(n).fill(false));

  function dfs(r, c) {
    if (solutions >= maxSolutions) return;
    stats.nodes++;
    if (stats.nodes > stats.nodeLimit) return;

    if (r === tr && c === tc) {
      solutions += countSolutions(grid, pairs, pairIndex + 1, maxSolutions - solutions, stats, random);
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

function solveSat(numVars, clauses, timeLimitMs) {
  const assignment = new Int8Array(numVars + 1);
  const start = performance.now();

  function unitProp() {
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
              assignment[v] = val;
              changed = true;
            } else if (assignment[v] !== val) return false;
          }
        }
      }
      if (!changed) return true;
    }
  }

  function chooseVar() {
    for (let v = 1; v <= numVars; v++) {
      if (assignment[v] === 0) return v;
    }
    return 0;
  }

  function dpll() {
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

function computeDegreesAndEndpoints(grid) {
  const n = grid.length;
  const deg = Array.from({ length: n }, () => Array(n).fill(0));
  let filled = 0;

  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
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

  const endpointsPerId = new Map();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const id = grid[r][c];
      if (!id) continue;
      if (deg[r][c] === 1 || deg[r][c] === 0) {
        if (!endpointsPerId.has(id)) endpointsPerId.set(id, []);
        endpointsPerId.get(id).push({ r, c });
      }
    }
  }

  return { deg, endpointsPerId, filled };
}

function evaluateForestGrid(grid, pairCount, config) {
  const n = grid.length;
  const cfg = config || {};
  const emptyIsolatedPenaltyVal = cfg.emptyIsolatedPenalty != null ? cfg.emptyIsolatedPenalty : 5;
  const detourWeightVal = cfg.detourWeight != null ? cfg.detourWeight : 0;

  let score = 0;
  let filled = 0;
  let emptyIsolatedPenaltyCount = 0;
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

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
        if (emptyNeighbors <= 1) emptyIsolatedPenaltyCount++;
      }
    }
  }

  score += filled * 10;
  score -= emptyIsolatedPenaltyCount * emptyIsolatedPenaltyVal;

  if (detourWeightVal > 0 && pairCount > 0) {
    const { endpointsPerId } = computeDegreesAndEndpoints(grid);
    let totalDetourSteps = 0;
    for (let id = 1; id <= pairCount; id++) {
      const eps = endpointsPerId.get(id) || [];
      if (eps.length < 2) continue;
      let cellCount = 0;
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++)
          if (grid[r][c] === id) cellCount++;
      const manhattan = Math.abs(eps[0].r - eps[1].r) + Math.abs(eps[0].c - eps[1].c);
      const excess = Math.max(0, (cellCount - 1) - manhattan);
      totalDetourSteps += excess;
    }
    score -= totalDetourSteps * detourWeightVal;
  }

  return score;
}

function generateFullCoverByBeam(gridSize, pairCount, random, config) {
  const n = gridSize;
  const beamWidth = 20;
  const maxSteps = n * n * 8;

  const cells = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push({ r, c });
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const initGrid = Array.from({ length: n }, () => Array(n).fill(0));
  for (let id = 1; id <= pairCount; id++) {
    const cell = cells[id - 1];
    initGrid[cell.r][cell.c] = id;
  }

  let beam = [
    { grid: initGrid, score: evaluateForestGrid(initGrid, pairCount, config) },
  ];
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

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

    const nextStates = [];

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

            nextStates.push({ grid: newGrid, score: evaluateForestGrid(newGrid, pairCount, config) });
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

function generateCandidate6x6(gridSize, pairCount, profile, random, logFailure, config) {
  const n = gridSize;
  let t0 = performance.now();
  const forestGrid = generateFullCoverByBeam(n, pairCount, random, config);
  if (profile) profile.BeamSearch = Math.round(performance.now() - t0);
  if (!forestGrid) {
    if (logFailure && typeof console !== "undefined") console.log("[Pair-link] No Full Cover");
    return null;
  }

  t0 = performance.now();
  const pairs = [];
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (let id = 1; id <= pairCount; id++) {
    const cells = [];
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
  const solCount = countSolutions(solveGrid, pairs, 0, 2, stats, random);
  if (profile) profile.UniqueCheck = Math.round(performance.now() - t0);
  if (solCount !== 1) {
    if (logFailure && typeof console !== "undefined") console.log("[Pair-link] Not Unique");
    return null;
  }

  return { grid: forestGrid, pairs, difficultyScore: stats.nodes };
}

function generateCandidate8x8(gridSize, pairCount, profile, random) {
  const n = gridSize;
  let t0 = performance.now();
  const cells = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push({ r, c });
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const terminals = [];
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

  const vertEdgeVar = (i, j) => edgeOffset + (i * n + j) + 1;
  const horizEdgeVar = (i, j) => edgeHOffset + (i * (n - 1) + j) + 1;
  const labelVar = (i, j, a) =>
    labelOffset + ((i * n + j) * pairCount + (a - 1)) + 1;

  const numVars = labelOffset + n * n * pairCount;
  const clauses = [];
  const addClause = (lits) => clauses.push(lits);

  const incidentEdges = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => [])
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

  function addAtLeastOne(vars) {
    if (vars.length > 0) addClause([...vars]);
  }
  function addAtMostOne(vars) {
    for (let i = 0; i < vars.length; i++) {
      for (let j = i + 1; j < vars.length; j++) {
        addClause([-vars[i], -vars[j]]);
      }
    }
  }
  function addAtMostTwo(vars) {
    for (let i = 0; i < vars.length; i++) {
      for (let j = i + 1; j < vars.length; j++) {
        for (let k = j + 1; k < vars.length; k++) {
          addClause([-vars[i], -vars[j], -vars[k]]);
        }
      }
    }
  }
  function addNotEqualOne(vars) {
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
  const pairs = terminals.map(t => {
    difficultyScore += Math.abs(t.r1 - t.r2) + Math.abs(t.c1 - t.c2);
    return { id: t.id, start: [t.r1, t.c1], end: [t.r2, t.c2] };
  });

  return { grid: null, pairs, difficultyScore };
}

/**
 * Territory Expansion 方式: 8x8以上の大型盤面向け
 * Step A: 種散布 → Step B: BFS領土拡大 → Step C: 領域内パス生成（最短パス）
 */
function generateByTerritoryExpansion(gridSize, pairCount, random, profile) {
  const n = gridSize;
  const pc = pairCount;
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  function manhattan(r1, c1, r2, c2) {
    return Math.abs(r1 - r2) + Math.abs(c1 - c2);
  }

  function cornerScore(r, c) {
    const isCorner = (r === 0 || r === n - 1) && (c === 0 || c === n - 1) ? 10 : 0;
    const isEdge = (r === 0 || r === n - 1 || c === 0 || c === n - 1) ? 5 : 0;
    return isCorner + isEdge;
  }

  function canPlace(used, r, c, minDist) {
    return used.every(([ur, uc]) => manhattan(r, c, ur, uc) >= minDist);
  }

  // Step A: 戦略的な種の散布（距離制約を 3→2→1 で緩和、必ず配置）
  const cells = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push({ r, c, score: cornerScore(r, c) });
  cells.sort((a, b) => b.score - a.score);

  const used = [];
  const pairs = [];

  for (let id = 1; id <= pc; id++) {
    let bestStart = null;
    let bestEnd = null;
    let bestScore = -1;

    for (const minDist of [3, 2, 1]) {
      for (let i = 0; i < cells.length; i++) {
        const s = cells[i];
        if (!canPlace(used, s.r, s.c, minDist)) continue;
        for (let j = 0; j < cells.length; j++) {
          if (i === j) continue;
          const e = cells[j];
          if (!canPlace(used, e.r, e.c, minDist)) continue;
          if (manhattan(s.r, s.c, e.r, e.c) < minDist) continue;
          const score = s.score + e.score + manhattan(s.r, s.c, e.r, e.c);
          if (score > bestScore) {
            bestScore = score;
            bestStart = s;
            bestEnd = e;
          }
        }
      }
      if (bestStart && bestEnd) break;
    }

    if (!bestStart || !bestEnd) {
      if (typeof console !== "undefined") console.log("[Territory] Step A 失敗: id=" + id + ", used=" + used.length);
      return null;
    }
    used.push([bestStart.r, bestStart.c], [bestEnd.r, bestEnd.c]);
    pairs.push({
      id,
      start: [bestStart.r, bestStart.c],
      end: [bestEnd.r, bestEnd.c],
    });
  }

  if (typeof console !== "undefined") console.log("[Territory] Step A 完了: ペア数=" + pairs.length);

  // Step B: 領土拡大（BFS、ランダム成長順でジグザグ境界を生成）
  const grid = Array.from({ length: n }, () => Array(n).fill(0));
  for (const p of pairs) {
    grid[p.start[0]][p.start[1]] = p.id;
    grid[p.end[0]][p.end[1]] = p.id;
  }

  const emptyNeighbors = (r, c) => {
    const out = [];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n && grid[nr][nc] === 0) out.push({ r: nr, c: nc });
    }
    return out;
  };

  let filled = 2 * pc;
  const totalCells = n * n;

  while (filled < totalCells) {
    const growable = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const id = grid[r][c];
        if (!id) continue;
        const ngh = emptyNeighbors(r, c);
        for (const cell of ngh) growable.push({ ...cell, id });
      }
    }
    if (growable.length === 0) break;

    const idx = Math.floor(random() * growable.length);
    const { r, c, id } = growable[idx];
    grid[r][c] = id;
    filled++;
  }

  if (filled < totalCells) {
    if (typeof console !== "undefined") console.log("[Territory] Step B 失敗: filled=" + filled + "/" + totalCells);
    return null;
  }

  if (typeof console !== "undefined") console.log("[Territory] Step B 完了: 全" + totalCells + "マス塗り完了");

  // Step C: 各領域で Start→End の最短パスを生成（solutionGridToPaths を利用）
  const solutionPaths = solutionGridToPaths(grid, pairs);
  if (!solutionPaths || Object.keys(solutionPaths).length !== pc) {
    if (typeof console !== "undefined") console.log("[Territory] Step C 失敗: solutionPaths=" + (solutionPaths ? Object.keys(solutionPaths).length : "null"));
    return null;
  }

  if (typeof console !== "undefined") console.log("[Territory] Step C 完了: パス数=" + Object.keys(solutionPaths).length);

  return { grid, pairs, solutionPaths, difficultyScore: 0 };
}

function generateCandidate(gridSize, pairCount, profile, random, logFailure, config) {
  const maxPairs = gridSize >= 7 ? 10 : gridSize;
  const pc = pairCount != null ? Math.max(2, Math.min(maxPairs, pairCount)) : getPairCount(gridSize);

  if (gridSize <= 6) {
    return generateCandidate6x6(gridSize, pc, profile, random, logFailure, config);
  }
  return generateCandidate8x8(gridSize, pc, profile, random);
}

function addToCumulative(cumulative, delta) {
  for (const [k, v] of Object.entries(delta)) {
    cumulative[k] = (cumulative[k] ?? 0) + v;
  }
}

/** 解の grid を paths 形式に変換（x=列, y=行） */
function solutionGridToPaths(grid, pairs) {
  const n = grid.length;
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const result = {};

  for (const p of pairs) {
    const id = p.id;
    const [sr, sc] = p.start;
    const [tr, tc] = p.end;

    const path = [];
    const visited = Array.from({ length: n }, () => Array(n).fill(false));

    const dfs = (r, c) => {
      path.push({ x: c, y: r });
      if (r === tr && c === tc) return true;

      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (grid[nr][nc] !== id || visited[nr][nc]) continue;

        visited[nr][nc] = true;
        if (dfs(nr, nc)) return true;
        visited[nr][nc] = false;
      }
      path.pop();
      return false;
    };

    visited[sr][sc] = true;
    dfs(sr, sc);
    result[String(id)] = [path];
  }

  return result;
}

function generatePairLinkPuzzle(gridSize, seed, numPairs, config) {
  const maxPairs = gridSize >= 7 ? 10 : gridSize;
  const pairCount = numPairs != null
    ? Math.max(2, Math.min(maxPairs, numPairs))
    : getPairCount(gridSize);
  const cfg = config || {};
  const generationMode = cfg.generationMode || "default";

  if (generationMode === "territory" && gridSize >= 8) {
    const t0 = performance.now();
    const hasSeed = seed != null && String(seed).trim() !== "";
    const attemptSeed = hasSeed ? String(seed) : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
    const random = createRandom(attemptSeed);
    const profile = {};
    const candidate = generateByTerritoryExpansion(gridSize, pairCount, random, profile);
    const elapsed = Math.round(performance.now() - t0);

    if (typeof console !== "undefined") {
      console.log(`[Pair-link Territory] 生成完了: ${gridSize}x${gridSize} ${pairCount}ペア, ${elapsed}ms`);
    }

    if (!candidate) return null;

    const numbers = [];
    candidate.pairs.forEach((p, idx) => {
      const color = COLORS[idx % COLORS.length];
      const [r1, c1] = p.start;
      const [r2, c2] = p.end;
      numbers.push({ x: c1, y: r1, val: p.id, color });
      numbers.push({ x: c2, y: r2, val: p.id, color });
    });

    return {
      numbers,
      pairs: candidate.pairs,
      gridSize,
      pairCount,
      profile: { TerritoryExpansion: elapsed },
      attempts: 1,
      totalMs: elapsed,
      seed: attemptSeed,
      solutionPaths: candidate.solutionPaths || null,
    };
  }

  const baseThreshold = (cfg.baseThreshold != null && cfg.baseThreshold > 0)
    ? cfg.baseThreshold
    : gridSize * pairCount * 10;
  const timeLimitMs = 50000;
  const totalStart = performance.now();
  const cumulativeProfile = {};
  let attempts = 0;
  const logFailure = numPairs != null;

  const hasSeed = seed != null && String(seed).trim() !== "";

  for (;;) {
    if (performance.now() - totalStart > timeLimitMs) return null;
    attempts += 1;

    const attemptSeed = hasSeed ? String(seed) : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
    const random = createRandom(attemptSeed);

    const attemptProfile = {};
    const candidate = generateCandidate(gridSize, pairCount, attemptProfile, random, logFailure, config);
    if (!candidate) {
      addToCumulative(cumulativeProfile, attemptProfile);
      if (hasSeed) return null;
      continue;
    }

    if (gridSize <= 6 && candidate.difficultyScore != null && candidate.difficultyScore < baseThreshold) {
      addToCumulative(cumulativeProfile, attemptProfile);
      if (hasSeed) return null;
      continue;
    }

    const t0 = performance.now();
    const numbers = [];
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
    const solutionPaths = candidate.grid
      ? solutionGridToPaths(candidate.grid, candidate.pairs)
      : null;
    return {
      numbers,
      pairs: candidate.pairs,
      gridSize,
      pairCount,
      profile: cumulativeProfile,
      attempts,
      totalMs,
      seed: attemptSeed,
      solutionPaths,
    };
  }
}

self.onmessage = function (e) {
  const { type, gridSize, seed, numPairs, config, requestId } = e.data || {};
  if (type !== 'GENERATE') return;

  self.postMessage({ type: 'STATUS', status: 'RUNNING', requestId });

  try {
    const result = generatePairLinkPuzzle(gridSize ?? 8, seed, numPairs, config);
    if (result) {
      self.postMessage({
        type: 'SUCCESS',
        board: {
          numbers: result.numbers,
          pairs: result.pairs,
          gridSize: result.gridSize,
          pairCount: result.pairCount,
          seed: result.seed,
          solutionPaths: result.solutionPaths || null,
        },
        metrics: {
          profile: result.profile,
          attempts: result.attempts,
          totalMs: result.totalMs,
        },
        requestId,
      });
    } else {
      self.postMessage({
        type: 'ERROR',
        error: '生成に失敗しました',
        requestId,
      });
    }
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      error: err && err.message ? err.message : '生成に失敗しました',
      requestId,
    });
  }
};
