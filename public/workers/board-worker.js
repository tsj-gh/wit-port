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
  "#fab1a0", "#dfe6e9",
];

function getPairCount(gridSize) {
  switch (gridSize) {
    case 4: return 3;
    case 6: return 5;
    case 7: return 8;
    case 8: return 9;
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
 * グラフ上の pid 成分を端点から一筆書き順に { x: 列, y: 行 } の配列で返す。
 */
function getOrderedPathForPid(pid, solutionGrid, adj, n) {
  let sr = -1;
  let sc = -1;
  outer: for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (solutionGrid[r][c] !== pid) continue;
      if (adj[r][c].length === 1) {
        sr = r;
        sc = c;
        break outer;
      }
    }
  }
  if (sr < 0) {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (solutionGrid[r][c] === pid) {
          sr = r;
          sc = c;
          break;
        }
      }
      if (sr >= 0) break;
    }
  }
  if (sr < 0) return null;
  const path = [];
  let pr = -1;
  let pc = -1;
  let cr = sr;
  let cc = sc;
  const maxSteps = n * n + 5;
  for (let step = 0; step < maxSteps; step++) {
    path.push({ x: cc, y: cr });
    let nr = -1;
    let ncc = -1;
    for (const nk of adj[cr][cc]) {
      const tr = Math.floor(nk / n);
      const tc = nk % n;
      if (solutionGrid[tr][tc] !== pid) continue;
      if (tr === pr && tc === pc) continue;
      nr = tr;
      ncc = tc;
      break;
    }
    if (nr < 0) break;
    pr = cr;
    pc = cc;
    cr = nr;
    cc = ncc;
  }
  return path.length >= 2 ? path : null;
}

/**
 * path[idx] は列 tx 上。パス上で x !== tx となる最初の点を、まず後方 (idx-1…) 、次に前方 (idx+1…) で探す。
 * @returns {"L"|"R"|null} L: 見つかった点の x < tx（左側）、R: x > tx（右側）
 */
function classifyColumnPassSide(path, idx, tx) {
  if (!path || path.length < 2 || idx < 0 || idx >= path.length) return null;
  const len = path.length;
  const cap = len + 2;
  for (let k = 1; k <= cap && idx - k >= 0; k++) {
    const px = path[idx - k].x;
    if (px < tx) return "L";
    if (px > tx) return "R";
  }
  for (let k = 1; k <= cap && idx + k < len; k++) {
    const px = path[idx + k].x;
    if (px < tx) return "L";
    if (px > tx) return "R";
  }
  return null;
}

/**
 * path[idx] は行 ty 上。y !== ty となる最初の点を後方→前方で探す。
 * @returns {"B"|"A"|null} B: y < ty（下側）、A: y > ty（上側）
 */
function classifyRowPassSide(path, idx, ty) {
  if (!path || path.length < 2 || idx < 0 || idx >= path.length) return null;
  const len = path.length;
  const cap = len + 2;
  for (let k = 1; k <= cap && idx - k >= 0; k++) {
    const py = path[idx - k].y;
    if (py < ty) return "B";
    if (py > ty) return "A";
  }
  for (let k = 1; k <= cap && idx + k < len; k++) {
    const py = path[idx + k].y;
    if (py < ty) return "B";
    if (py > ty) return "A";
  }
  return null;
}

/**
 * 回り込みブラケット上の「腕」の向きを基準に、角から最大3セグメント以内に同じ軸で符号が逆のセグメントがあればエセ回り込み。
 * path: {x:列,y:行}。iMin/iMax は check*WrapEnclosure と同じく行／列上の最小・最大座標側のインデックス。
 */
function pickHorizontalBracketRef(path, len, nr, iBracket, xMin, xMax) {
  const segs = [];
  if (iBracket > 0 && path[iBracket - 1].y === nr && path[iBracket].y === nr) {
    const dx = path[iBracket].x - path[iBracket - 1].x;
    if (dx !== 0) segs.push({ to: iBracket, dx });
  }
  if (iBracket + 1 < len && path[iBracket].y === nr && path[iBracket + 1].y === nr) {
    const dx = path[iBracket + 1].x - path[iBracket].x;
    if (dx !== 0) segs.push({ to: iBracket + 1, dx });
  }
  if (segs.length === 0) return null;
  const bx = path[iBracket].x;
  const atMin = bx === xMin;
  const atMax = bx === xMax;
  let pick = segs[0];
  if (atMax) {
    const neg = segs.find((s) => s.dx < 0);
    if (neg) pick = neg;
  } else if (atMin) {
    const pos = segs.find((s) => s.dx > 0);
    if (pos) pick = pos;
  }
  const cornerIdx = pick.to;
  return { refDx: pick.dx, cornerIdx };
}

