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
