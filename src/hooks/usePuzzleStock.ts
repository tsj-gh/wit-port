"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBoardWorker, type GenerateResult, type WorkerConfig } from "@/hooks/useBoardWorker";

const STOCK_MAX = 3;
const STOCK_REFILL_THRESHOLD = 2;
const MAX_KEYS = 5;

function makeKey(gridSize: number, numPairs: number): string {
  return `${gridSize}x${numPairs}`;
}

/** モジュールレベルのストック（LRU、最大5キー） */
const stockMap = new Map<string, GenerateResult[]>();
const keyAccessOrder: string[] = [];

function evictIfNeeded(newKey: string): void {
  if (stockMap.has(newKey)) return;
  while (keyAccessOrder.length >= MAX_KEYS) {
    const oldest = keyAccessOrder.shift();
    if (oldest) stockMap.delete(oldest);
  }
}

function touchKey(key: string): void {
  const idx = keyAccessOrder.indexOf(key);
  if (idx >= 0) keyAccessOrder.splice(idx, 1);
  keyAccessOrder.push(key);
}

function getFromStock(key: string): GenerateResult | null {
  const arr = stockMap.get(key);
  if (!arr || arr.length === 0) return null;
  const head = arr[0];
  stockMap.set(key, arr.slice(1));
  touchKey(key);
  return head;
}

function addToStock(key: string, puzzle: GenerateResult): void {
  evictIfNeeded(key);
  const arr = stockMap.get(key) ?? [];
  arr.push(puzzle);
  stockMap.set(key, arr);
  touchKey(key);
}

export function getStockStatus(): Record<string, number> {
  const out: Record<string, number> = {};
  stockMap.forEach((arr, k) => {
    out[k] = arr.length;
  });
  return out;
}

export type UsePuzzleStockOptions = {
  /** 永続化は行わず、メモリ内 Map のみ使用 */
  persist?: boolean;
  /** 評価関数・フィルタ用パラメータ（デバッグ用） */
  config?: WorkerConfig;
};