function tryHorizontalBracketCornerPseudo(path, nr, tCol, xMin, xMax, iBracket) {
  const len = path.length;
  if (!path || len < 2 || iBracket < 0 || iBracket >= len) return false;
  const ref = pickHorizontalBracketRef(path, len, nr, iBracket, xMin, xMax);
  if (!ref) return false;
  const { refDx, cornerIdx } = ref;
  if (refDx === 0) return false;
  const tLo = tCol - 2;
  const tHi = tCol + 2;
  for (let j = 1; j <= 3; j++) {
    const i1 = cornerIdx + j;
    if (i1 >= len) break;
    const p0 = path[cornerIdx + j - 1];
    const p1 = path[i1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    if (dy !== 0 || dx === 0) continue;
    if (Math.sign(dx) !== -Math.sign(refDx)) continue;
    const near =
      (p0.x >= tLo && p0.x <= tHi) ||
      (p1.x >= tLo && p1.x <= tHi) ||
      (p0.x < tCol && p1.x > tCol) ||
      (p0.x > tCol && p1.x < tCol);
    if (!near) continue;
    return true;
  }
  return false;
}

function isHorizontalBracketPseudoEnclosure(path, nr, tCol, xMin, xMax, iMin, iMax) {
  if (!path || path.length < 2) return false;
  return (
    tryHorizontalBracketCornerPseudo(path, nr, tCol, xMin, xMax, iMax) ||
    tryHorizontalBracketCornerPseudo(path, nr, tCol, xMin, xMax, iMin)
  );
}

/**
 * 垂直挟み込み用: ブラケット頂点 ib（列 nc 上）で、画面上の「水平」辺（同一行）の向き。
 * 上ブラケット（y 小さい方）は +x（R）を優先、下ブラケットは東から入る -x（L）を優先（見つからなければ他方）。
 * @returns {1|-1|null} 1=R(+x), -1=L(-x)
 */
function horizontalScreenArmAtVerticalBracket(path, ib, nc, isUpperBracket) {
  const len = path.length;
  if (!path || ib < 0 || ib >= len) return null;
  const b = path[ib];
  if (b.x !== nc) return null;
  let hasR = false;
  let hasL = false;
  if (ib > 0 && path[ib - 1].y === b.y) {
    const dx = path[ib].x - path[ib - 1].x;
    if (dx > 0) hasR = true;
    if (dx < 0) hasL = true;
  }
  if (ib + 1 < len && path[ib + 1].y === b.y) {
    const dx = path[ib + 1].x - path[ib].x;
    if (dx > 0) hasR = true;
    if (dx < 0) hasL = true;
  }
  if (isUpperBracket) {
    if (hasR) return 1;
    if (hasL) return -1;
  } else {
    if (hasL) return -1;
    if (hasR) return 1;
  }
  return null;
}

function verticalOppositeHorizontalArmsOk(armTop, armBottom) {
  if (armTop == null || armBottom == null) return false;
  return armTop * armBottom === -1;
}

/**
 * 垂直 pseudo: ブラケット ib の「東 or 西」側の水平隣を lateralI とし、ブラケットを出たもう一方へ進んだあと
 * パスに沿って最大 K 辺を見る。画面上水平で wantR なら +x（R）、!wantR なら -x（L）の辺があれば true。
 * skipFirstAdvance: true のとき、検査ループの前に 1 辺進める（上ブラケットで幹の第 1 水平辺を除外）。
 */
function verticalPseudoHorizontalKickback(
  path,
  nc,
  iBracket,
  K,
  lateralIsEast,
  wantR,
  skipFirstAdvance
) {
  const len = path.length;
  if (!path || len < 2 || iBracket < 0 || iBracket >= len || K < 1) return false;
  const b = path[iBracket];
  if (b.x !== nc) return false;
  let lateralI = -1;
  if (iBracket > 0 && path[iBracket - 1].y === b.y) {
    const lx = path[iBracket - 1].x;
    if (lateralIsEast && lx > b.x) lateralI = iBracket - 1;
    if (!lateralIsEast && lx < b.x) lateralI = iBracket - 1;
  }
  if (lateralI < 0 && iBracket + 1 < len && path[iBracket + 1].y === b.y) {
    const lx = path[iBracket + 1].x;
    if (lateralIsEast && lx > b.x) lateralI = iBracket + 1;
    if (!lateralIsEast && lx < b.x) lateralI = iBracket + 1;
  }
  if (lateralI < 0) return false;
  const otherI = lateralI === iBracket - 1 ? iBracket + 1 : iBracket - 1;
  if (otherI < 0 || otherI >= len) return false;
  let prev = iBracket;
  let cur = otherI;
  if (skipFirstAdvance) {
    const dir0 = cur - prev;
    const nxt0 = cur + dir0;
    if (nxt0 < 0 || nxt0 >= len) return false;
    prev = cur;
    cur = nxt0;
  }
  for (let e = 0; e < K; e++) {
    const pa = path[prev];
    const pb = path[cur];
    if (pa.y === pb.y) {
      const dx = pb.x - pa.x;
      if (wantR && dx > 0) return true;
      if (!wantR && dx < 0) return true;
    }
    const dir = cur - prev;
    const nxt = cur + dir;
    if (nxt < 0 || nxt >= len) {
      break;
    }
    prev = cur;
    cur = nxt;
  }
  return false;
}

const VERTICAL_PSEUDO_HORIZONTAL_K = 3;

/** 下ブラケット・東側からの回り込み → 続きで水平 R があれば pseudo */
function verticalPseudoHorizontalRAfterLowerBracketEast(path, nc, iBracket, K) {
  return verticalPseudoHorizontalKickback(path, nc, iBracket, K, true, true, false);
}

/** 下ブラケット・西側からの回り込み → 続きで水平 L があれば pseudo（東西対称） */
function verticalPseudoHorizontalLAfterLowerBracketWest(path, nc, iBracket, K) {
  return verticalPseudoHorizontalKickback(path, nc, iBracket, K, false, false, false);
}

/** 上ブラケット・東側からの回り込み → 続きで水平 L（1 辺先送りで幹を除外） */
function verticalPseudoHorizontalLAfterUpperBracketEast(path, nc, iBracket, K) {
  return verticalPseudoHorizontalKickback(path, nc, iBracket, K, true, false, true);
}

/** 上ブラケット・西側からの回り込み → 続きで水平 R（1 辺先送り） */
function verticalPseudoHorizontalRAfterUpperBracketWest(path, nc, iBracket, K) {
  return verticalPseudoHorizontalKickback(path, nc, iBracket, K, false, true, true);
}

function isVerticalPseudoByHorizontalContinuation(path, nc, iMin, iMax) {
  const K = VERTICAL_PSEUDO_HORIZONTAL_K;
  return (
    verticalPseudoHorizontalRAfterLowerBracketEast(path, nc, iMax, K) ||
    verticalPseudoHorizontalLAfterLowerBracketWest(path, nc, iMax, K) ||
    verticalPseudoHorizontalLAfterUpperBracketEast(path, nc, iMin, K) ||
    verticalPseudoHorizontalRAfterUpperBracketWest(path, nc, iMin, K)
  );
}

/**
 * 列 nc 上で y1<ty<y2 にターゲットがあり、上下ブラケット周りの「画面上水平」腕が逆向き（R vs L）であること。
 * path: {x:列,y:行}。画面上の水平 = 行 y 固定で列 x が変わる辺。
 */
function checkVerticalWrapEnclosure(path, nc, tRow) {
  // ターゲットに最も近い上下の交差をブラケットとする（y最小/最大ではなく）
  let yUpper = -Infinity;  // 上ブラケット: y < tRow のうち tRow に最も近い（最大の y）
  let yLower = Infinity;   // 下ブラケット: y > tRow のうち tRow に最も近い（最小の y）
  let iMin = -1;
  let iMax = -1;
  for (let i = 0; i < path.length; i++) {
    if (path[i].x !== nc) continue;
    const y = path[i].y;
    if (y < tRow && y > yUpper) {
      yUpper = y;
      iMin = i;
    }
    if (y > tRow && y < yLower) {
      yLower = y;
      iMax = i;
    }
  }
  if (iMin < 0 || iMax < 0 || !(yUpper < yLower)) {
    return { ok: false, reason: "no_column_span" };
  }
  // yUpper < tRow < yLower は上記ロジックで常に成立（両ブラケット存在時）
  if (path[iMin].x !== nc || path[iMax].x !== nc) {
    return { ok: false, reason: "invalid_bracket_column" };
  }
  let armTop = horizontalScreenArmAtVerticalBracket(path, iMin, nc, true);
  let armBottom = horizontalScreenArmAtVerticalBracket(path, iMax, nc, false);
  if (!verticalOppositeHorizontalArmsOk(armTop, armBottom)) {
    const rev = path.slice().reverse();
    const len = path.length;
    armTop = horizontalScreenArmAtVerticalBracket(rev, len - 1 - iMin, nc, true);
    armBottom = horizontalScreenArmAtVerticalBracket(rev, len - 1 - iMax, nc, false);
    if (!verticalOppositeHorizontalArmsOk(armTop, armBottom)) {
      return { ok: false, reason: "same_horizontal_arm_direction", sandwich: true, y1: yUpper, y2: yLower };
    }
  }
  if (isVerticalPseudoByHorizontalContinuation(path, nc, iMin, iMax)) {
    return { ok: false, reason: "pseudo_u_turn_enclosure_x", sandwich: true, y1: yUpper, y2: yLower };
  }
  return { ok: true, y1: yUpper, y2: yLower };
}

/**
 * 行 nr 上で x1<tx<x2 にターゲットがあり、(x1,nr) と (x2,nr) での y 方向追い越しが逆であること。
 */
function checkHorizontalWrapEnclosure(path, nr, tCol) {
  let xMin = Infinity;
  let xMax = -Infinity;
  let iMin = -1;
  let iMax = -1;
  for (let i = 0; i < path.length; i++) {
    if (path[i].y !== nr) continue;
    const x = path[i].x;
    if (x < xMin) {
      xMin = x;
      iMin = i;
    }
    if (x > xMax) {
      xMax = x;
      iMax = i;
    }
  }
  if (iMin < 0 || !(xMin < xMax)) {
    return { ok: false, reason: "no_row_span" };
  }
  if (!(xMin < tCol && tCol < xMax)) {
    return { ok: false, reason: "target_not_between_x" };
  }
  if (path[iMin].y !== nr || path[iMax].y !== nr) {
    return { ok: false, reason: "invalid_bracket_row" };
  }
  let sLeft = classifyRowPassSide(path, iMin, nr);
  let sRight = classifyRowPassSide(path, iMax, nr);
  if (sLeft == null || sRight == null) {
    return { ok: false, reason: "cannot_classify_y_pass", sandwich: true, x1: xMin, x2: xMax };
  }
  if (sLeft === sRight) {
    const rev = path.slice().reverse();
    const len = path.length;
    sLeft = classifyRowPassSide(rev, len - 1 - iMin, nr);
    sRight = classifyRowPassSide(rev, len - 1 - iMax, nr);
    if (sLeft == null || sRight == null || sLeft === sRight) {
      return { ok: false, reason: "same_y_pass_direction", sandwich: true, x1: xMin, x2: xMax };
    }
  }
  if (isHorizontalBracketPseudoEnclosure(path, nr, tCol, xMin, xMax, iMin, iMax)) {
    return { ok: false, reason: "pseudo_u_turn_enclosure_y", sandwich: true, x1: xMin, x2: xMax };
  }
  return { ok: true, x1: xMin, x2: xMax };
}

/**
 * 囲い込み（Enclosure）の件数 — 幾何的挟み＋**追い越し方向（変位）が逆**のときのみ。
 * 重複除去: **囲むパス pPid × 囲まれるパス qPid** につき最大 1 回（縦横・複数線・複数端点の重複はまとめる）
 */
function countPairLinkEnclosures(solutionGrid, adj, n) {
  const pidSet = new Set();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = solutionGrid[r][c];
      if (v) pidSet.add(v);
    }
  }
  const pids = Array.from(pidSet);
  const pathCache = new Map();
  for (let i = 0; i < pids.length; i++) {
    pathCache.set(pids[i], getOrderedPathForPid(pids[i], solutionGrid, adj, n));
  }
  const pairCounted = new Set();
  let count = 0;
  for (let nr = 0; nr < n; nr++) {
    for (let nc = 0; nc < n; nc++) {
      if (adj[nr][nc].length !== 1) continue;
      const qPid = solutionGrid[nr][nc];
      for (let pi = 0; pi < pids.length; pi++) {
        const pPid = pids[pi];
        if (pPid === qPid) continue;
        const pk = pPid + ">" + qPid;
        if (pairCounted.has(pk)) continue;
        const path = pathCache.get(pPid);
        if (!path) continue;
        const rv = checkVerticalWrapEnclosure(path, nc, nr);
        const rh = checkHorizontalWrapEnclosure(path, nr, nc);
        if (rv.ok || rh.ok) {
          pairCounted.add(pk);
          count++;
        }
      }
    }
  }
  return count;
}

