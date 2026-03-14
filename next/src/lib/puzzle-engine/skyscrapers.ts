/**
 * スカイスクレイパーパズルエンジン（サーバー専用）
 * クライアントには一切エクスポートしない
 */

export type Difficulty = "easy" | "normal" | "hard";

export interface Clues {
  top: (number | null)[];
  bottom: (number | null)[];
  left: (number | null)[];
  right: (number | null)[];
}

export interface Puzzle {
  solution: number[][];
  clues: Clues;
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function latinBase(n: number): number[][] {
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => ((r + c) % n) + 1)
  );
}

function permuteGrid(grid: number[][]): number[][] {
  const n = grid.length;
  let g = grid.map((r) => [...r]);

  for (let k = 0; k < n * 2; k++) {
    const r1 = Math.floor(Math.random() * n);
    const r2 = Math.floor(Math.random() * n);
    [g[r1], g[r2]] = [g[r2], g[r1]];
  }
  for (let k = 0; k < n * 2; k++) {
    const c1 = Math.floor(Math.random() * n);
    const c2 = Math.floor(Math.random() * n);
    for (let r = 0; r < n; r++) {
      [g[r][c1], g[r][c2]] = [g[r][c2], g[r][c1]];
    }
  }
  const map = shuffle(Array.from({ length: n }, (_, i) => i + 1));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      g[r][c] = map[g[r][c] - 1];
    }
  }
  return g;
}

function visibleCount(arr: number[]): number {
  let max = 0,
    cnt = 0;
  for (const h of arr) {
    if (h > max) {
      max = h;
      cnt++;
    }
  }
  return cnt;
}

function computeClues(sol: number[][]): Clues {
  const n = sol.length;
  const top: (number | null)[] = [];
  const bottom: (number | null)[] = [];
  const left: (number | null)[] = [];
  const right: (number | null)[] = [];

  for (let i = 0; i < n; i++) {
    left[i] = visibleCount(sol[i]);
    right[i] = visibleCount([...sol[i]].reverse());
    const col = Array.from({ length: n }, (_, r) => sol[r][i]);
    top[i] = visibleCount(col);
    bottom[i] = visibleCount(col.slice().reverse());
  }
  return { top, bottom, left, right };
}

function cloneClues(cl: Clues): Clues {
  return {
    top: [...cl.top],
    bottom: [...cl.bottom],
    left: [...cl.left],
    right: [...cl.right],
  };
}

function countSolutionsWithClues(
  n: number,
  clues: Clues,
  nodeLimit = 5_000_000
): number {
  const rows = Array.from({ length: n }, () => Array(n).fill(0));
  const usedRow = Array.from({ length: n }, () => new Set<number>());
  const usedCol = Array.from({ length: n }, () => new Set<number>());
  let solutions = 0;
  let nodes = 0;

  function fullLineOK(
    line: number[],
    L: number | null,
    R: number | null
  ): boolean {
    if (line.every((x) => x !== 0)) {
      if (L != null && visibleCount(line) !== L) return false;
      if (R != null && visibleCount([...line].reverse()) !== R) return false;
    }
    return true;
  }

  function partialOK(line: number[], L: number | null): boolean {
    if (L == null) return true;
    let max = 0,
      c = 0;
    for (const v of line) {
      if (v === 0) break;
      if (v > max) {
        max = v;
        c++;
      }
    }
    return c <= L;
  }

  function dfs(r: number, c: number): void {
    if (solutions >= 2) return;
    nodes++;
    if (nodes > nodeLimit) return;

    if (r === n) {
      for (let col = 0; col < n; col++) {
        const colArr = Array.from({ length: n }, (_, rr) => rows[rr][col]);
        if (!fullLineOK(colArr, clues.top[col], clues.bottom[col])) return;
      }
      solutions++;
      return;
    }

    const nr = c === n - 1 ? r + 1 : r;
    const nc = c === n - 1 ? 0 : c + 1;

    for (let v = 1; v <= n; v++) {
      if (usedRow[r].has(v) || usedCol[c].has(v)) continue;
      rows[r][c] = v;
      usedRow[r].add(v);
      usedCol[c].add(v);

      if (!partialOK(rows[r], clues.left[r])) {
        usedRow[r].delete(v);
        usedCol[c].delete(v);
        rows[r][c] = 0;
        continue;
      }
      if (nc === 0 && !fullLineOK(rows[r], clues.left[r], clues.right[r])) {
        usedRow[r].delete(v);
        usedCol[c].delete(v);
        rows[r][c] = 0;
        continue;
      }
      if (r === n - 1) {
        const colArr = Array.from({ length: n }, (_, rr) => rows[rr][c]);
        if (!fullLineOK(colArr, clues.top[c], clues.bottom[c])) {
          usedRow[r].delete(v);
          usedCol[c].delete(v);
          rows[r][c] = 0;
          continue;
        }
      }

      dfs(nr, nc);
      usedRow[r].delete(v);
      usedCol[c].delete(v);
      rows[r][c] = 0;
      if (solutions >= 2) return;
    }
  }

  dfs(0, 0);
  return solutions;
}

