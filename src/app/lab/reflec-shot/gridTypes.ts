/** グリッド上の移動方向（列 dx, 行 dy。dy<0 が上） */
export type Dir = { dx: number; dy: number };

export const DIR = {
  U: { dx: 0, dy: -1 },
  D: { dx: 0, dy: 1 },
  L: { dx: -1, dy: 0 },
  R: { dx: 1, dy: 0 },
} as const;

export type BumperKind = "SLASH" | "BACKSLASH" | "HYPHEN" | "PIPE";

export const BUMPER_KINDS: BumperKind[] = ["SLASH", "BACKSLASH", "HYPHEN", "PIPE"];

export type CellCoord = { c: number; r: number };

export function keyCell(c: number, r: number) {
  return `${c},${r}`;
}

export function parseKey(k: string): CellCoord {
  const [c, r] = k.split(",").map(Number);
  return { c: c!, r: r! };
}

export function dirsEqual(a: Dir, b: Dir) {
  return a.dx === b.dx && a.dy === b.dy;
}

export function negateDir(d: Dir): Dir {
  return { dx: -d.dx, dy: -d.dy };
}

export function addCell(a: CellCoord, d: Dir): CellCoord {
  return { c: a.c + d.dx, r: a.r + d.dy };
}

export type BumperCell = {
  /** 現在プレイヤーが設定した種類 */
  display: BumperKind;
  /** 生成時の正解 */
  solution: BumperKind;
};

export type GridStage = {
  width: number;
  height: number;
  /** pathable[c][r]（盤面矩形内。r=0 が最上段） */
  pathable: boolean[][];
  /** 最下段の入口マス（pathable）。下辺が射出ゾーンへ開く */
  start: CellCoord;
  /** 最上段の到達マス（pathable）。上辺がゴールゾーンへ開く */
  goal: CellCoord;
  /** 射出体の待機マス（最下段の1マス下。start の真下） */
  launch: CellCoord;
  /** ゴールエリア（最上段の1マス上。goal の真上） */
  goalPad: CellCoord;
  bumpers: Map<string, BumperCell>;
  /** デバッグ用：正解経路のセル列（端点含む） */
  solutionPath: CellCoord[];
  grade: number;
  seed: number;
};

/** エージェントが存在しうるマス（pathable ∪ 射出 ∪ ゴールエリア） */
export function isAgentCell(st: GridStage, c: number, r: number) {
  if (c === st.launch.c && r === st.launch.r) return true;
  if (c === st.goalPad.c && r === st.goalPad.r) return true;
  if (c < 0 || r < 0 || c >= st.width || r >= st.height) return false;
  return st.pathable[c]![r]!;
}

export function stageRowRange(st: GridStage) {
  return { rMin: st.goalPad.r, rMax: st.launch.r };
}
