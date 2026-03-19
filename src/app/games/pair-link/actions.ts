"use server";

import {
  generatePairLinkPuzzle,
  validatePaths,
  type Pair,
  type GenerationProfile,
} from "@/lib/puzzle-engine/pair-link";

export type GenerateResult = {
  numbers: { x: number; y: number; val: number; color: string }[];
  pairs: Pair[];
  gridSize: number;
  pairCount: number;
  error?: string;
  profile?: GenerationProfile;
  /** 完成までに要した試行回数（再試行ループ） */
  attempts?: number;
  /** 生成開始から終了までの全体所要時間（ms） */
  totalMs?: number;
  /** 盤面生成に使用したシード値（再現用） */
  seed?: string;
};

/** プリフェッチ等で複数リクエストが同時に来ても問題なし（純粋関数・共有状態なし） */
export async function generatePuzzleAction(
  gridSize: number,
  seed?: string
): Promise<GenerateResult> {
  const result = generatePairLinkPuzzle(gridSize, seed);
  if (!result) {
    return {
      numbers: [],
      pairs: [],
      gridSize,
      pairCount: 0,
      error: "生成に失敗しました。もう一度お試しください。",
    };
  }
  return {
    numbers: result.numbers,
    pairs: result.pairs,
    gridSize: result.gridSize,
    pairCount: result.pairCount,
    profile: result.profile,
    attempts: result.attempts,
    totalMs: result.totalMs,
    seed: result.seed,
  };
}

export type ValidateResult = { ok: boolean; msg: string };

export async function validatePathsAction(
  paths: Record<string, { x: number; y: number }[][]>,
  pairs: Pair[],
  gridSize: number
): Promise<ValidateResult> {
  return validatePaths(paths, pairs, gridSize);
}