export function generateUniquePuzzle(
  n: number,
  difficulty: Difficulty = "normal",
  maxTries = 40
): Puzzle {
  let solution = permuteGrid(latinBase(n));
  let full = computeClues(solution);
  const sideCount = 4 * n;
  const keepRatio =
    difficulty === "easy" ? 0.75 : difficulty === "hard" ? 0.35 : 0.5;
  const target = Math.max(n * 2, Math.round(sideCount * keepRatio));
  let best = cloneClues(full);

  const pos: { side: keyof Clues; index: number }[] = [];
  for (let i = 0; i < n; i++) pos.push({ side: "top", index: i });
  for (let i = 0; i < n; i++) pos.push({ side: "bottom", index: i });
  for (let i = 0; i < n; i++) pos.push({ side: "left", index: i });
  for (let i = 0; i < n; i++) pos.push({ side: "right", index: i });

  function keeps(cl: Clues): number {
    return [...cl.top, ...cl.bottom, ...cl.left, ...cl.right].filter(
      (x) => x != null
    ).length;
  }

  let order = shuffle(pos);
  let tries = 0;

  while (tries < maxTries) {
    const cand = cloneClues(best);
    for (const p of order) {
      if (keeps(cand) <= target) break;
      const prev = cand[p.side][p.index];
      cand[p.side][p.index] = null;
      const solCnt = countSolutionsWithClues(n, cand);
      if (solCnt !== 1) cand[p.side][p.index] = prev;
    }
    if (countSolutionsWithClues(n, cand) === 1) {
      best = cand;
      break;
    }
    solution = permuteGrid(latinBase(n));
    full = computeClues(solution);
    best = cloneClues(full);
    order = shuffle(pos);
    tries++;
  }

  return { solution, clues: best };
}

/** ルールベースの途中判定（手がかりとの整合性、重複チェック） */
export function validateProgress(
  grid: number[][],
  clues: Clues,
  n: number
): { ok: boolean; msg: string } {
  for (let r = 0; r < n; r++) {
    const seen = new Set<number>();
    for (let c = 0; c < n; c++) {
      const v = grid[r]?.[c] ?? 0;
      if (v === 0) continue;
      if (seen.has(v)) return { ok: false, msg: `行${r + 1}で数字が重複しています。` };
      seen.add(v);
    }
  }
  for (let c = 0; c < n; c++) {
    const seen = new Set<number>();
    for (let r = 0; r < n; r++) {
      const v = grid[r]?.[c] ?? 0;
      if (v === 0) continue;
      if (seen.has(v)) return { ok: false, msg: `列${c + 1}で数字が重複しています。` };
      seen.add(v);
    }
  }
  function fullOK(line: number[], L: number | null, R: number | null): boolean {
    if (line.every((x) => x !== 0)) {
      if (L != null && visibleCount(line) !== L) return false;
      if (R != null && visibleCount([...line].reverse()) !== R) return false;
    }
    return true;
  }
  for (let i = 0; i < n; i++) {
    const row = grid[i] ?? [];
    if (!fullOK(row, clues.left[i] ?? null, clues.right[i] ?? null)) {
      return { ok: false, msg: `行${i + 1}の可視数ヒントと一致しません。` };
    }
    const col = Array.from({ length: n }, (_, r) => grid[r]?.[i] ?? 0);
    if (!fullOK(col, clues.top[i] ?? null, clues.bottom[i] ?? null)) {
      return { ok: false, msg: `列${i + 1}の可視数ヒントと一致しません。` };
    }
  }
  return { ok: true, msg: "ルールに矛盾は見つかりません。続けましょう。" };
}

/** 回答が正解と一致するか検証（サーバー専用） */
export function validateAgainstSolution(
  grid: number[][],
  solution: number[][]
): { ok: boolean; msg: string } {
  const n = solution.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const gv = grid[r]?.[c] ?? 0;
      const sv = solution[r][c];
      if (gv !== sv) {
        return { ok: false, msg: `(${r + 1}, ${c + 1}) が正解と異なります。` };
      }
    }
  }
  return { ok: true, msg: "正解です！" };
}
