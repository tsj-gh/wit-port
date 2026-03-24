"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EdgeSwapScoreParams } from "@/lib/pair-link-edge-swap-score";

export type { EdgeSwapScoreParams };

/** Worker（Edge-Swap 囲い込みデバッグ）から返る可視化用エントリ */
export type EnclosureDebugItem =
  | {
      kind: "vertical";
      col: number;
      y1: number;
      y2: number;
      nRow: number;
      nCol: number;
      pathIdP: number;
      pathIdN: number;
      /** エセ回り込みで棄却されたライン（可視化用） */
      pseudo?: boolean;
    }
  | {
      kind: "horizontal";
      row: number;
      x1: number;
      x2: number;
      nRow: number;
      nCol: number;
      pathIdP: number;
      pathIdN: number;
      pseudo?: boolean;
    };

/** postMutationScoreBreakdown（Worker返却、グレードフィルタ用） */
export type PostMutationScoreBreakdown = {
  finalScore: number;
  enclosureCount?: number;
  /** 隣接密度（pathCount 正規化）。グレード採用では pair-link-grade-constants の GRADE_ADOPTION_MAX_ADJ_RATE 未満 */
  adjRate?: number;
  [key: string]: unknown;
};

export type GenerateResult = {
  numbers: { x: number; y: number; val: number; color: string }[];
  pairs: { id: number; start: [number, number]; end: [number, number] }[];
  gridSize: number;
  pairCount: number;
  error?: string;
  profile?: Record<string, number>;
  attempts?: number;
  totalMs?: number;
  /** 盤面生成に使用したシード値（再現用） */
  seed?: string;
  /** デバッグ用：正解の paths（6x6 等で生成時に取得可能） */
  solutionPaths?: Record<string, { x: number; y: number }[][]> | null;
  /** Edge-Swap + debugEnclosureViz 時：囲い込みライン描画用 */
  debugEnclosures?: EnclosureDebugItem[] | null;
  /** グレードフィルタ・分析用（Edge-Swap のみ） */
  postMutationScoreBreakdown?: PostMutationScoreBreakdown | null;
};

/** Worker との通信メッセージ（全タイプで requestId を任意に持てる） */
type WorkerMessage =
  | { type: "STATUS"; status: string; requestId?: string }
  | {
      type: "SUCCESS";
      board: Omit<GenerateResult, "profile" | "attempts" | "totalMs" | "error"> & { seed?: string };
      metrics: { profile?: Record<string, number>; attempts?: number; totalMs?: number };
      requestId: string;
    }
  | { type: "ERROR"; error: string; requestId: string };

let workerInstance: Worker | null = null;
let workerRefCount = 0;

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker("/workers/board-worker.js");
  }
  return workerInstance;
}

function releaseWorker(): void {
  workerRefCount--;
  if (workerRefCount <= 0 && workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    workerRefCount = 0;
  }
}

export type WorkerConfig = {
  emptyIsolatedPenalty?: number;
  detourWeight?: number;
  baseThreshold?: number;
  /** デバッグ用: "edgeSwap" = 8x8 Edge-Swap 方式 */
  generationMode?: "default" | "edgeSwap";
  /** Edge-Swap 時: 囲い込みの目標件数（0 以上で有効。未指定は距離のみの従来挙動） */
  targetEnclosureCount?: number;
  /** Edge-Swap 時: 囲い込み列挙ログと可視化データを返す */
  debugEnclosureViz?: boolean;
  /** Edge-Swap 時: 評価関数の 7 定数（部分指定可、worker 側で既定とマージ） */
  edgeSwapScoreParams?: Partial<EdgeSwapScoreParams>;
  /** Edge-Swap 時: FinalBoard Score 閾値（-1 で無効、0以上で閾値未満の盤面を破棄してリトライ） */
  scoreThreshold?: number;
  /** デバッグモードON時のみ: アルゴリズムのコンソール出力を有効化 */
  enableAlgoLogs?: boolean;
  /** enableAlgoLogs が true のとき: true で全ログ、false で Final Board とエラーのみ */
  verboseAlgoLogs?: boolean;
};

type QueueItem = {
  gridSize: number;
  seed?: string;
  numPairs?: number;
  config?: WorkerConfig;
  resolve: (r: GenerateResult) => void;
  reject: (e: Error) => void;
  requestId: string;
};

/**
 * Pair-link 盤面生成を Web Worker で実行する共通フック
 * Pair-link ページ・トップページの両方で利用可能
 */
export function useBoardWorker(): {
  generate: (gridSize: number, seed?: string, numPairs?: number, config?: WorkerConfig) => Promise<GenerateResult>;
  isGenerating: boolean;
} {
  const [isGenerating, setIsGenerating] = useState(false);
  const queueRef = useRef<QueueItem[]>([]);
  const isProcessingRef = useRef(false);
  const mountedRef = useRef(true);

  const processNext = useCallback(() => {
    if (isProcessingRef.current || queueRef.current.length === 0) {
      return;
    }
    const item = queueRef.current.shift()!;
    isProcessingRef.current = true;
    setIsGenerating(true);

    const worker = getWorker();
    workerRefCount = Math.max(workerRefCount, 1);

    const onMessage = (e: MessageEvent<WorkerMessage>) => {
      const data = e.data;
      if (!data) return;
      if (data.type === "STATUS") return;
      if ("requestId" in data && data.requestId !== item.requestId) return;

      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);

      if (data.type === "SUCCESS") {
        const { board, metrics } = data;
        item.resolve({
          ...board,
          postMutationScoreBreakdown: board.postMutationScoreBreakdown ?? null,
          profile: metrics?.profile,
          attempts: metrics?.attempts,
          totalMs: metrics?.totalMs,
        });
      } else if (data.type === "ERROR") {
        item.reject(new Error(data.error));
      }

      isProcessingRef.current = false;
      setIsGenerating(false);
      if (mountedRef.current) {
        processNext();
      }
    };

    const onError = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      item.reject(new Error("Worker error"));
      isProcessingRef.current = false;
      setIsGenerating(false);
      if (mountedRef.current) {
        processNext();
      }
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage({
      type: "GENERATE",
      gridSize: item.gridSize,
      seed: item.seed,
      numPairs: item.numPairs,
      config: item.config,
      requestId: item.requestId,
    });
  }, []);

  const generate = useCallback(
    (gridSize: number, seed?: string, numPairs?: number, config?: WorkerConfig): Promise<GenerateResult> => {
      return new Promise((resolve, reject) => {
        if (!mountedRef.current) {
          reject(new Error("Unmounted"));
          return;
        }

        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        queueRef.current.push({
          gridSize,
          seed,
          numPairs,
          config,
          resolve,
          reject,
          requestId,
        });

        processNext();
      });
    },
    [processNext]
  );

  useEffect(() => {
    mountedRef.current = true;
    workerRefCount++;

    return () => {
      mountedRef.current = false;
      releaseWorker();
      queueRef.current.forEach((item) => {
        item.reject(new Error("Unmounted"));
      });
      queueRef.current = [];
    };
  }, []);

  return { generate, isGenerating };
}
