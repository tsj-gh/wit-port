/**
 * esbuild で `public/workers/reflect-shot-worker.js` へバンドルするエントリ。
 */
import { generateGridStageWithFallbackMeta } from "../app/lab/reflec-shot/gridStageGen";
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
    const meta = generateGridStageWithFallbackMeta(grade, seed, genOpts);
    const totalMs = performance.now() - t0;
    if (debugReflecShotConsole) {
      console.log("[ReflecShot Worker] generate", {
        grade,
        usedPrimary: meta.usedPrimary,
        fallbackT: meta.fallbackT,
        requestSeed: meta.requestSeed,
        effectiveSeed: meta.effectiveSeed,
        requestHex: meta.requestSeed.toString(16),
        effectiveHex: meta.effectiveSeed.toString(16),
        start: `${meta.stage.start.c},${meta.stage.start.r}`,
        goal: `${meta.stage.goal.c},${meta.stage.goal.r}`,
        ms: totalMs,
      });
    }
    post({
      type: "SUCCESS",
      requestId,
      board: serializeGridStageForWorker(meta.stage),
      metrics: {
        totalMs,
        usedPrimary: meta.usedPrimary,
        fallbackT: meta.fallbackT,
        requestSeed: meta.requestSeed,
        effectiveSeed: meta.effectiveSeed,
      },
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