/**
 * 囲い込みを列挙（変位ベースの追い越し方向が逆のときのみ debug 出力・配列へ）。
 * @param {Map<number,number>|null} pidToPairId 内部 pid → 表示用ペア ID（1..N）
 * @returns {{ count: number, debugEnclosures: object[] }}
 */
function analyzePairLinkEnclosuresDebug(solutionGrid, adj, n, pidToPairId, logToConsole) {
  const pidSet = new Set();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = solutionGrid[r][c];
      if (v) pidSet.add(v);
    }
  }
  const pids = Array.from(pidSet).sort((a, b) => a - b);
  const pathCache = new Map();
  for (let i = 0; i < pids.length; i++) {
    pathCache.set(pids[i], getOrderedPathForPid(pids[i], solutionGrid, adj, n));
  }
  const pairCounted = new Set();
  const debugEnclosures = [];
  let count = 0;

  function pairLabel(pid) {
    if (pidToPairId && pidToPairId.has(pid)) return pidToPairId.get(pid);
    return pid;
  }

  for (let nr = 0; nr < n; nr++) {
    for (let nc = 0; nc < n; nc++) {
      if (adj[nr][nc].length !== 1) continue;
      const qPid = solutionGrid[nr][nc];
      const pairN = pairLabel(qPid);

      for (let pi = 0; pi < pids.length; pi++) {
        const pPid = pids[pi];
        if (pPid === qPid) continue;
        const pairP = pairLabel(pPid);
        const path = pathCache.get(pPid);
        if (!path) continue;

        const pk = pPid + ">" + qPid;

        const rv = checkVerticalWrapEnclosure(path, nc, nr);
        const rh = checkHorizontalWrapEnclosure(path, nr, nc);

        if (pairCounted.has(pk)) {
          if (logToConsole) {
            if (rv.ok) {
              console.log(
                "[Enclosure Skipped] TargetPair: " +
                  pairN +
                  ", Line: X=" +
                  nc +
                  " (Y:" +
                  rv.y1 +
                  "-" +
                  rv.y2 +
                  "), OccupiedBy: PathID=" +
                  pairP +
                  " — reason: already counted pair " +
                  pairP +
                  "→" +
                  pairN +
                  " (one per victim path)"
              );
            } else if (rh.ok) {
              console.log(
                "[Enclosure Skipped] TargetPair: " +
                  pairN +
                  ", Line: Y=" +
                  nr +
                  " (X:" +
                  rh.x1 +
                  "-" +
                  rh.x2 +
                  "), OccupiedBy: PathID=" +
                  pairP +
                  " — reason: already counted pair " +
                  pairP +
                  "→" +
                  pairN +
                  " (one per victim path)"
              );
            }
          }
          continue;
        }

        if (rv.reason === "pseudo_u_turn_enclosure_x" && typeof rv.y1 === "number") {
          debugEnclosures.push({
            kind: "vertical",
            col: nc,
            y1: rv.y1,
            y2: rv.y2,
            nRow: nr,
            nCol: nc,
            pathIdP: pairP,
            pathIdN: pairN,
            pseudo: true,
          });
          pairCounted.add(pk);
          if (logToConsole) {
            console.log(
              "[Enclosure Pseudo] TargetPair: " +
                pairN +
                ", Line: X=" +
                nc +
                " (Y:" +
                rv.y1 +
                "-" +
                rv.y2 +
                "), OccupiedBy: PathID=" +
                pairP +
                " — rejected as pseudo U-turn (bracket-based)"
            );
          }
          continue;
        }
        if (rh.reason === "pseudo_u_turn_enclosure_y" && typeof rh.x1 === "number") {
          debugEnclosures.push({
            kind: "horizontal",
            row: nr,
            x1: rh.x1,
            x2: rh.x2,
            nRow: nr,
            nCol: nc,
            pathIdP: pairP,
            pathIdN: pairN,
            pseudo: true,
          });
          pairCounted.add(pk);
          if (logToConsole) {
            console.log(
              "[Enclosure Pseudo] TargetPair: " +
                pairN +
                ", Line: Y=" +
                nr +
                " (X:" +
                rh.x1 +
                "-" +
                rh.x2 +
                "), OccupiedBy: PathID=" +
                pairP +
                " — rejected as pseudo U-turn (bracket-based)"
            );
          }
          continue;
        }

        if (!rv.ok && !rh.ok) {
          if (logToConsole && rv.sandwich) {
            console.log(
              "[Enclosure Skipped] TargetPair: " +
                pairN +
                ", Line: X=" +
                nc +
                " (Y:" +
                rv.y1 +
                "-" +
                rv.y2 +
                "), OccupiedBy: PathID=" +
                pairP +
                " — reason: " +
                rv.reason +
                " (geometric sandwich but not opposite X-displacement pass)"
            );
          }
          if (logToConsole && rh.sandwich) {
            console.log(
              "[Enclosure Skipped] TargetPair: " +
                pairN +
                ", Line: Y=" +
                nr +
                " (X:" +
                rh.x1 +
                "-" +
                rh.x2 +
                "), OccupiedBy: PathID=" +
                pairP +
                " — reason: " +
                rh.reason +
                " (geometric sandwich but not opposite Y-displacement pass)"
            );
          }
          continue;
        }

        pairCounted.add(pk);
        count++;
        if (rv.ok) {
          debugEnclosures.push({
            kind: "vertical",
            col: nc,
            y1: rv.y1,
            y2: rv.y2,
            nRow: nr,
            nCol: nc,
            pathIdP: pairP,
            pathIdN: pairN,
          });
          if (logToConsole) {
            console.log(
              "[Enclosure Found] TargetPair: " +
                pairN +
                ", Line: X=" +
                nc +
                " (Y:" +
                rv.y1 +
                "-" +
                rv.y2 +
                "), OccupiedBy: PathID=" +
                pairP +
                " (opposite X pass: L/R)"
            );
          }
        } else {
          debugEnclosures.push({
            kind: "horizontal",
            row: nr,
            x1: rh.x1,
            x2: rh.x2,
            nRow: nr,
            nCol: nc,
            pathIdP: pairP,
            pathIdN: pairN,
          });
          if (logToConsole) {
            console.log(
              "[Enclosure Found] TargetPair: " +
                pairN +
                ", Line: Y=" +
                nr +
                " (X:" +
                rh.x1 +
                "-" +
                rh.x2 +
                "), OccupiedBy: PathID=" +
                pairP +
                " (opposite Y pass: B/A)"
            );
          }
        }
      }
    }
  }
  return { count, debugEnclosures };
}

