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
  const { requestId, grade, seed } = msg;
  post({ type: "STATUS", status: "RUNNING", requestId });
  try {
    const t0 = performance.now();
    const board = generateGridStageWithFallback(grade, seed);
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
