/**
 * シード値指定可能な擬似乱数生成ユーティリティ
 * 盤面生成の再現性確保に使用
 */

import seedrandom from "seedrandom";

/**
 * シード値から擬似乱数生成関数を生成する。
 * シード未指定時は Math.random を返す（従来のランダム動作）。
 */
export function createSeededRandom(seed?: string | number): () => number {
  if (seed != null && String(seed).trim() !== "") {
    return seedrandom(String(seed));
  }
  return Math.random;
}

/**
 * ランダムなシード値を生成（時刻ベース）
 */
export function generateRandomSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * スコープ付き PRNG（生成ロジック専用）
 * Math.random を一切使用せず、完全に分離された決定論的乱数列を提供。
 * 外部ロジックによる乱数消費の影響を完全に排除する。
 */
export class ScopedPRNG {
  private _next: () => number;
  private _callCount = 0;

  constructor(seed: string) {
    if (!seed || String(seed).trim() === "") {
      throw new Error("ScopedPRNG requires a non-empty seed");
    }
    this._next = seedrandom(String(seed));
  }

  /** 次の乱数 [0, 1) を返し、呼び出し回数をインクリメント */
  next(): number {
    this._callCount++;
    return this._next();
  }

  /** 生成プロセス全体で next() が呼ばれた回数（Random Sequence ID） */
  getCallCount(): number {
    return this._callCount;
  }
}
