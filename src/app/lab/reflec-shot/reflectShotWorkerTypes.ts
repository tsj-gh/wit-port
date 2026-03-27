import type { BumperCell, BumperKind, CellCoord, GridStage } from "./gridTypes";

/** Worker 送信用（`Map` 非対応のためタプル列） */
export type ReflectShotSerializedStage = Omit<GridStage, "bumpers"> & {
  bumpers: [string, { display: BumperKind; solution: BumperKind }][];
};

export type ReflectShotGenMetrics = {
  totalMs: number;
};

export type ReflectShotMainToWorkerGenerate = {
  type: "GENERATE";
  requestId: string;
  grade: number;
  seed: number;
};

export type ReflectShotWorkerToMain =
  | { type: "STATUS"; status: "RUNNING"; requestId: string }
  | {
      type: "SUCCESS";
      requestId: string;
      board: ReflectShotSerializedStage;
      metrics: ReflectShotGenMetrics;
    }
  | { type: "ERROR"; requestId: string; error: string };

export function serializeGridStageForWorker(st: GridStage): ReflectShotSerializedStage {
  return {
    ...st,
    bumpers: Array.from(st.bumpers.entries()),
  };
}

export function deserializeGridStageFromWorker(raw: ReflectShotSerializedStage): GridStage {
  return {
    ...raw,
    bumpers: new Map(raw.bumpers),
  };
}