/** Worker 側: Edge-Swap スコア定数（pair-link-edge-swap-score.ts と同値に保つ） */
function mergeEdgeSwapScoreParams(raw) {
  const d = {
    coverageMult: 1.5,
    wEndpoint: 2,
    wParallel: 7,
    enclosureMult: 1.5,
    semiDist3Weight: 0.5,
    adjRateT1: 0.15,
    adjRateT2: 0.3,
    straightRatioThreshold: 0.4,
    straightPenaltyBase: 150,
    straightPenaltySlope: 2500,
    dominanceRatioThreshold: 0.3,
    dominancePenaltyBase: 200,
    dominancePenaltySlope: 3000,
  };
  if (!raw || typeof raw !== "object") return d;
  const keys = Object.keys(d);
  for (let ki = 0; ki < keys.length; ki++) {
    const key = keys[ki];
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      if (key === "adjRateT1" || key === "adjRateT2" || key === "straightRatioThreshold" || key === "dominanceRatioThreshold") {
        d[key] = Math.max(0.01, Math.min(0.99, v));
      } else if (key === "straightPenaltyBase" || key === "straightPenaltySlope" || key === "dominancePenaltyBase" || key === "dominancePenaltySlope") {
        d[key] = Math.max(0, Math.min(10000, v));
      } else {
        d[key] = Math.max(0, Math.min(30, v));
      }
    }
  }
  if (d.adjRateT2 <= d.adjRateT1) {
    d.adjRateT2 = Math.min(0.99, d.adjRateT1 + 0.01);
  }
  return d;
}

