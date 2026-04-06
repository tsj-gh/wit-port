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

/** 正解頂点列のみの内角 90° 折れ数（両端頂点を除く）。G6 の目標宝石数の第1項に使用 */
export function countRightAnglesInSolutionPath(path: CellCoord[]): number {
  let n = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const d0 = unitOrthoDirBetween(path[i - 1]!, path[i]!);
    const d1 = unitOrthoDirBetween(path[i]!, path[i + 1]!);
    if (!d0 || !d1) continue;
    if (d0.dx * d1.dx + d0.dy * d1.dy === 0) n++;
  }
  return n;
}

export type BumperCell = {
  /** 現在プレイヤーが設定した種類 */
  display: BumperKind;
  /** 生成時の正解 */
  solution: BumperKind;
  /** 正解経路の反射点ではないダミー（デバッグ「正解経路」表示でのみ区別） */
  isDummy?: boolean;
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
  /** `goal->upside down` 後に start を経路の最深行に合わせて延長した（デバッグ Source 用） */
  reflecSourceStartExtended?: boolean;
  /** 宝石ルール: 正解経路の反射点（ダミー除外）の数 */
  gemRuleBaseBends?: number;
  /** 想定正解ポリライン上の十字路（直交内部交差）の数 */
  gemExpectedCrossings?: number;
  /** 想定再訪折れ点（両面ヒット）の数（Grade 5+） */
  gemExpectedTwoSidedBends?: number;
  /** Goal 開錠に必要な宝石総数（未設定時は従来どおり `countBumpersOnSolutionPath`） */
  requiredGemCount?: number;
};

/** エージェントが存在しうるマス（pathable ∪ startPad ∪ ゴールエリア） */
export function isAgentCell(st: GridStage, c: number, r: number) {
  if (c === st.startPad.c && r === st.startPad.r) return true;
  if (c === st.goalPad.c && r === st.goalPad.r) return true;
  if (c < 0 || r < 0 || c >= st.width || r >= st.height) return false;
  return st.pathable[c]![r]!;
}

/**
 * キャンバスで描く行の範囲 `[rMin, rMax]`（グリッド行 `r`）。
 * **盤面の最上段・最下段（`0` と `height-1`）は常に含める**（経路が通らない行もマスとして描く）。
 * さらに盤外の `startPad` / `goalPad`、端点、`solutionPath` の行を含め、パッド行まで連続したレイアウトにする。
 */
export function stageRowRange(st: GridStage) {
  const h = st.height;
  const rows: number[] = [0, h - 1, st.goalPad.r, st.startPad.r, st.start.r, st.goal.r];
  for (const p of st.solutionPath) {
    rows.push(p.r);
  }
  return { rMin: Math.min(...rows), rMax: Math.max(...rows) };
}

/**
 * 盤 `[0,width)` の列に加え、盤外パッド列と正解経路の列を含むキャンバス用の列範囲。
 * 基準は常に盤面全幅（`0..width-1`）から始め、パッド／経路でだけ左右に拡張する（列＝パッド位置だけ、にはしない）。
 */
export function stageColDrawRange(st: GridStage): { cMin: number; cMax: number } {
  let cMin = 0;
  let cMax = st.width - 1;
  const bump = (c: number) => {
    cMin = Math.min(cMin, c);
    cMax = Math.max(cMax, c);
  };
  bump(st.startPad.c);
  bump(st.goalPad.c);
  for (const p of st.solutionPath) bump(p.c);
  return { cMin, cMax };
}

/**
 * 盤の真上／真下の「パッド専用行」か。左右端の goalPad（盤と同じ行 `r`）では false を返し、盤内マスを背景で潰さない。
 */
export function isExclusiveOutsidePadCorridorRow(st: GridStage, r: number): boolean {
  const startStrip =
    r === st.startPad.r && (st.startPad.r < 0 || st.startPad.r >= st.height);
  const goalStrip =
    r === st.goalPad.r && (st.goalPad.r < 0 || st.goalPad.r >= st.height);
  return startStrip || goalStrip;
}

/** 正解ポリライン上の 90° 折れセル（反射点）のキー集合 */
export function bendCellKeysInSolutionPath(path: CellCoord[]): Set<string> {
  const s = new Set<string>();
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const c = path[i + 1]!;
    const d0 = unitOrthoDirBetween(a, b);
    const d1 = unitOrthoDirBetween(b, c);
    if (d0 && d1 && d0.dx * d1.dx + d0.dy * d1.dy === 0) {
      s.add(keyCell(b.c, b.r));
    }
  }
  return s;
}

/**
 * 宝石付与・必要数カウントの対象となるバンパーマス（折れ点に加え、非ダミーの start／goal 上バンパー）。
 */
export function gemAwardBumperCellKeys(st: GridStage): Set<string> {
  const s = new Set(bendCellKeysInSolutionPath(st.solutionPath));
  const sk = keyCell(st.start.c, st.start.r);
  const gk = keyCell(st.goal.c, st.goal.r);
  for (const k of [sk, gk]) {
    const b = st.bumpers.get(k);
    if (b && !b.isDummy) s.add(k);
  }
  return s;
}

/**
 * 生成時: 正解経路の反射バンパーが初期表示で不正解向きになる確率（グレード連動・UI 表示用）。
 * Grade 1 ≈ 5% … Grade 5 ≈ 95%
 */
export function initialWrongDisplayProbabilityForGrade(grade: number): number {
  const g = Math.max(1, Math.min(7, Math.floor(grade)));
  if (g <= 5) return 0.05 + ((g - 1) / 4) * 0.9;
  return 0.95;
}

/** ダミーバンパー密度（0〜100）のグレード別既定。生成・ストック・デバッグスライダ初期値に使用 */
export function defaultDummyDensityPctForGrade(grade: number): number {
  const g = Math.max(1, Math.min(7, Math.floor(grade)));
  const table: Record<number, number> = { 1: 0, 2: 10, 3: 15, 4: 20, 5: 25, 6: 28, 7: 30 };
  return table[g] ?? 0;
}

/** 復元・ストック取り出し用のディープコピー（`setStage` 後にプレイヤー操作で汚染されないよう） */
/** 正解経路の反射対象バンパー数（折れ点＋start／goal の非ダミー）。最低 1 を返す。 */
export function countBumpersOnSolutionPath(st: GridStage): number {
  const keys = gemAwardBumperCellKeys(st);
  let n = 0;
  keys.forEach((k) => {
    const b = st.bumpers.get(k);
    if (b && !b.isDummy) n++;
  });
  return Math.max(1, n);
}

export function cloneGridStageForRestore(st: GridStage): GridStage {
  return {
    ...st,
    pathable: st.pathable.map((col) => [...col!]),
    bumpers: new Map(
      Array.from(st.bumpers.entries()).map(([k, v]) => [
        k,
        {
          display: v.display,
          solution: v.solution,
          ...(v.isDummy ? { isDummy: true as const } : {}),
        },
      ])
    ),
    solutionPath: st.solutionPath.map((p) => ({ ...p })),
  };
}
