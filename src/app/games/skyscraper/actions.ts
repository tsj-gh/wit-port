"use server";

import { cookies } from "next/headers";
import {
  generateUniquePuzzle,
  type Clues,
  validateAgainstSolution,
  validateProgress,
} from "@/lib/puzzle-engine/skyscrapers";

const PUZZLE_COOKIE = "skyscraper_puzzle";
const COOKIE_MAX_AGE = 60 * 60; // 1 hour

function encodePuzzle(solution: number[][], n: number): string {
  return Buffer.from(JSON.stringify({ solution, n }), "utf-8").toString("base64");
}

function decodePuzzle(
  payload: string
): { solution: number[][]; n: number } | null {
  try {
    const json = Buffer.from(payload, "base64").toString("utf-8");
    return JSON.parse(json) as { solution: number[][]; n: number };
  } catch {
    return null;
  }
}

export type GenerateResult = {
  clues: Clues;
  n: number;
  seed?: string;
  error?: string;
};

export async function generatePuzzleAction(
  n: number,
  difficulty: "easy" | "normal" | "hard",
  seed?: string
): Promise<GenerateResult> {
  try {
    const result = generateUniquePuzzle(n, difficulty, 40, seed);
    const { solution, clues } = result;
    const cookieStore = await cookies();
    cookieStore.set(PUZZLE_COOKIE, encodePuzzle(solution, n), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
    return { clues, n, seed: result.seed };
  } catch (err) {
    return {
      clues: { top: [], bottom: [], left: [], right: [] },
      n,
      error: err instanceof Error ? err.message : "パズルの生成に失敗しました。",
    };
  }
}

export type ValidateResult = {
  ok: boolean;
  msg: string;
};

export async function checkProgressAction(
  grid: number[][],
  clues: Clues,
  n: number
): Promise<ValidateResult> {
  return validateProgress(grid, clues, n);
}

export async function validateAnswerAction(
  grid: number[][],
  n: number
): Promise<ValidateResult> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PUZZLE_COOKIE)?.value;
  if (!raw) {
    return { ok: false, msg: "パズルの有効期限が切れています。新規生成してください。" };
  }
  const decoded = decodePuzzle(raw);
  if (!decoded || decoded.n !== n) {
    return { ok: false, msg: "パズルが一致しません。新規生成してください。" };
  }
  return validateAgainstSolution(grid, decoded.solution);
}

export type HintResult = {
  r: number;
  c: number;
  val: number;
  error?: string;
};

export async function hintAction(grid: number[][], n: number): Promise<HintResult | { error: string }> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PUZZLE_COOKIE)?.value;
  if (!raw) {
    return { error: "パズルの有効期限が切れています。" };
  }
  const decoded = decodePuzzle(raw);
  if (!decoded || decoded.n !== n) {
    return { error: "パズルが一致しません。" };
  }
  const empties: [number, number][] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!grid[r]?.[c] || grid[r][c] === 0) empties.push([r, c]);
    }
  }
  if (empties.length === 0) {
    return { error: "すべて埋まっています。" };
  }
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const val = decoded.solution[r][c];
  return { r, c, val };
}

export type SolveResult = {
  solution: number[][];
  error?: string;
};

export async function solveAction(n: number): Promise<SolveResult> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PUZZLE_COOKIE)?.value;
  if (!raw) {
    return { solution: [], error: "パズルの有効期限が切れています。" };
  }
  const decoded = decodePuzzle(raw);
  if (!decoded || decoded.n !== n) {
    return { solution: [], error: "パズルが一致しません。" };
  }
  return { solution: decoded.solution };
}
