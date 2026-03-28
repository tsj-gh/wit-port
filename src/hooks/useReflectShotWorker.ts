"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GridStage } from "@/app/lab/reflec-shot/gridTypes";
import {
  deserializeGridStageFromWorker,
  type ReflectShotGenMetrics,
  type ReflectShotMainToWorkerGenerate,
  type ReflectShotWorkerToMain,
} from "@/app/lab/reflec-shot/reflectShotWorkerTypes";

const DEFAULT_SCRIPT = "/workers/reflect-shot-worker.js";

export type ReflectShotGenerateSource = "user" | "prefetch";

type Pending = {
  resolve: (v: ReflectShotGenerateResult) => void;
  reject: (e: Error) => void;
  source: ReflectShotGenerateSource;
};

export type ReflectShotGenerateResult = {
  stage: GridStage;
  metrics: ReflectShotGenMetrics;
};

/**
 * Reflect-Shot 盤面生成を専用 Worker に委譲する。
 * アンマウント時に worker を terminate。同一 Worker に対する応答は requestId で突き合わせる。
 */
export function useReflectShotWorker(workerScriptUrl: string = DEFAULT_SCRIPT) {
  const workerRef = useRef<Worker | null>(null);
  const pendingByIdRef = useRef(new Map<string, Pending>());
  const userInFlightRef = useRef(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastMetrics, setLastMetrics] = useState<ReflectShotGenMetrics | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const pendingMap = pendingByIdRef.current;
    const w = new Worker(workerScriptUrl);
    workerRef.current = w;

    w.onmessage = (ev: MessageEvent<ReflectShotWorkerToMain>) => {
      const data = ev.data;
      if (!("requestId" in data) || !data.requestId) return;
      if (data.type === "STATUS") return;

      const pending = pendingMap.get(data.requestId);
      if (!pending) return;
      pendingMap.delete(data.requestId);
      if (pending.source === "user") {
        userInFlightRef.current = Math.max(0, userInFlightRef.current - 1);
        if (userInFlightRef.current === 0) setIsGenerating(false);
      }

      if (data.type === "SUCCESS") {
        setLastMetrics(data.metrics);
        pending.resolve({
          stage: deserializeGridStageFromWorker(data.board),
          metrics: data.metrics,
        });
      } else {
        pending.reject(new Error(data.error || "Worker ERROR"));
      }
    };

    return () => {
      pendingMap.forEach((p) => p.reject(new Error("Reflect-Shot Worker を終了しました")));
      pendingMap.clear();
      userInFlightRef.current = 0;
      setIsGenerating(false);
      w.terminate();
      workerRef.current = null;
    };
  }, [workerScriptUrl]);

  const generate = useCallback(
    (
      grade: number,
      seed: number,
      opts?: { source?: ReflectShotGenerateSource; grade2Bend6TotalBends?: 6 | 7 | 8 }
    ): Promise<ReflectShotGenerateResult> => {
      const w = workerRef.current;
      if (!w) {
        return Promise.reject(new Error("Reflect-Shot Worker が未初期化です"));
      }

      const source: ReflectShotGenerateSource = opts?.source ?? "user";
      if (source === "user" && userInFlightRef.current > 0) {
        return Promise.reject(new Error("Reflect-Shot: ユーザー向け生成は既に実行中です"));
      }

      const requestId = `rs-${Date.now()}-${++reqIdRef.current}`;
      if (source === "user") {
        userInFlightRef.current += 1;
        setIsGenerating(true);
      }

      return new Promise((resolve, reject) => {
        pendingByIdRef.current.set(requestId, { resolve, reject, source });
        const payload: ReflectShotMainToWorkerGenerate = {
          type: "GENERATE",
          requestId,
          grade,
          seed,
          ...(grade === 4 && opts?.grade2Bend6TotalBends != null
            ? { grade2Bend6TotalBends: opts.grade2Bend6TotalBends }
            : {}),
        };
        w.postMessage(payload);
      });
    },
    []
  );

  return { generate, isGenerating, lastMetrics };
}
