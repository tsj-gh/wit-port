"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBoardWorker, type GenerateResult } from "@/hooks/useBoardWorker";
import {
  GRADE_MAP,
  LOW_SUCCESS_GRADES,
  MAX_RETRIES_PER_PUZZLE,
  PAIR_LINK_GRADE_CONSTANTS,
  STOCK_PER_GRADE_MAX,
  STOCK_REFILL_THRESHOLD,
  type GradeEnclosureRequirement,
  type PairLinkGradeDef,
} from "@/lib/pair-link-grade-constants";

function boardHash(pairs: GenerateResult["pairs"]): string {
  const sorted = [...pairs].sort((a, b) => a.id - b.id);
  const flat = sorted
    .map((p) => `${p.id}:${p.start[0]},${p.start[1]}-${p.end[0]},${p.end[1]}`)
    .join("|");
  let h = 0;
  for (let i = 0; i < flat.length; i++) {
    h = ((h << 5) - h + flat.charCodeAt(i)) | 0;
  }
  return String(h >>> 0);
}

function matchesEnclosure(enc: number | undefined, req: GradeEnclosureRequirement): boolean {
  const count = enc ?? 0;
  switch (req.type) {
    case "any":
      return true;
    case "eq":
      return count === req.value;
    case "gte":
      return count >= req.value;
    default:
      return true;
  }
}

/** グレード単位のストック（重複排除用に seed/hash も保持） */
const gradeStockMap = new Map<number, GenerateResult[]>();
const usedHashesPerGrade = new Map<number, Set<string>>();

function getFromGradeStock(grade: number): GenerateResult | null {
  const arr = gradeStockMap.get(grade);
  if (!arr || arr.length === 0) return null;
  const head = arr[0];
  gradeStockMap.set(grade, arr.slice(1));
  if (head.seed) {
    const used = usedHashesPerGrade.get(grade) ?? new Set();
    used.add(head.seed);
    usedHashesPerGrade.set(grade, used);
  }
  return head;
}

function addToGradeStock(grade: number, puzzle: GenerateResult): void {
  const arr = gradeStockMap.get(grade) ?? [];
  arr.push(puzzle);
  gradeStockMap.set(grade, arr);
}

function isDuplicateInGrade(grade: number, puzzle: GenerateResult): boolean {
  const hash = puzzle.seed ?? boardHash(puzzle.pairs);
  const used = usedHashesPerGrade.get(grade);
  if (used?.has(hash)) return true;
  const arr = gradeStockMap.get(grade) ?? [];
  for (const p of arr) {
    const h = p.seed ?? boardHash(p.pairs);
    if (h === hash) return true;
  }
  return false;
}

function getGradeStockCount(grade: number): number {
  return gradeStockMap.get(grade)?.length ?? 0;
}

export function getGradeStockStatus(): Record<number, number> {
  const out: Record<number, number> = {};
  PAIR_LINK_GRADE_CONSTANTS.forEach((g) => {
    out[g.grade] = getGradeStockCount(g.grade);
  });
  return out;
}

export type UsePuzzleStockByGradeOptions = {
  /** デバッグログ（devtj=true 時） */
  debugLog?: boolean;
};

