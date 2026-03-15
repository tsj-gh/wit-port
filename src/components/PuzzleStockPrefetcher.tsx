"use client";

import { useEffect } from "react";
import { usePuzzleStock } from "@/hooks/usePuzzleStock";

/** トップページでペアリンクの在庫を先読みする（表示時点で prefetch 実行） */
export default function PuzzleStockPrefetcher() {
  const { prefetch } = usePuzzleStock({ gridSize: 6, persist: true });

  useEffect(() => {
    prefetch();
  }, [prefetch]);

  return null;
}
