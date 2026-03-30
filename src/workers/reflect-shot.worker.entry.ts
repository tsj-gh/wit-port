/**
 * esbuild で `public/workers/reflect-shot-worker.js` へバンドルするエントリ。
 */
import { generateGridStageWithFallback } from "../app/lab/reflec-shot/gridStageGen";
import {
  serializeGridStageForWorker,
  type ReflectShotMainToWorkerGenerate,
  type ReflectShotWorkerToMain,
} from "../app/lab/reflec-shot/reflectShotWorkerTypes";

function post(data: ReflectShotWorkerToMain) {
  (self as unknown as Worker).postMessage(data);
}

self.onmessage = (ev: MessageEvent<ReflectShotMainToWorkerGenerate>) => {
  const msg = ev.data;
  if (!msg || msg.type !== "GENERATE") return;
  const { requestId, grade, seed, grade2Bend6TotalBends, debugReflecShotConsole, lv4GenMode } = msg;
  post({ type: "STATUS", status: "RUNNING", requestId });
  try {
    const t0 = performance.now();
    const genOpts =
      (grade === 4 && grade2Bend6TotalBends != null) ||
      debugReflecShotConsole ||
      lv4GenMode != null
        ? {
            ...(grade === 4 && grade2Bend6TotalBends != null ? { grade2Bend6TotalBends } : {}),
            ...(debugReflecShotConsole ? { debugReflecShotConsole: true as const } : {}),
            ...(lv4GenMode != null ? { lv4GenMode } : {}),
          }
        : undefined;
    const board = generateGridStageWithFallback(grade, seed, genOpts);
    const totalMs = performance.now() - t0;
    post({
      type: "SUCCESS",
      requestId,
      board: serializeGridStageForWorker(board),
      metrics: { totalMs },
    });
  } catch (e) {
    post({
      type: "ERROR",
      requestId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};

export {};
