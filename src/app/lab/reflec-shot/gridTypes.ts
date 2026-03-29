/**
 * Reflec-Shot の座標系
 *
 * - **画面**: 上下左右は画面上のそのまま。**x は右が正、y は上が正**（数学座標系と同じ）。
 * - **グリッド**: `CellCoord` の **`c`** は左からの列（= 画面 x と増加方向が一致）、**`r`** は上からの行番号（**下にいくほど `r` が増える**）。
 *
 * **`Dir`（移動・進行ベクトル）** は常に **画面 xy** に対応する:
 * - **`DIR.R`**: `dx = +1`（右）／**`DIR.L`**: `dx = -1`（左）
 * - **`DIR.U`**: `dy = +1`（**上**）／**`DIR.D`**: `dy = -1`（**下**）
 *
 * グリッド上の次マスは **`addCell`** で計算: `c' = c + dx`, **`r' = r - dy`**（`r` が下向き正なので、画面上へ動く `dy>0` は `r` が減る）。
 *
 * 隣接マス間の **グリッド差分** `(Δc, Δr)` を `Dir` に直すときは **`gridDeltaToScreenDir({ dx:Δc, dy:Δr })`**（内部は `(Δc, -Δr)`）。
 */
/** 画面上の移動方向（x=右+、y=上+）。グリッド進行には `addCell` を使う */
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
  return { c: a.c + d.dx, r: a.r - d.dy };
}

/** `dirBetween` 等のグリッド差分 `(dx=Δc, dy=Δr)` を画面 `Dir` へ */
export function gridDeltaToScreenDir(grid: Dir): Dir {
  return { dx: grid.dx, dy: -grid.dy };
}

/** 直交隣接のときのみ、隣接 a→b の進行方向を**画面**`Dir`で返す */
export function unitOrthoDirBetween(a: CellCoord, b: CellCoord): Dir | null {
  const dc = Math.sign(b.c - a.c);
  const dr = Math.sign(b.r - a.r);
  if (dc !== 0 && dr !== 0) return null;
  if (dc === 0 && dr === 0) return null;
  return gridDeltaToScreenDir({ dx: dc, dy: dr });
}

export type BumperCell = {
  /** 現在プレイヤーが設定した種類 */
  display: BumperKind;
  /** 生成時の正解 */
  solution: BumperKind;
};

/** Grade 2: 同一パッド向きだが端が最下／最上に居ないときの経路上下反転の区分（デバッグ表示用） */
export type Grade2PadAdjustLabel = "goal->upside down" | "start->upside down";

export type GridStage = {
  width: number;
  height: number;
  /** pathable[c][r]（盤面矩形内。r=0 が最上段） */
  pathable: boolean[][];
  /** 最下段の入口マス（pathable）。下辺が射出ゾーンへ開く */
  start: CellCoord;
  /** 最上段の到達マス（pathable）。上辺がゴールゾーンへ開く */
  goal: CellCoord;
  /** 射出体の初期位置（Grade1・2 いずれも主に start の真下。盤外も可） */
  startPad: CellCoord;
  /** クリア判定マス（G1: goal 真上／G2 折れ4・G3: 最終進行延長上の盤外／G2 折れ6: 常に goal の真上） */
  goalPad: CellCoord;
  bumpers: Map<string, BumperCell>;
  /** デバッグ用：正解経路のセル列（端点含む） */
  solutionPath: CellCoord[];
  grade: number;
  seed: number;
  /** Grade 2 生成時のみ: パッド整合のため経路を上下反転したときのラベル */
  grade2PadAdjustLabel?: Grade2PadAdjustLabel;
  /** [Pad延伸チェック] で start / goal / 両方を Y（グリッド r）方向に延長した場合 */
  padExtentKind?: "start" | "goal" | "both";
};

/** エージェントが存在しうるマス（pathable ∪ startPad ∪ ゴールエリア） */
export function isAgentCell(st: GridStage, c: number, r: number) {
  if (c === st.startPad.c && r === st.startPad.r) return true;
  if (c === st.goalPad.c && r === st.goalPad.r) return true;
  if (c < 0 || r < 0 || c >= st.width || r >= st.height) return false;
  return st.pathable[c]![r]!;
}

/**
 * キャンバスで描く行の範囲 `[rMin, rMax]`（グリッド行 `r`）。列は常に `0..width-1` を走査するが、
 * 行方向は **スタート／ゴール／両パッド** に加え、**正解経路 `solutionPath` が通るすべてのマス**の行を含める。
 * `start`・`goal` が一辺に寄っていても、経路が別の行を使う場合はそこが欠けず描画される。
 */
export function stageRowRange(st: GridStage) {
  const rows: number[] = [st.goalPad.r, st.startPad.r, st.start.r, st.goal.r];
  for (const p of st.solutionPath) {
    rows.push(p.r);
  }
  return { rMin: Math.min(...rows), rMax: Math.max(...rows) };
}

/** 復元・ストック取り出し用のディープコピー（`setStage` 後にプレイヤー操作で汚染されないよう） */
export function cloneGridStageForRestore(st: GridStage): GridStage {
  return {
    ...st,
    pathable: st.pathable.map((col) => [...col!]),
    bumpers: new Map(
      Array.from(st.bumpers.entries()).map(([k, v]) => [k, { display: v.display, solution: v.solution }])
    ),
    solutionPath: st.solutionPath.map((p) => ({ ...p })),
  };
}
