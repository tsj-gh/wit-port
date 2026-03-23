"use client";

import { useEffect } from "react";
import { usePuzzleStock } from "@/hooks/usePuzzleStock";
import { usePuzzleStockByGrade } from "@/hooks/usePuzzleStockByGrade";

/** トップページでペアリンクの在庫を先読みする（表示時点で prefetch 実行） */
export default function PuzzleStockPrefetcher() {
  const { prefetch } = usePuzzleStock({});
  const { prefetchGrade } = usePuzzleStockByGrade({ debugLog: false });

  useEffect(() => {
    prefetch(6, 5);
    prefetchGrade(1);
    prefetchGrade(2);
    prefetchGrade(3);
  }, [prefetch, prefetchGrade]);

  return null;
}
