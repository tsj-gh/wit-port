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
 * generateByEdgeSwap: 8x8専用エンジン
 * Phase 1: 完全タイリング（32個の1x2ドミノ）
 * Phase 2: パス統合（目標ペア数まで隣接パスを結合）
 */
function generateByEdgeSwap(gridSize, targetPairCount, random) {
  if (gridSize !== 8) return null;
  const n = 8;
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  function key(r, c) {
    return r * n + c;
  }

  const solutionGrid = Array.from({ length: n }, () => Array(n).fill(0));
  const adj = Array.from({ length: n }, () => Array.from({ length: n }, () => []));
  let pathId = 1;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (solutionGrid[r][c] !== 0) continue;
      const emptyNeighbors = [];
      const filledNeighbors = [];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (solutionGrid[nr][nc] === 0) emptyNeighbors.push({ r: nr, c: nc });
        else filledNeighbors.push({ r: nr, c: nc });
      }
      if (emptyNeighbors.length > 0) {
        const pick = emptyNeighbors[Math.floor(random() * emptyNeighbors.length)];
        solutionGrid[r][c] = pathId;
        solutionGrid[pick.r][pick.c] = pathId;
        adj[r][c].push(key(pick.r, pick.c));
        adj[pick.r][pick.c].push(key(r, c));
        pathId++;
      } else if (filledNeighbors.length > 0) {
        const endpoints = filledNeighbors.filter(({ r: nr, c: nc }) => adj[nr][nc].length === 1);
        const donor = (endpoints.length > 0 ? endpoints : filledNeighbors)[
          Math.floor(random() * (endpoints.length || filledNeighbors.length))
        ];
        const pid = solutionGrid[donor.r][donor.c];
        solutionGrid[r][c] = pid;
        adj[r][c].push(key(donor.r, donor.c));
        adj[donor.r][donor.c].push(key(r, c));
      }
    }
  }

  if (typeof console !== "undefined") {
    console.log("Phase 1: Perfect Tiling Complete. Paths: 32");
  }

  let pathCount = 32;

  while (pathCount > targetPairCount) {
    const endpointPairs = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const pid = solutionGrid[r][c];
        if (!pid) continue;
        if (adj[r][c].length !== 1) continue;
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n) {
            const npid = solutionGrid[nr][nc];
            if (npid && npid !== pid && adj[nr][nc].length === 1) {
              endpointPairs.push({ a: { r, c, pid }, b: { r: nr, c: nc, pid: npid } });
            }
          }
        }
      }
    }
    if (endpointPairs.length === 0) {
      if (typeof console !== "undefined") {
        console.warn("[Edge-Swap] No endpoint-endpoint adjacencies. Regenerating...");
      }
      return generateByEdgeSwap(gridSize, targetPairCount, random);
    }

    const pick = endpointPairs[Math.floor(random() * endpointPairs.length)];
    const { a, b } = pick;
    if (a.pid === b.pid) continue;

    const visited = new Set();
    const stack = [key(a.r, a.c)];
    visited.add(key(a.r, a.c));
    let reachable = false;
    while (stack.length > 0) {
      const k = stack.pop();
      const kr = Math.floor(k / n), kc = k % n;
      if (kr === b.r && kc === b.c) {
        reachable = true;
        break;
      }
      for (const nk of adj[kr][kc]) {
        if (!visited.has(nk)) {
          visited.add(nk);
          stack.push(nk);
        }
      }
    }
    if (reachable) continue;

    adj[a.r][a.c].push(key(b.r, b.c));
    adj[b.r][b.c].push(key(a.r, a.c));

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (solutionGrid[r][c] === b.pid) solutionGrid[r][c] = a.pid;
      }
    }
    pathCount--;
    if (typeof console !== "undefined") {
      console.log("[Edge-Swap] Merge:", "A-endpoint", a.r, a.c, "<-> B-endpoint", b.r, b.c, "| Paths:", pathCount);
    }
  }

  if (typeof console !== "undefined") {
    console.log("Phase 2: Merging Complete. Total Paths: " + pathCount);
  }

  function validateGrid() {
    let deg1Count = 0;
    let deg2Count = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const pid = solutionGrid[r][c];
        if (pid == null || pid === 0) {
          if (typeof console !== "undefined") {
            console.error("[Edge-Swap] Validation failed: isolated empty cell at", r, c);
          }
          return false;
        }
        const deg = adj[r][c].length;
        if (deg === 1) deg1Count++;
        else if (deg === 2) deg2Count++;
        else {
          if (typeof console !== "undefined") {
            console.error("[Edge-Swap] Validation failed: cell", r, c, "has degree", deg);
          }
          return false;
        }
      }
    }
    if (deg1Count !== 16 || deg2Count !== 48) {
      if (typeof console !== "undefined") {
        console.error("[Edge-Swap] Validation failed: deg1=" + deg1Count + " deg2=" + deg2Count + " (expected 16, 48)");
      }
      return false;
    }
    if (typeof console !== "undefined") {
      console.log("[Edge-Swap] Degree validation: deg1=16 deg2=48 OK");
    }
    return true;
  }

  if (!validateGrid()) {
    if (typeof console !== "undefined") {
      console.error("[Edge-Swap] Grid validation failed. Regenerating...");
    }
    return generateByEdgeSwap(gridSize, targetPairCount, random);
  }

  /** 各内部パス id のセル数（Mutation はラベル入替えしないので一定） */
  const pidCellCount = new Map();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const p = solutionGrid[r][c];
      pidCellCount.set(p, (pidCellCount.get(p) || 0) + 1);
    }
  }

  /**
   * 2x2 エッジ入替え直後の pid 成分を局所検証（全盤再走査しない）
   * - tl を根に 1 回の DFS でサイクル検出
   * - 到達セル数が期待と一致 → 連結
   * - 次数 1 がちょうど 2 → 単一路グラフ
   */
  function checkPidAfterSwap(pid, sr, sc, expectedCount) {
    const visited = new Set();
    function dfs(u, parent) {
      visited.add(u);
      const ur = Math.floor(u / n);
      const uc = u % n;
      for (const nk of adj[ur][uc]) {
        if (solutionGrid[Math.floor(nk / n)][nk % n] !== pid) continue;
        if (nk === parent) continue;
        if (visited.has(nk)) return true;
        if (dfs(nk, u)) return true;
      }
      return false;
    }
    if (dfs(key(sr, sc), -1)) return false;
    if (visited.size !== expectedCount) return false;
    let deg1 = 0;
    for (const u of visited) {
      const ur = Math.floor(u / n);
      const uc = u % n;
      let samePidNeighbors = 0;
      for (const nk of adj[ur][uc]) {
        if (solutionGrid[Math.floor(nk / n)][nk % n] !== pid) continue;
        samePidNeighbors++;
      }
      if (samePidNeighbors === 1) deg1++;
    }
    return deg1 === 2;
  }

  function hasEdge(ra, ca, rb, cb) {
    const kb = key(rb, cb);
    return adj[ra][ca].indexOf(kb) >= 0;
  }
  function addEdge(ra, ca, rb, cb) {
    adj[ra][ca].push(key(rb, cb));
    adj[rb][cb].push(key(ra, ca));
  }
  function remEdge(ra, ca, rb, cb) {
    const kb = key(rb, cb), ka = key(ra, ca);
    const ia = adj[ra][ca].indexOf(kb); if (ia >= 0) adj[ra][ca].splice(ia, 1);
    const ib = adj[rb][cb].indexOf(ka); if (ib >= 0) adj[rb][cb].splice(ib, 1);
  }

  /**
   * 良問スコア: 各内部パスについてグラフ端点（次数1）同士のマンハッタン距離の最大ペアを取り、全パスで合計。
   */
  function computeTotalDistEndPoints() {
    const byPid = new Map();
    for (let rr = 0; rr < n; rr++) {
      for (let cc = 0; cc < n; cc++) {
        const p = solutionGrid[rr][cc];
        if (!p) continue;
        if (!byPid.has(p)) byPid.set(p, []);
        byPid.get(p).push({ r: rr, c: cc });
      }
    }
    let totalDist = 0;
    for (const [, cells] of byPid) {
      if (cells.length < 2) continue;
      const endpoints = cells.filter(({ r: rr, c: cc }) => adj[rr][cc].length === 1);
      if (endpoints.length < 2) continue;
      let best = 0;
      for (let j = 0; j < endpoints.length; j++) {
        for (let k = j + 1; k < endpoints.length; k++) {
          const d =
            Math.abs(endpoints[j].r - endpoints[k].r) +
            Math.abs(endpoints[j].c - endpoints[k].c);
          if (d > best) best = d;
        }
      }
      totalDist += best;
    }
    return totalDist;
  }

  function revertPattern(pattern, tl, tr, bl, br) {
    if (pattern === "A") {
      remEdge(tl.r, tl.c, tr.r, tr.c); remEdge(bl.r, bl.c, br.r, br.c);
      addEdge(tl.r, tl.c, bl.r, bl.c); addEdge(tr.r, tr.c, br.r, br.c);
    } else {
      remEdge(tl.r, tl.c, bl.r, bl.c); remEdge(tr.r, tr.c, br.r, br.c);
      addEdge(tl.r, tl.c, tr.r, tr.c); addEdge(bl.r, bl.c, br.r, br.c);
    }
  }

  let swapCount = 0;
  const MUTATION_ATTEMPTS = 1000;
  for (let attempt = 0; attempt < MUTATION_ATTEMPTS; attempt++) {
    const r = Math.floor(random() * (n - 1));
    const c = Math.floor(random() * (n - 1));
    const tl = { r, c }, tr = { r: r, c: c + 1 }, bl = { r: r + 1, c }, br = { r: r + 1, c: c + 1 };
    const pid = solutionGrid[tl.r][tl.c];
    if (!pid || solutionGrid[tr.r][tr.c] !== pid || solutionGrid[bl.r][bl.c] !== pid || solutionGrid[br.r][br.c] !== pid) continue;

    let pattern = null;
    if (hasEdge(tl.r, tl.c, bl.r, bl.c) && hasEdge(tr.r, tr.c, br.r, br.c)) pattern = "A";
    else if (hasEdge(tl.r, tl.c, tr.r, tr.c) && hasEdge(bl.r, bl.c, br.r, br.c)) pattern = "B";
    if (!pattern) continue;

    const distBefore = computeTotalDistEndPoints();

    if (pattern === "A") {
      remEdge(tl.r, tl.c, bl.r, bl.c);
      remEdge(tr.r, tr.c, br.r, br.c);
      addEdge(tl.r, tl.c, tr.r, tr.c);
      addEdge(bl.r, bl.c, br.r, br.c);
    } else {
      remEdge(tl.r, tl.c, tr.r, tr.c);
      remEdge(bl.r, bl.c, br.r, br.c);
      addEdge(tl.r, tl.c, bl.r, bl.c);
      addEdge(tr.r, tr.c, br.r, br.c);
    }

    const expectedSize = pidCellCount.get(pid);
    if (expectedSize == null || !checkPidAfterSwap(pid, tl.r, tl.c, expectedSize)) {
      revertPattern(pattern, tl, tr, bl, br);
      continue;
    }

    const distAfter = computeTotalDistEndPoints();
    if (distAfter < distBefore && random() < 0.5) {
      revertPattern(pattern, tl, tr, bl, br);
      continue;
    }

    swapCount++;
  }

  const mutationFinalTotalDist = computeTotalDistEndPoints();
  if (typeof console !== "undefined") {
    console.log("Mutation Complete - Successful Swaps: " + swapCount);
    console.log("Mutation — final totalDist (endpoint Manhattan sum): " + mutationFinalTotalDist);
  }

  if (!validateGrid()) {
    if (typeof console !== "undefined") {
      console.error("[Edge-Swap] Post-mutation validation failed. Regenerating...");
    }
    return generateByEdgeSwap(gridSize, targetPairCount, random);
  }

  const pathCells = new Map();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const p = solutionGrid[r][c];
      if (!pathCells.has(p)) pathCells.set(p, []);
      pathCells.get(p).push({ r, c });
    }
  }

  const pathList = Array.from(pathCells.entries())
    .filter(([, cells]) => cells.length >= 2)
    .sort((x, y) => x[0] - y[0]);

  const orphanPids = Array.from(pathCells.entries())
    .filter(([, cells]) => cells.length < 2)
    .map(([pid]) => pid);
  if (orphanPids.length > 0) {
    if (typeof console !== "undefined") {
      console.error("[Edge-Swap] Orphan paths (len<2):", orphanPids, "Regenerating...");
    }
    return generateByEdgeSwap(gridSize, targetPairCount, random);
  }

  const pairs = [];
  const pathToOutId = new Map();
  pathList.forEach(([pid], i) => pathToOutId.set(pid, i + 1));

  for (let i = 0; i < pathList.length; i++) {
    const [, cells] = pathList[i];
    const endpoints = cells.filter(({ r, c }) => adj[r][c].length === 1);
    let bestA = cells[0];
    let bestB = cells[0];
    let bestD = -1;
    if (endpoints.length >= 2) {
      for (let j = 0; j < endpoints.length; j++) {
        for (let k = j + 1; k < endpoints.length; k++) {
          const d = Math.abs(endpoints[j].r - endpoints[k].r) + Math.abs(endpoints[j].c - endpoints[k].c);
          if (d > bestD) {
            bestD = d;
            bestA = endpoints[j];
            bestB = endpoints[k];
          }
        }
      }
    } else {
      for (let j = 0; j < cells.length; j++) {
        for (let k = j + 1; k < cells.length; k++) {
          const d = Math.abs(cells[j].r - cells[k].r) + Math.abs(cells[j].c - cells[k].c);
          if (d > bestD) {
            bestD = d;
            bestA = cells[j];
            bestB = cells[k];
          }
        }
      }
    }
    pairs.push({
      id: i + 1,
      start: [bestA.r, bestA.c],
      end: [bestB.r, bestB.c],
    });
  }

  const CRAWL_EXCHANGE_ITERS = 1000;

  if (typeof console !== "undefined" && console.time) {
    console.time("Crawling Phase");
  }

  /** 全ペアの端点間マンハッタン距離の和（良問化バイアス用） */
  function manhattanSumEndpoints() {
    let s = 0;
    for (let p = 0; p < pairs.length; p++) {
      s +=
        Math.abs(pairs[p].start[0] - pairs[p].end[0]) +
        Math.abs(pairs[p].start[1] - pairs[p].end[1]);
    }
    return s;
  }

  /**
   * ゼロサム: A のグラフ端点 E から隣接マス P を奪う（P は B の端点）。
   * B は P を失い Q が新端点、A は P を得て E が中間点。セル総数・非空白は不変。
   */
  function tryZeroSumBoundaryCrawl() {
    const m0 = manhattanSumEndpoints();
    for (let attempt = 0; attempt < 32; attempt++) {
      const pairIdxA = Math.floor(random() * pathList.length);
      const useStartA = random() < 0.5;
      const pidA = pathList[pairIdxA][0];
      const ep = useStartA ? pairs[pairIdxA].start : pairs[pairIdxA].end;
      const er = ep[0], ec = ep[1];
      if (adj[er][ec].length !== 1) continue;

      for (let di = 0; di < 4; di++) {
        const [dr, dc] = dirs[di];
        const pr = er + dr, pc = ec + dc;
        if (pr < 0 || pr >= n || pc < 0 || pc >= n) continue;
        const pidB = solutionGrid[pr][pc];
        if (!pidB || pidB === pidA) continue;
        if (adj[pr][pc].length !== 1) continue;

        const qKey = adj[pr][pc][0];
        const qr = Math.floor(qKey / n), qc = qKey % n;
        if (solutionGrid[qr][qc] !== pidB) continue;

        let pairIdxB = -1;
        for (let j = 0; j < pathList.length; j++) {
          if (pathList[j][0] === pidB) {
            pairIdxB = j;
            break;
          }
        }
        if (pairIdxB < 0) continue;

        remEdge(pr, pc, qr, qc);
        addEdge(er, ec, pr, pc);
        solutionGrid[pr][pc] = pidA;

        const expA = pidCellCount.get(pidA) + 1;
        const expB = pidCellCount.get(pidB) - 1;

        if (!checkPidAfterSwap(pidA, er, ec, expA) || !checkPidAfterSwap(pidB, qr, qc, expB)) {
          solutionGrid[pr][pc] = pidB;
          remEdge(er, ec, pr, pc);
          addEdge(pr, pc, qr, qc);
          continue;
        }

        const backup = pairs.map((p) => ({
          start: [p.start[0], p.start[1]],
          end: [p.end[0], p.end[1]],
        }));

        if (useStartA) {
          pairs[pairIdxA].start[0] = pr;
          pairs[pairIdxA].start[1] = pc;
        } else {
          pairs[pairIdxA].end[0] = pr;
          pairs[pairIdxA].end[1] = pc;
        }

        const pb = pairs[pairIdxB];
        if (pb.start[0] === pr && pb.start[1] === pc) {
          pb.start[0] = qr;
          pb.start[1] = qc;
        }
        if (pb.end[0] === pr && pb.end[1] === pc) {
          pb.end[0] = qr;
          pb.end[1] = qc;
        }

        const m1 = manhattanSumEndpoints();
        const gain = m1 - m0;
        const accept = gain > 0 || (gain === 0 && random() < 0.42);

        if (!accept) {
          for (let pi = 0; pi < pairs.length; pi++) {
            pairs[pi].start[0] = backup[pi].start[0];
            pairs[pi].start[1] = backup[pi].start[1];
            pairs[pi].end[0] = backup[pi].end[0];
            pairs[pi].end[1] = backup[pi].end[1];
          }
          solutionGrid[pr][pc] = pidB;
          remEdge(er, ec, pr, pc);
          addEdge(pr, pc, qr, qc);
          continue;
        }

        pidCellCount.set(pidA, expA);
        pidCellCount.set(pidB, expB);

        const arrA = pathCells.get(pidA);
        const arrB = pathCells.get(pidB);
        pathCells.set(
          pidB,
          arrB.filter((c) => !(c.r === pr && c.c === pc))
        );
        pathCells.set(pidA, arrA.concat([{ r: pr, c: pc }]));

        for (let idx = 0; idx < pathList.length; idx++) {
          pathList[idx][1] = pathCells.get(pathList[idx][0]);
        }

        return true;
      }
    }
    return false;
  }

  for (let it = 0; it < CRAWL_EXCHANGE_ITERS; it++) {
    if (random() < 0.5) {
      tryZeroSumBoundaryCrawl();
    } else {
      const adjEndpoints = [];
      for (let i = 0; i < pathList.length; i++) {
        for (let j = i + 1; j < pathList.length; j++) {
          const sa = pairs[i].start, ea = pairs[i].end, sb = pairs[j].start, eb = pairs[j].end;
          const check = (a, b) => {
            const dr = Math.abs(a[0] - b[0]);
            const dc = Math.abs(a[1] - b[1]);
            return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
          };
          if (check(sa, sb) || check(sa, eb) || check(ea, sb) || check(ea, eb)) adjEndpoints.push({ i, j });
        }
      }
      if (adjEndpoints.length === 0) continue;
      const pick = adjEndpoints[Math.floor(random() * adjEndpoints.length)];
      const { i, j } = pick;
      const pidA = pathList[i][0], pidB = pathList[j][0];
      const arrA = pathCells.get(pidA);
      const arrB = pathCells.get(pidB);
      if (!arrA || !arrB) continue;
      for (let k = 0; k < arrA.length; k++) solutionGrid[arrA[k].r][arrA[k].c] = pidB;
      for (let k = 0; k < arrB.length; k++) solutionGrid[arrB[k].r][arrB[k].c] = pidA;
      pathCells.set(pidA, arrB);
      pathCells.set(pidB, arrA);
      const tmp = { start: [...pairs[i].start], end: [...pairs[i].end] };
      pairs[i].start = [...pairs[j].start];
      pairs[i].end = [...pairs[j].end];
      pairs[j].start = tmp.start;
      pairs[j].end = tmp.end;
      for (let idx = 0; idx < pathList.length; idx++) {
        pathList[idx][1] = pathCells.get(pathList[idx][0]);
      }
    }
  }
  if (typeof console !== "undefined" && console.timeEnd) {
    console.timeEnd("Crawling Phase");
  }

  pathToOutId.clear();
  pathList.forEach(([pid], i) => pathToOutId.set(pid, i + 1));

  const outGrid = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const pid = solutionGrid[r][c];
      const outId = pathToOutId.get(pid);
      if (outId == null || outId === 0) {
        if (typeof console !== "undefined") {
          console.warn("[Edge-Swap] Cell", r, c, "unmapped pid", pid, "(debug: no regeneration)");
        }
        outGrid[r][c] = 0;
      } else {
        outGrid[r][c] = outId;
      }
    }
  }

  /** pid 部分グラフ上で (sr,sc) からの BFS 距離 */
  function bfsDistOnPid(sr, sc, pid) {
    const dist = new Map();
    const sk = key(sr, sc);
    if (solutionGrid[sr][sc] !== pid) return dist;
    const q = [sk];
    dist.set(sk, 0);
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi];
      const kr = Math.floor(k / n), kc = k % n;
      const base = dist.get(k);
      for (const nk of adj[kr][kc]) {
        if (solutionGrid[Math.floor(nk / n)][nk % n] !== pid) continue;
        if (dist.has(nk)) continue;
        dist.set(nk, base + 1);
        q.push(nk);
      }
    }
    return dist;
  }

  /**
   * 終点からの BFS で距離を付与し、開始から「距離が 1 ずつ減る」隣のみを辿る。
   * Set で座標の重複・短絡ループを O(1) で検出。
   */
  function buildSolutionPathDirected(sr, sc, tr, tc, pid) {
    const dist = new Map();
    const q = [];
    const endK = key(tr, tc);
    dist.set(endK, 0);
    q.push(endK);
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi];
      const kr = Math.floor(k / n), kc = k % n;
      const base = dist.get(k);
      for (const nk of adj[kr][kc]) {
        if (solutionGrid[Math.floor(nk / n)][nk % n] !== pid) continue;
        if (dist.has(nk)) continue;
        dist.set(nk, base + 1);
        q.push(nk);
      }
    }
    const startK = key(sr, sc);
    if (!dist.has(startK)) return null;

    const path = [];
    const seenKeys = new Set();
    let r = sr, c = sc;
    for (;;) {
      const k = key(r, c);
      if (seenKeys.has(k)) return null;
      seenKeys.add(k);
      path.push({ x: c, y: r });
      if (r === tr && c === tc) break;
      const curD = dist.get(k);
      if (curD == null || curD <= 0) return null;
      const targetD = curD - 1;
      let nextK = -1;
      for (const nk of adj[r][c]) {
        if (solutionGrid[Math.floor(nk / n)][nk % n] !== pid) continue;
        if (dist.get(nk) === targetD) {
          nextK = nk;
          break;
        }
      }
      if (nextK < 0) return null;
      r = Math.floor(nextK / n);
      c = nextK % n;
    }
    return path;
  }

  /**
   * solutionPaths[id]: 成分の全セル（葉↔葉の一本道）。index 0 = 数字 start、最後 = 数字 end。
   * 葉の向きは pairs.start に近い葉を path[0] 側に寄せる（数字を配列端に一致させる）。
   */
  function buildSolutionPathsFromAdj() {
    const result = {};
    for (let i = 0; i < pathList.length; i++) {
      const pid = pathList[i][0];
      const [, cells] = pathList[i];
      const [sr, sc] = pairs[i].start;
      const [tr, tc] = pairs[i].end;

      const leaves = (cells || []).filter(({ r, c }) => adj[r][c].length === 1);
      let path = null;
      if (leaves.length === 2) {
        const leafA = leaves[0];
        const leafB = leaves[1];
        const distFromDigitStart = bfsDistOnPid(sr, sc, pid);
        const kA = key(leafA.r, leafA.c);
        const kB = key(leafB.r, leafB.c);
        const dA = distFromDigitStart.has(kA) ? distFromDigitStart.get(kA) : 9999;
        const dB = distFromDigitStart.has(kB) ? distFromDigitStart.get(kB) : 9999;
        if (dA <= dB) {
          path = buildSolutionPathDirected(leafA.r, leafA.c, leafB.r, leafB.c, pid);
        } else {
          path = buildSolutionPathDirected(leafB.r, leafB.c, leafA.r, leafA.c, pid);
        }
      }
      if (!path || path.length === 0) {
        path = buildSolutionPathDirected(sr, sc, tr, tc, pid);
      }
      if (!path || path.length === 0) {
        if (typeof console !== "undefined") {
          console.error("[Edge-Swap] buildSolutionPathsFromAdj failed for pair id", pairs[i].id);
        }
        result[String(pairs[i].id)] = [[]];
        continue;
      }

      const last = path.length - 1;
      const p0 = path[0];
      const pl = path[last];
      const forward =
        p0.y === sr && p0.x === sc && pl.y === tr && pl.x === tc;
      const backward =
        pl.y === sr && pl.x === sc && p0.y === tr && p0.x === tc;
      if (!forward && backward) {
        path.reverse();
      }
      pairs[i].start[0] = path[0].y;
      pairs[i].start[1] = path[0].x;
      pairs[i].end[0] = path[path.length - 1].y;
      pairs[i].end[1] = path[path.length - 1].x;
      result[String(pairs[i].id)] = [path];
    }
    return result;
  }

  const solutionPaths = buildSolutionPathsFromAdj();

  let totalCount = 0;
  for (const k of Object.keys(solutionPaths)) {
    const segs = solutionPaths[k];
    if (Array.isArray(segs)) for (const seg of segs) totalCount += (seg && seg.length) | 0;
  }
  if (typeof console !== "undefined") {
    for (let i = 0; i < pairs.length; i++) {
      const id = pairs[i].id;
      const segs = solutionPaths[String(id)];
      const path = segs && segs[0];
      const isMatch =
        !!path &&
        path.length > 0 &&
        path[0].y === pairs[i].start[0] &&
        path[0].x === pairs[i].start[1] &&
        path[path.length - 1].y === pairs[i].end[0] &&
        path[path.length - 1].x === pairs[i].end[1];
      console.log(`Path ${id}: Array edges match digit positions: ${isMatch}`);
    }
    console.log("Final Validation - Pairs: " + pairs.length);
    console.log("Final Validation - Cells: " + totalCount);
    console.log("Debug - solutionPaths total cells: " + totalCount);

    const totalCells = totalCount;
    console.log("Final Grid Check: " + (totalCells === 64 ? "PERFECT" : "FAILED"));
    if (totalCells !== 64) {
      const emptyCoords = [];
      for (let gr = 0; gr < n; gr++) {
        for (let gc = 0; gc < n; gc++) {
          if (solutionGrid[gr][gc] === 0) emptyCoords.push("(" + gr + "," + gc + ")");
        }
      }
      console.log(
        "[Edge-Swap] solutionGrid empty cell list: " +
          (emptyCoords.length ? emptyCoords.join(", ") : "(none — check path sums / overlaps)")
      );
    }
  }

  return { grid: outGrid, pairs, solutionPaths, difficultyScore: 0 };
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
  let pairCount = numPairs != null
    ? Math.max(2, Math.min(maxPairs, numPairs))
    : getPairCount(gridSize);
  const cfg = config || {};
  const generationMode = cfg.generationMode || "default";

  if (gridSize === 8 && generationMode === "edgeSwap") {
    const t0 = performance.now();
    const hasSeed = seed != null && String(seed).trim() !== "";
    const attemptSeed = hasSeed ? String(seed) : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
    const random = createRandom(attemptSeed);
    const targetPairCount = Math.max(2, Math.min(10, pairCount));
    const candidate = generateByEdgeSwap(8, targetPairCount, random);
    const elapsed = Math.round(performance.now() - t0);

    if (!candidate) return null;

    pairCount = candidate.pairs.length;
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
      gridSize: 8,
      pairCount,
      profile: { EdgeSwap: elapsed },
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
