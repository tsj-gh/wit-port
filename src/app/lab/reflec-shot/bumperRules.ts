import type { BumperKind, Dir } from "./gridTypes";
import { DIR, dirsEqual } from "./gridTypes";

const key = (d: Dir) => `${d.dx},${d.dy}`;

/**
 * バンパー仕様（マス中心・4種）
 * 入射方向 = エージェントの進行ベクトル（どちらへ動いているか）
 */
/** `Dir` は画面座標（y 上向き正）。入射も出射も同じ基準 */
const SLASH_MAP: Record<string, Dir> = {
  [key(DIR.U)]: DIR.R,
  [key(DIR.D)]: DIR.L,
  [key(DIR.L)]: DIR.D,
  [key(DIR.R)]: DIR.U,
};

const BACKSLASH_MAP: Record<string, Dir> = {
  [key(DIR.U)]: DIR.L,
  [key(DIR.D)]: DIR.R,
  [key(DIR.L)]: DIR.U,
  [key(DIR.R)]: DIR.D,
};

const HYPHEN_MAP: Record<string, Dir> = {
  [key(DIR.D)]: DIR.U,
  [key(DIR.U)]: DIR.D,
  [key(DIR.L)]: DIR.L,
  [key(DIR.R)]: DIR.R,
};

const PIPE_MAP: Record<string, Dir> = {
  [key(DIR.D)]: DIR.D,
  [key(DIR.U)]: DIR.U,
  [key(DIR.L)]: DIR.R,
  [key(DIR.R)]: DIR.L,
};

export function applyBumper(inDir: Dir, kind: BumperKind): Dir {
  const k = key(inDir);
  switch (kind) {
    case "SLASH":
      return SLASH_MAP[k] ?? inDir;
    case "BACKSLASH":
      return BACKSLASH_MAP[k] ?? inDir;
    case "HYPHEN":
      return HYPHEN_MAP[k] ?? inDir;
    case "PIPE":
      return PIPE_MAP[k] ?? inDir;
    default:
      return inDir;
  }
}

/** 正解経路の入射・出射に一致するバンパー種を探索 */
export function bumperKindForTurn(dIn: Dir, dOut: Dir): BumperKind | null {
  for (const kind of ["SLASH", "BACKSLASH", "HYPHEN", "PIPE"] as BumperKind[]) {
    if (dirsEqual(applyBumper(dIn, kind), dOut)) return kind;
  }
  return null;
}

/** 折れ点用：／＼のみ（直交ターン）。該当なしなら null */
export function diagonalBumperForTurn(dIn: Dir, dOut: Dir): "SLASH" | "BACKSLASH" | null {
  for (const kind of ["SLASH", "BACKSLASH"] as const) {
    if (dirsEqual(applyBumper(dIn, kind), dOut)) return kind;
  }
  return null;
}

/**
 * スワイプ方位（`directionToSector` の 0..7、東から 45° 刻み）→ バンパー種。
 * [0]〜[3] と [4]〜[7] は Pipe→Slash→Hyphen→Backslash の同一パターン（将来 [0] と [4] の Pipe を別機能に分ける前提）。
 */
export const BUMPER_KIND_BY_SECTOR: readonly BumperKind[] = [
  "PIPE",
  "SLASH",
  "HYPHEN",
  "BACKSLASH",
  "PIPE",
  "SLASH",
  "HYPHEN",
  "BACKSLASH",
] as const;

export function directionToSector(dx: number, dy: number): number {
  if (dx * dx + dy * dy < 1e-8) return 2;
  const deg = ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360;
  return Math.floor((deg + 22.5) / 45) % 8;
}

/** 表示種から「代表セクタ」を得る（複数セクタが同じ種のときは先頭） */
export function sectorIndexForDisplayKind(kind: BumperKind): number {
  const i = BUMPER_KIND_BY_SECTOR.indexOf(kind);
  return i >= 0 ? i : 2;
}

/** スワイプ（キャンバス座標）→ 8 方向にスナップしたバンパー種 */
export function swipeToBumperKind(dx: number, dy: number): BumperKind {
  return BUMPER_KIND_BY_SECTOR[directionToSector(dx, dy)]!;
}