export function usePuzzleStock(
  _options: UsePuzzleStockOptions = {}
): {
  getPuzzle: (gridSize: number, numPairs: number, seed?: string) => Promise<GenerateResult>;
  prefetch: (gridSize: number, numPairs: number) => void;
  manualPrefetch: (gridSize: number, numPairs: number) => void;
  isPrefetching: boolean;
  lastGenerationTimeMs: number | null;
  lastProfile: Record<string, number> | null;
  lastAttempts: number | null;
  lastTotalMs: number | null;
  stockStatus: Record<string, number>;
} {
  const { generate: workerGenerate } = useBoardWorker();
  const { config } = _options;
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [lastGenerationTimeMs, setLastGenerationTimeMs] = useState<number | null>(null);
  const [lastProfile, setLastProfile] = useState<Record<string, number> | null>(null);
  const [lastAttempts, setLastAttempts] = useState<number | null>(null);
  const [lastTotalMs, setLastTotalMs] = useState<number | null>(null);
  const [stockStatus, setStockStatus] = useState<Record<string, number>>(() => getStockStatus());
  const isFetchingRef = useRef(false);

  const flushStatus = useCallback(() => {
    setStockStatus(getStockStatus());
  }, []);

  const fetchOne = useCallback(
    async (gs: number, np: number, seed?: string): Promise<GenerateResult | null> => {
      try {
        const result = await workerGenerate(gs, seed, np, config);
        return result;
      } catch {
        return null;
      }
    },
    [workerGenerate, config]
  );

  const refill = useCallback(
    async (gs: number, np: number) => {
      if (isFetchingRef.current) return;
      const key = makeKey(gs, np);
      const arr = stockMap.get(key) ?? [];
      if (arr.length >= STOCK_MAX) return;

      isFetchingRef.current = true;
      setIsPrefetching(true);
      const t0 = performance.now();
      try {
        const puzzle = await fetchOne(gs, np);
        const elapsed = Math.round(performance.now() - t0);
        setLastGenerationTimeMs(elapsed);
        if (puzzle && !puzzle.error) {
          if (puzzle.profile) {
            setLastProfile(puzzle.profile);
            if (puzzle.attempts != null) setLastAttempts(puzzle.attempts);
            if (puzzle.totalMs != null) setLastTotalMs(puzzle.totalMs);
            if (typeof window !== "undefined" && window.location.search.includes("devtj=true")) {
              const total = Object.values(puzzle.profile).reduce((a, b) => a + b, 0);
              console.group("Board Generation Profile");
              if (puzzle.attempts != null) console.log(`Attempts: ${puzzle.attempts} 回`);
              if (puzzle.totalMs != null) console.log(`全体: ${puzzle.totalMs}ms`);
              Object.entries(puzzle.profile).forEach(([k, v]) => console.log(`${k}: ${v}ms (累計)`));
              console.log(`内訳合計: ${total}ms / 往復含む: ${elapsed}ms`);
              console.groupEnd();
            }
          }
          addToStock(key, puzzle);
          flushStatus();
        }
      } finally {
        isFetchingRef.current = false;
        setIsPrefetching(false);
      }
    },
    [fetchOne, flushStatus]
  );

  const prefetch = useCallback(
    (gs: number, np: number) => {
      refill(gs, np);
    },
    [refill]
  );

  const manualPrefetch = useCallback(
    async (gs: number, np: number) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setIsPrefetching(true);
      const t0 = performance.now();
      try {
        const puzzle = await fetchOne(gs, np);
        const elapsed = Math.round(performance.now() - t0);
        setLastGenerationTimeMs(elapsed);
        if (puzzle?.profile) {
          setLastProfile(puzzle.profile);
          if (puzzle.attempts != null) setLastAttempts(puzzle.attempts);
          if (puzzle.totalMs != null) setLastTotalMs(puzzle.totalMs);
          if (typeof window !== "undefined" && window.location.search.includes("devtj=true")) {
            const total = Object.values(puzzle.profile).reduce((a, b) => a + b, 0);
            console.group("Board Generation Profile");
            if (puzzle.attempts != null) console.log(`Attempts: ${puzzle.attempts} 回`);
            if (puzzle.totalMs != null) console.log(`全体: ${puzzle.totalMs}ms`);
            Object.entries(puzzle.profile).forEach(([k, v]) => console.log(`${k}: ${v}ms (累計)`));
            console.log(`内訳合計: ${total}ms / 往復含む: ${elapsed}ms`);
            console.groupEnd();
          }
        }
        if (puzzle && !puzzle.error) {
          addToStock(makeKey(gs, np), puzzle);
          flushStatus();
        }
      } finally {
        isFetchingRef.current = false;
        setIsPrefetching(false);
      }
    },
    [fetchOne, flushStatus]
  );

  const getPuzzle = useCallback(
    async (gs: number, np: number, seed?: string): Promise<GenerateResult> => {
      const minNp = Math.max(2, gs - 2);
      const maxNp = gs >= 7 ? 10 : gs;
      const clampedNp = Math.max(minNp, Math.min(maxNp, np));
      const key = makeKey(gs, clampedNp);

      if (seed != null && seed.trim() !== "") {
        const puzzle = await fetchOne(gs, clampedNp, seed);
        if (puzzle) return puzzle;
        throw new Error("指定されたハッシュでの生成に失敗しました。");
      }

      const head = getFromStock(key);
      if (head) {
        flushStatus();
        refill(gs, clampedNp);
        return head;
      }

      const puzzle = await fetchOne(gs, clampedNp);
      if (puzzle) return puzzle;
      const retry = await fetchOne(gs, clampedNp);
      if (retry) return retry;
      throw new Error("パズルの生成に失敗しました。もう一度お試しください。");
    },
    [fetchOne, refill, flushStatus]
  );

  useEffect(() => {
    flushStatus();
  }, [flushStatus]);

  return {
    getPuzzle,
    prefetch,
    manualPrefetch,
    isPrefetching,
    lastGenerationTimeMs,
    lastProfile,
    lastAttempts,
    lastTotalMs,
    stockStatus,
  };
}
