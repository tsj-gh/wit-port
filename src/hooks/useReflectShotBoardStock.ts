"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from "react";
import type { GridStage } from "@/app/lab/reflec-shot/gridTypes";
import {
  cloneGridStageForRestore,
  defaultDummyDensityPctForGrade,
} from "@/app/lab/reflec-shot/gridTypes";
import type { ReflectShotGenerateResult } from "@/hooks/useReflectShotWorker";

/** グレードごとの目標プリフェッチ枚数 */
export const MAX_STOCK_SIZE = 5;

export const REFLECT_SHOT_STOCK_GRADES = [1, 2, 3, 4, 5] as const;

function randomSeed(): number {
  return (Date.now() ^ (Math.random() * 0x7fffffff) ^ (Math.random() * 0x46546546)) >>> 0;
}

type StockRef = Record<number, GridStage[]>;

function emptyStock(): StockRef {
  return { 1: [], 2: [], 3: [], 4: [], 5: [] };
}

/**
 * Reflec-Shot 用: Web Worker 経由でグレード別に盤面ストックを補充し、FIFO で取り出す。
 */
export function useReflectShotBoardStock(
  generate: (
    grade: number,
    seed: number,
    opts?: {
      source?: "user" | "prefetch";
      grade2Bend6TotalBends?: 6 | 7 | 8;
      lv4GenMode?: "default" | "rFirst" | "rSecond";
      dummyDensityPct?: number;
    }
  ) => Promise<ReflectShotGenerateResult>,
  enabled: boolean = true
) {
  const stockRef = useRef<StockRef>(emptyStock());
  const inFlightByGradeRef = useRef<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const enabledRef = useRef(enabled);
  useLayoutEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  const [, bumpUi] = useReducer((x: number) => x + 1, 0);

  const getStockCounts = useCallback((): Record<number, number> => {
    const s = stockRef.current;
    return {
      1: s[1]!.length,
      2: s[2]!.length,
      3: s[3]!.length,
      4: s[4]!.length,
      5: s[5]!.length,
    };
  }, []);

  const scheduleReplenish = useCallback(() => {
    if (!enabledRef.current) return;

    for (const g of REFLECT_SHOT_STOCK_GRADES) {
      const q = stockRef.current[g]!;
      const inflight = inFlightByGradeRef.current[g] ?? 0;
      const need = MAX_STOCK_SIZE - q.length - inflight;
      for (let i = 0; i < need; i++) {
        inFlightByGradeRef.current[g] = (inFlightByGradeRef.current[g] ?? 0) + 1;
        const seed = randomSeed() ^ (i * 0x9e3779b9);
        void generate(g, seed >>> 0, {
          source: "prefetch",
          dummyDensityPct: defaultDummyDensityPctForGrade(g),
          ...(g === 5 ? ({ lv4GenMode: "rSecond" as const } as const) : {}),
        })
          .then(({ stage }) => {
            inFlightByGradeRef.current[g] = Math.max(0, (inFlightByGradeRef.current[g] ?? 0) - 1);
            stockRef.current[g]!.push(stage);
            bumpUi();
            scheduleReplenish();
          })
          .catch(() => {
            inFlightByGradeRef.current[g] = Math.max(0, (inFlightByGradeRef.current[g] ?? 0) - 1);
            bumpUi();
            scheduleReplenish();
          });
      }
    }
  }, [generate, bumpUi]);

  /**
   * 親コンポーネントで、このフックより後に登録された useEffect（初期盤面の user 生成など）が
   * 先に postMessage されるよう、補充ループは同ティックの末尾（マイクロタスク）へ逃がす。
   * さもないと単一 Worker のキュー先頭にプリフェッチが数十件溜まり、初回表示が事実上ブロックされる。
   */
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) scheduleReplenish();
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, scheduleReplenish]);

  /**
   * ストック先頭を取り出し（プレイ用コピー）。空なら `null`。
   */
  const takeBoardForGrade = useCallback(
    (grade: number): GridStage | null => {
      const q = stockRef.current[grade];
      if (!q || q.length === 0) return null;
      const raw = q.shift()!;
      bumpUi();
      scheduleReplenish();
      return cloneGridStageForRestore(raw);
    },
    [bumpUi, scheduleReplenish]
  );

  return {
    stockCounts: getStockCounts(),
    takeBoardForGrade,
    scheduleReplenish,
  };
}
