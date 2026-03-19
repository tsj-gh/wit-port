"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generatePuzzleAction } from "@/app/games/pair-link/actions";
import type { GenerateResult } from "@/app/games/pair-link/actions";

const STOCK_MAX = 3;
const STOCK_REFILL_THRESHOLD = 2;
const STORAGE_KEY_PREFIX = "pair-link-stock";

function getStorageKey(gridSize: number): string {
  return `${STORAGE_KEY_PREFIX}-${gridSize}`;
}

function loadFromStorage(gridSize: number): GenerateResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(getStorageKey(gridSize));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GenerateResult[];
    return Array.isArray(parsed) ? parsed.filter((p) => !p.error) : [];
  } catch {
    return [];
  }
}

function saveToStorage(gridSize: number, stock: GenerateResult[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(getStorageKey(gridSize), JSON.stringify(stock));
  } catch {
    /* ignore */
  }
}

export type UsePuzzleStockOptions = {
  /** パズルサイズ（4, 6, 8, 10） */
  gridSize?: number;
  /** sessionStorage で永続化するか */
  persist?: boolean;
};

export function usePuzzleStock(
  options: UsePuzzleStockOptions = {}
): {
  getPuzzle: (requestedSize?: number) => Promise<GenerateResult>;
  stockCount: number;
  prefetch: () => void;
  manualPrefetch: () => void;
  isPrefetching: boolean;
  lastGenerationTimeMs: number | null;
} {
  const { gridSize = 6, persist = true } = options;
  const [stockCount, setStockCount] = useState(0);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [lastGenerationTimeMs, setLastGenerationTimeMs] = useState<number | null>(null);
  const stockRef = useRef<GenerateResult[]>([]);
  const isFetchingRef = useRef(false);

  const flushCount = useCallback(() => {
    setStockCount(stockRef.current.length);
  }, []);

  const fetchOne = useCallback(
    async (size?: number): Promise<GenerateResult | null> => {
      const sz = size ?? gridSize;
      const result = await generatePuzzleAction(sz);
      if (result.error) return null;
      return result;
    },
    [gridSize]
  );

  const refill = useCallback(async () => {
    if (isFetchingRef.current) return;
    if (stockRef.current.length >= STOCK_MAX) return;
    isFetchingRef.current = true;
    setIsPrefetching(true);
    const t0 = performance.now();
    try {
      const puzzle = await fetchOne();
      const t1 = performance.now();
      setLastGenerationTimeMs(Math.round(t1 - t0));
      if (typeof window !== "undefined" && window.location.search.includes("devtj=true")) {
        console.log(`[Prefetch] 盤面生成 ${Math.round(t1 - t0)}ms`);
      }
      if (puzzle) {
        stockRef.current = [...stockRef.current, puzzle];
        if (persist) saveToStorage(gridSize, stockRef.current);
        flushCount();
      }
    } finally {
      isFetchingRef.current = false;
      setIsPrefetching(false);
    }
  }, [fetchOne, gridSize, persist, flushCount]);

  const manualPrefetch = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsPrefetching(true);
    const t0 = performance.now();
    try {
      const puzzle = await fetchOne();
      const t1 = performance.now();
      const elapsed = Math.round(t1 - t0);
      setLastGenerationTimeMs(elapsed);
      if (typeof window !== "undefined" && window.location.search.includes("devtj=true")) {
        console.log(`[Prefetch] 手動実行 ${elapsed}ms`);
      }
      if (puzzle && stockRef.current.length < STOCK_MAX) {
        stockRef.current = [...stockRef.current, puzzle];
        if (persist) saveToStorage(gridSize, stockRef.current);
        flushCount();
      }
    } finally {
      isFetchingRef.current = false;
      setIsPrefetching(false);
    }
  }, [fetchOne, gridSize, persist, flushCount]);

  const getPuzzle = useCallback(
    async (requestedSize?: number): Promise<GenerateResult> => {
      const size = requestedSize ?? gridSize;
      if (size === gridSize) {
        const head = stockRef.current[0];
        if (head) {
          stockRef.current = stockRef.current.slice(1);
          if (persist) saveToStorage(gridSize, stockRef.current);
          flushCount();
          refill();
          return head;
        }
      }
      const puzzle = await fetchOne(size);
      if (puzzle) return puzzle;
      const retry = await fetchOne(size);
      if (retry) return retry;
      throw new Error("パズルの生成に失敗しました。もう一度お試しください。");
    },
    [gridSize, persist, refill, flushCount, fetchOne]
  );

  const prefetch = useCallback(() => {
    refill();
  }, [refill]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const loaded = loadFromStorage(gridSize);
    if (persist && loaded.length > 0) {
      stockRef.current = loaded;
      flushCount();
    }
    refill();
  }, [gridSize, persist, refill, flushCount]);

  useEffect(() => {
    if (
      stockRef.current.length <= STOCK_REFILL_THRESHOLD &&
      !isFetchingRef.current
    ) {
      refill();
    }
  }, [stockCount, refill]);

  return {
    getPuzzle: getPuzzle as (requestedSize?: number) => Promise<GenerateResult>,
    stockCount,
    prefetch,
    manualPrefetch,
    isPrefetching,
    lastGenerationTimeMs,
  };
}