function pathCellsInOrder(cells, adj, n) {
  if (cells.length < 2) return cells;
  const cellSet = new Set(cells.map(function (c) { return c.r * n + c.c; }));
  const endpoints = cells.filter(function (c) { return adj[c.r][c.c].length === 1; });
  if (endpoints.length < 2) return cells;
  const start = endpoints[0];
  const out = [start];
  const seen = new Set([start.r * n + start.c]);
  let cur = start;
  while (out.length < cells.length) {
    var next = null;
    for (var ni = 0; ni < adj[cur.r][cur.c].length; ni++) {
      const nk = adj[cur.r][cur.c][ni];
      const nr = Math.floor(nk / n);
      const nc = nk % n;
      if (cellSet.has(nk) && !seen.has(nk)) {
        next = { r: nr, c: nc };
        break;
      }
    }
    if (!next) break;
    out.push(next);
    seen.add(next.r * n + next.c);
    cur = next;
  }
  return out;
}

function straightRunRatio(ordered) {
  if (ordered.length < 2) return 1;
  let maxRun = 1;
  let curRun = 1;
  let prevDir = null;
  for (let i = 1; i < ordered.length; i++) {
    const dr = ordered[i].r - ordered[i - 1].r;
    const dc = ordered[i].c - ordered[i - 1].c;
    const dir = Math.abs(dr) > 0 ? 1 : 0;
    if (dir === prevDir) {
      curRun++;
    } else {
      maxRun = Math.max(maxRun, curRun);
      curRun = 1;
      prevDir = dir;
    }
  }
  maxRun = Math.max(maxRun, curRun);
  return maxRun / ordered.length;
}

/** adjRate に応じた段階ペナルティ（正の値＝FinalScore から減算）。第3しきい値 0.45 は固定 */
function adjacencyRateTierPenalty(adjRate, sp) {
  const t3 = 0.45;
  if (adjRate < sp.adjRateT1) return 0;
  if (adjRate < sp.adjRateT2) return 200;
  if (adjRate < t3) return 1000;
  return 5000 + adjRate * 10000;
}

/**
 * Edge-Swap ミューテーション用スコア。
 * Coverage: Σ(A/L) × 1.5（面積支配の優遇）
 * Interference: 端点8近傍はセルあたり1回まで、並走もセルあたり1回まで
 * Enclosures: 厳格エンクロージャ件数
 * 隣接密度: 各パスについて「同じIDの2端点間」のマンハッタン距離 m のみ（他ペアの端点同士は対象外）
 *   m<=2 → adjCount（Dist2）、m===3 → semiAdjCount（Dist3）
 *   weightedAdjSum = adjCount + semiAdjCount*0.5、adjRate = weightedAdjSum / pathCount（パス本数）
 *   段階ペナルティを scale（0〜499:0.5、500〜:1、null:1）で乗じて減算
 * FinalScore = (Coverage*cM + InterferenceW) * (1 + Enclosures*eM) - tierPenalty*scale
 */
