/**
 * Reflec-Shot の座標系（仕様・論理）
 *
 * - **論理原点**: スタート位置（入口マス `start`、または説明上の基準点）を (0, 0) とする。
 * - **+X**: 画面の右方向。
 * - **+Y**: 画面の上方向（ゴール側）。
 *
 * 例: 論理で「ΔX = -3, ΔY = +4」は、画面上で**左へ 3 マス・上へ 4 マス**の変位（対角成分の足し合わせとして読む場合は同じ向きの移動量）。
 *
 * **実装との対応**（`CellCoord` の `c` = 左からの列、`r` = 上からの行。`r` が増えるほど画面下）:
 * - 1 マス進むときの `Dir` は `{ dx, dy }` で `c += dx`, `r += dy`。
 * - 論理変位 (ΔX, ΔY) と `Dir` の関係: **`dx = ΔX`**, **`dy = -ΔY`**（＋Y〈ゴール側・画面上〉への移動は `dy` が負 → **`DIR.D`**）。
 * - **`DIR.U`** = `{ dx:0, dy:1 }`（`r` 増＝画面下、論理 ΔY の負方向）。**`DIR.D`** = `{ dx:0, dy:-1 }`（`r` 減＝画面上、論理 ＋Y）。
 *
 * 論理位置 (X, Y) を入口を原点にして絶対 `CellCoord` と対応させるなら:
 * `c = start.c + X`, `r = start.r - Y`（入口の一段下の射出マスは Y = -1 など）。
 */
/** グリッド上の移動方向（列 c への増分 dx、行 r への増分 dy。dy が負なら r が減り画面上向き・ゴール寄り） */
export type Dir = { dx: number; dy: number };

export const DIR = {
  U: { dx: 0, dy: 1 },
  D: { dx: 0, dy: -1 },
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
