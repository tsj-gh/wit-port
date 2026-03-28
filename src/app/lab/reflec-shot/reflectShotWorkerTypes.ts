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
  /** Grade2・折れ6 のみ。全体目標折れ 6/7/8 を Worker 生成に反映（未指定時は算法どおり乱択） */
  grade2Bend6TotalBends?: 6 | 7 | 8;
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