export function usePuzzleStockByGrade(
  _options: UsePuzzleStockByGradeOptions = {}
): {
  getPuzzleByGrade: (grade: number, seed?: string) => Promise<GenerateResult>;
  prefetchGrade: (grade: number) => void;
  stockStatus: Record<number, number>;
  isPrefetching: boolean;
} {
  const { generate } = useBoardWorker();
  const debugLog = _options.debugLog ?? false;
  const [stockStatus, setStockStatus] = useState<Record<number, number>>(() => getGradeStockStatus());
  const isFetchingRef = useRef(false);
  const refillTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushStatus = useCallback(() => {
    setStockStatus(getGradeStockStatus());
  }, []);

  const fetchOneForGrade = useCallback(
    async (def: PairLinkGradeDef, trialIndex: number): Promise<GenerateResult | null> => {
      const config = {
        generationMode: "edgeSwap" as const,
        scoreThreshold: def.scoreThreshold >= 0 ? def.scoreThreshold : -1,
      };
      const result = await generate(def.size, undefined, def.pairs, config);
      if (result.error || !result.numbers?.length) return null;

      const bd = result.postMutationScoreBreakdown;
      const score = bd?.finalScore ?? -Infinity;
      const enclosureCount = bd?.enclosureCount ?? 0;

      if (!matchesEnclosure(enclosureCount, def.enclosureReq)) {
        if (debugLog && typeof window !== "undefined" && window.location?.search?.includes("devtj=true")) {
          console.log(
            `Grade ${def.grade}: Trial ${trialIndex}... enclosure ${enclosureCount} (need ${def.enclosureReq.type}${"value" in def.enclosureReq ? def.enclosureReq.value : ""}) reject`
          );
        }
        return null;
      }

      if (def.scoreThreshold >= 0 && score < def.scoreThreshold) {
        if (debugLog && typeof window !== "undefined" && window.location?.search?.includes("devtj=true")) {
          console.log(`Grade ${def.grade}: Trial ${trialIndex}... Score ${score} < ${def.scoreThreshold} reject`);
        }
        return null;
      }

      if (debugLog && typeof window !== "undefined" && window.location?.search?.includes("devtj=true")) {
        console.log(`Grade ${def.grade}: Trial ${trialIndex}... Found! Score: ${score}, enclosureCount: ${enclosureCount}`);
      }
      return result;
    },
    [generate, debugLog]
  );

  const refillGrade = useCallback(
    async (grade: number) => {
      const def = GRADE_MAP.get(grade);
      if (!def || isFetchingRef.current) return;
      if (getGradeStockCount(grade) >= STOCK_PER_GRADE_MAX) return;

      isFetchingRef.current = true;
      const maxRetries = LOW_SUCCESS_GRADES.has(grade) ? MAX_RETRIES_PER_PUZZLE * 2 : MAX_RETRIES_PER_PUZZLE;

      let trial = 0;
      while (getGradeStockCount(grade) < STOCK_PER_GRADE_MAX && trial < maxRetries) {
        trial++;
        const puzzle = await fetchOneForGrade(def, trial);
        if (puzzle && !isDuplicateInGrade(grade, puzzle)) {
          addToGradeStock(grade, puzzle);
          flushStatus();
        }
        if (trial % 10 === 0 && typeof window !== "undefined") {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      isFetchingRef.current = false;
      flushStatus();
    },
    [fetchOneForGrade, flushStatus]
  );

  const prefetchGrade = useCallback(
    (grade: number) => {
      const def = GRADE_MAP.get(grade);
      if (!def) return;
      if (getGradeStockCount(grade) >= STOCK_REFILL_THRESHOLD) return;

      if (refillTimeoutRef.current) clearTimeout(refillTimeoutRef.current);
      refillTimeoutRef.current = setTimeout(() => {
        refillGrade(grade);
        refillTimeoutRef.current = null;
      }, 100);
    },
    [refillGrade]
  );

  const getPuzzleByGrade = useCallback(
    async (grade: number, seed?: string): Promise<GenerateResult> => {
      const def = GRADE_MAP.get(grade);
      if (!def) throw new Error(`無効なグレード: ${grade}`);

      if (seed?.trim()) {
        const config = {
          generationMode: "edgeSwap" as const,
          scoreThreshold: -1,
        };
        const result = await generate(def.size, seed, def.pairs, config);
        if (!result.error) return result;
        throw new Error("指定されたハッシュでの生成に失敗しました。");
      }

      const head = getFromGradeStock(grade);
      if (head) {
        flushStatus();
        prefetchGrade(grade);
        return head;
      }

      let trial = 0;
      const maxRetries = LOW_SUCCESS_GRADES.has(grade) ? MAX_RETRIES_PER_PUZZLE * 2 : MAX_RETRIES_PER_PUZZLE;
      while (trial < maxRetries) {
        trial++;
        const puzzle = await fetchOneForGrade(def, trial);
        if (puzzle) {
          prefetchGrade(grade);
          return puzzle;
        }
      }
      throw new Error("パズルの生成に失敗しました。もう一度お試しください。");
    },
    [generate, fetchOneForGrade, flushStatus, prefetchGrade]
  );

  useEffect(() => {
    flushStatus();
    return () => {
      if (refillTimeoutRef.current) clearTimeout(refillTimeoutRef.current);
    };
  }, [flushStatus]);

  return {
    getPuzzleByGrade,
    prefetchGrade,
    stockStatus,
    isPrefetching: false,
  };
}