function computeMutationScoreBreakdown(
  solutionGrid,
  adj,
  n,
  mutationAttemptIndex,
  scoreParams
) {
  const sp = mergeEdgeSwapScoreParams(scoreParams);
  const adjacentPenaltyScale =
    mutationAttemptIndex == null
      ? 1
      : mutationAttemptIndex < 500
        ? 0.5
        : 1;

  const byPid = new Map();
  for (let rr = 0; rr < n; rr++) {
    for (let cc = 0; cc < n; cc++) {
      const p = solutionGrid[rr][cc];
      if (!p) continue;
      if (!byPid.has(p)) byPid.set(p, []);
      byPid.get(p).push({ r: rr, c: cc });
    }
  }

  const interiorOfPid = new Map();
  for (const [pid, cells] of byPid) {
    const intSet = new Set();
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i].r;
      const c = cells[i].c;
      if (adj[r][c].length === 2) intSet.add(r * n + c);
    }
    interiorOfPid.set(pid, intSet);
  }

  const epList = [];
  const epsByPid = new Map();
  for (const [pid, cells] of byPid) {
    if (cells.length < 2) continue;
    const endpoints = cells.filter(({ r: rr, c: cc }) => adj[rr][cc].length === 1);
    if (endpoints.length < 2) continue;
    epsByPid.set(pid, endpoints);
    let bestA = endpoints[0];
    let bestB = endpoints[1];
    let bestD = -1;
    for (let j = 0; j < endpoints.length; j++) {
      for (let k = j + 1; k < endpoints.length; k++) {
        const d =
          Math.abs(endpoints[j].r - endpoints[k].r) +
          Math.abs(endpoints[j].c - endpoints[k].c);
        if (d > bestD) {
          bestD = d;
          bestA = endpoints[j];
          bestB = endpoints[k];
        }
      }
    }
    epList.push({ a: bestA, b: bestB });
  }

  let adjCount = 0;
  let semiAdjCount = 0;
  for (let i = 0; i < epList.length; i++) {
    const a = epList[i].a;
    const b = epList[i].b;
    const m = Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
    if (m <= 2) adjCount++;
    else if (m === 3) semiAdjCount++;
  }

  const pathCount = epList.length;
  const weightedAdjSum = adjCount + semiAdjCount * sp.semiDist3Weight;
  const adjRate = pathCount > 0 ? weightedAdjSum / pathCount : 0;
  const adjacencyTierPenaltyRaw = adjacencyRateTierPenalty(adjRate, sp);
  const adjacencyPenaltyApplied =
    adjacencyTierPenaltyRaw * adjacentPenaltyScale;

  let coverageScore = 0;
  for (const [, cells] of byPid) {
    if (cells.length < 2) continue;
    let minX = n;
    let maxX = -1;
    let minY = n;
    let maxY = -1;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i].c;
      const r = cells[i].r;
      if (c < minX) minX = c;
      if (c > maxX) maxX = c;
      if (r < minY) minY = r;
      if (r > maxY) maxY = r;
    }
    const A = (maxX - minX + 1) * (maxY - minY + 1);
    const L = cells.length;
    if (L > 0) coverageScore += A / L;
  }

  let interferenceEndpoint = 0;
  for (const [pid, cells] of byPid) {
    if (cells.length < 2) continue;
    for (let ci = 0; ci < cells.length; ci++) {
      const r = cells[ci].r;
      const c = cells[ci].c;
      let hit = false;
      for (const [qid, eps] of epsByPid) {
        if (qid === pid) continue;
        for (let ei = 0; ei < eps.length; ei++) {
          const er = eps[ei].r;
          const ec = eps[ei].c;
          const king = Math.max(Math.abs(r - er), Math.abs(c - ec));
          if (king === 1) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (hit) interferenceEndpoint++;
    }
  }

  const orthoDirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  let interferenceParallel = 0;
  for (const [pid, cells] of byPid) {
    if (cells.length < 2) continue;
    for (let ci = 0; ci < cells.length; ci++) {
      const r = cells[ci].r;
      const c = cells[ci].c;
      let parHit = false;
      for (let di = 0; di < orthoDirs.length; di++) {
        const nr = r + orthoDirs[di][0];
        const nc = c + orthoDirs[di][1];
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        const q = solutionGrid[nr][nc];
        if (q == null || q === pid) continue;
        const intSet = interiorOfPid.get(q);
        if (intSet && intSet.has(nr * n + nc)) {
          parHit = true;
          break;
        }
      }
      if (parHit) interferenceParallel++;
    }
  }

  const interferenceWeighted =
    sp.wEndpoint * interferenceEndpoint + sp.wParallel * interferenceParallel;
  const interferenceScore = interferenceWeighted;

  const enclosureCount = countPairLinkEnclosures(solutionGrid, adj, n);
  const base = coverageScore * sp.coverageMult + interferenceWeighted;
  let finalScore =
    base * (1 + enclosureCount * sp.enclosureMult) - adjacencyPenaltyApplied;

  let straightPairCount = 0;
  for (const [pid, cells] of byPid) {
    if (cells.length < 2) continue;
    const eps = epsByPid.get(pid);
    const manhattan = (eps && eps.length >= 2)
      ? Math.abs(eps[0].r - eps[1].r) + Math.abs(eps[0].c - eps[1].c)
      : 999;
    const ordered = pathCellsInOrder(cells, adj, n);
    const ratio = straightRunRatio(ordered);
    if (manhattan === 1 || ratio >= 0.8) straightPairCount++;
  }
  const straightPairRatio = pathCount > 0 ? straightPairCount / pathCount : 0;
  let straightPenalty = 0;
  if (straightPairRatio > sp.straightRatioThreshold) {
    straightPenalty = sp.straightPenaltyBase + (straightPairRatio - sp.straightRatioThreshold) * sp.straightPenaltySlope;
  }

  const lengths = [];
  for (const [, cells] of byPid) {
    if (cells.length >= 2) lengths.push(cells.length);
  }
  lengths.sort(function (a, b) { return b - a; });
  const top2Sum = (lengths[0] || 0) + (lengths[1] || 0);
  const dominanceRatio = top2Sum / (n * n);
  let dominancePenalty = 0;
  if (dominanceRatio > sp.dominanceRatioThreshold) {
    dominancePenalty = sp.dominancePenaltyBase + (dominanceRatio - sp.dominanceRatioThreshold) * sp.dominancePenaltySlope;
  }

  finalScore -= straightPenalty + dominancePenalty;

  return {
    coverageScore,
    coverageWeighted: coverageScore * sp.coverageMult,
    interferenceScore,
    interferenceEndpoint,
    interferenceParallel,
    enclosureCount,
    adjCount,
    semiAdjCount,
    pathCount,
    weightedAdjSum,
    adjRate,
    adjacencyTierPenaltyRaw,
    adjacencyPenaltyApplied,
    adjacentPenaltyScale,
    base,
    straightPairRatio,
    straightPenalty,
    dominanceRatio,
    dominancePenalty,
    finalScore,
  };
}

function logFinalScoreDetail(bd, tag) {
  if (typeof console === "undefined") return;
  const t = tag ? tag + " " : "";
  const adjPct = (bd.adjRate * 100).toFixed(1);
  console.log(
    t +
      "[Final Score Detail] Total: " +
      bd.finalScore +
      ", Coverage: " +
      bd.coverageScore +
      ", Interference: " +
      bd.interferenceScore +
      ", Enclosures: " +
      bd.enclosureCount +
      ", AdjRate: " +
      adjPct +
      "%, Dist2: " +
      bd.adjCount +
      ", Dist3: " +
      bd.semiAdjCount
  );
}

/**
 * generateByEdgeSwap: 動的グリッド（主に 7〜8）用エンジン
 * Phase 1: 行優先で空きマスにドミノ／既存パス端への接続を一般化（全セル埋め）
 * Phase 2: パス統合（目標ペア数まで隣接端同士を結合）
 * @param {{ targetEnclosureCount?: number, debugEnclosureViz?: boolean }} [mutationOpts]
 *   スワップ採択は FinalScore = (Coverage×1.5+InterferenceW)×(1+囲い込み×1.5)−隣接割合段階ペナルティ×scale（隣接率は各パス内の2端点間距離のみ）。
 */
function generateByEdgeSwap(gridSize, targetPairCount, random, mutationOpts) {
  const mOpts = mutationOpts || {};
  const scoreParamsEffective = mergeEdgeSwapScoreParams(mOpts.edgeSwapScoreParams);
  const targetEnc =
    typeof mOpts.targetEnclosureCount === "number" && mOpts.targetEnclosureCount >= 0
      ? mOpts.targetEnclosureCount
      : null;
  const debugEnclosureViz = !!mOpts.debugEnclosureViz;
  const n = gridSize | 0;
  if (n < 4 || n > 12) return null;
  const nn = n * n;
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

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (solutionGrid[r][c] === 0) {
        if (typeof console !== "undefined") {
          console.warn("[Edge-Swap] Phase 1: unfilled cell at", r, c, "regenerating...");
        }
        return generateByEdgeSwap(gridSize, targetPairCount, random, mOpts);
      }
    }
  }

  const initialPathIds = new Set();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      initialPathIds.add(solutionGrid[r][c]);
    }
  }
  let pathCount = initialPathIds.size;

  if (pathCount < targetPairCount) {
    if (typeof console !== "undefined") {
      console.warn(
        "[Edge-Swap] Phase 1 path count " + pathCount + " < target " + targetPairCount + ", regenerating..."
      );
    }
    return generateByEdgeSwap(gridSize, targetPairCount, random, mOpts);
  }

  if (typeof console !== "undefined") {
    console.log(
      "Phase 1: Tiling complete. Cells: " + nn + ", initial paths: " + pathCount
    );
  }

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
      return generateByEdgeSwap(gridSize, targetPairCount, random, mOpts);
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
    const expectDeg1 = 2 * targetPairCount;
    const expectDeg2 = nn - expectDeg1;
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
    if (deg1Count !== expectDeg1 || deg2Count !== expectDeg2) {
      if (typeof console !== "undefined") {
        console.error(
          "[Edge-Swap] Validation failed: deg1=" +
            deg1Count +
            " deg2=" +
            deg2Count +
            " (expected " +
            expectDeg1 +
            ", " +
            expectDeg2 +
            ")"
        );
      }
      return false;
    }
    if (typeof console !== "undefined") {
      console.log(
        "[Edge-Swap] Degree validation: deg1=" + expectDeg1 + " deg2=" + expectDeg2 + " OK"
      );
    }
    return true;
  }

  if (!validateGrid()) {
    if (typeof console !== "undefined") {
      console.error("[Edge-Swap] Grid validation failed. Regenerating...");
    }
    return generateByEdgeSwap(gridSize, targetPairCount, random, mOpts);
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
    if (typeof console !== "undefined" && attempt > 0 && attempt % 200 === 0) {
      const snap = computeMutationScoreBreakdown(
        solutionGrid,
        adj,
        n,
        attempt,
        scoreParamsEffective
      );
      logFinalScoreDetail(snap, "[Periodic]");
    }

    const r = Math.floor(random() * (n - 1));
    const c = Math.floor(random() * (n - 1));
    const tl = { r, c }, tr = { r: r, c: c + 1 }, bl = { r: r + 1, c }, br = { r: r + 1, c: c + 1 };
    const pid = solutionGrid[tl.r][tl.c];
    if (!pid || solutionGrid[tr.r][tr.c] !== pid || solutionGrid[bl.r][bl.c] !== pid || solutionGrid[br.r][br.c] !== pid) continue;

    let pattern = null;
    if (hasEdge(tl.r, tl.c, bl.r, bl.c) && hasEdge(tr.r, tr.c, br.r, br.c)) pattern = "A";
    else if (hasEdge(tl.r, tl.c, tr.r, tr.c) && hasEdge(bl.r, bl.c, br.r, br.c)) pattern = "B";
    if (!pattern) continue;

    const scoreBefore = computeMutationScoreBreakdown(
      solutionGrid,
      adj,
      n,
      attempt,
      scoreParamsEffective
    );

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

    const scoreAfter = computeMutationScoreBreakdown(
      solutionGrid,
      adj,
      n,
      attempt,
      scoreParamsEffective
    );
    if (scoreAfter.finalScore <= scoreBefore.finalScore) {
      revertPattern(pattern, tl, tr, bl, br);
      continue;
    }

    swapCount++;
  }

  const mutFinal = computeMutationScoreBreakdown(
    solutionGrid,
    adj,
    n,
    null,
    scoreParamsEffective
  );
  /** ミューテーション直後（クロール前）。最終値は buildSolutionPaths 後に上書き */
  let postMutationScoreBreakdown = mutFinal;
  if (typeof console !== "undefined") {
    console.log("Mutation Complete - Successful Swaps: " + swapCount);
    logFinalScoreDetail(mutFinal, "Mutation —");
    if (targetEnc != null) {
      console.log(
        "Mutation — targetEnclosureCount (debug ref only): " + targetEnc
      );
    }
  }

  if (!validateGrid()) {
    if (typeof console !== "undefined") {
      console.error("[Edge-Swap] Post-mutation validation failed. Regenerating...");
    }
    return generateByEdgeSwap(gridSize, targetPairCount, random, mOpts);
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
    return generateByEdgeSwap(gridSize, targetPairCount, random, mOpts);
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

  postMutationScoreBreakdown = computeMutationScoreBreakdown(
    solutionGrid,
    adj,
    n,
    null,
    scoreParamsEffective
  );
  if (typeof console !== "undefined" && !mOpts.suppressFinalLog) {
    logFinalScoreDetail(postMutationScoreBreakdown, "Final Board —");
  }

  let totalCount = 0;
  for (const k of Object.keys(solutionPaths)) {
    const segs = solutionPaths[k];
    if (Array.isArray(segs)) for (const seg of segs) totalCount += (seg && seg.length) | 0;
  }

  /** デバッグ可視化時のみ詳細列挙（ログ + クライアントへ返す座標） */
  let encAnalysis = null;
  if (debugEnclosureViz) {
    if (typeof console !== "undefined") {
      console.log("[Enclosure Debug] Final enumeration (Found / Skipped) —");
    }
    encAnalysis = analyzePairLinkEnclosuresDebug(
      solutionGrid,
      adj,
      n,
      pathToOutId,
      typeof console !== "undefined"
    );
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
    console.log("Final Grid Check: " + (totalCells === nn ? "PERFECT" : "FAILED"));
    if (totalCells !== nn) {
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

    let manhattanPairs = 0;
    for (let pi = 0; pi < pairs.length; pi++) {
      manhattanPairs +=
        Math.abs(pairs[pi].start[0] - pairs[pi].end[0]) +
        Math.abs(pairs[pi].start[1] - pairs[pi].end[1]);
    }
    const finalEncCount =
      encAnalysis != null
        ? encAnalysis.count
        : postMutationScoreBreakdown.enclosureCount;
    const encTargetLabel = targetEnc == null ? "-" : String(targetEnc);
    console.log(
      "Grid: " +
        n +
        "x" +
        n +
        ", Pairs: " +
        pairs.length +
        ", Enclosures: " +
        finalEncCount +
        "/" +
        encTargetLabel +
        ", Manhattan: " +
        manhattanPairs
    );
  }

  return {
    grid: outGrid,
    pairs,
    solutionPaths,
    difficultyScore: 0,
    debugEnclosures: encAnalysis != null ? encAnalysis.debugEnclosures : null,
    postMutationScoreBreakdown,
  };
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

  if (gridSize >= 4 && gridSize <= 10 && generationMode === "edgeSwap") {
    const minPairs = gridSize <= 6 ? Math.max(2, gridSize - 2) : (gridSize >= 9 ? 8 : (gridSize === 7 ? 7 : 8));
    const maxPairsEdge = gridSize <= 6 ? gridSize : 10;
    const scoreThreshold = typeof cfg.scoreThreshold === "number" ? cfg.scoreThreshold : -1;
    const hasSeed = seed != null && String(seed).trim() !== "";
    const applyThreshold = !hasSeed && scoreThreshold >= 0 && gridSize > 6;
    const totalStart = performance.now();
    let attempts = 0;
    let candidate = null;
    let attemptSeed = "";
    let random = null;

    const maxRetries = applyThreshold ? 200 : 1;
    do {
      attempts += 1;
      if (attempts > maxRetries) return null;
      attemptSeed = hasSeed ? String(seed) : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
      random = createRandom(attemptSeed);
      const targetPairCount = Math.max(minPairs, Math.min(maxPairsEdge, pairCount));
      const edgeMutationOpts = {};
      if (typeof cfg.targetEnclosureCount === "number" && cfg.targetEnclosureCount >= 0) {
        edgeMutationOpts.targetEnclosureCount = cfg.targetEnclosureCount;
      }
      if (cfg.debugEnclosureViz) edgeMutationOpts.debugEnclosureViz = true;
      if (cfg.edgeSwapScoreParams && typeof cfg.edgeSwapScoreParams === "object") {
        edgeMutationOpts.edgeSwapScoreParams = cfg.edgeSwapScoreParams;
      }
      if (applyThreshold) edgeMutationOpts.suppressFinalLog = true;
      candidate = generateByEdgeSwap(gridSize, targetPairCount, random, edgeMutationOpts);
      if (!candidate) return null;
      if (applyThreshold && candidate.postMutationScoreBreakdown != null) {
        if (candidate.postMutationScoreBreakdown.finalScore >= scoreThreshold) {
          if (typeof console !== "undefined") {
            logFinalScoreDetail(candidate.postMutationScoreBreakdown, "Final Board —");
          }
          break;
        }
        candidate = null;
      } else {
        break;
      }
    } while (candidate === null);

    if (!candidate) return null;

    const elapsed = Math.round(performance.now() - totalStart);
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
      gridSize,
      pairCount,
      profile: { EdgeSwap: elapsed },
      attempts,
      totalMs: elapsed,
      seed: attemptSeed,
      solutionPaths: candidate.solutionPaths || null,
      debugEnclosures: candidate.debugEnclosures || null,
      postMutationScoreBreakdown: candidate.postMutationScoreBreakdown || null,
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
          debugEnclosures: result.debugEnclosures || null,
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
