import type { BumperCell, BumperKind, CellCoord, GridStage } from "./gridTypes";

/** Worker 送信用（`Map` 非対応のためタプル列） */
export type ReflectShotSerializedStage = Omit<GridStage, "bumpers"> & {
  bumpers: [string, { display: BumperKind; solution: BumperKind; isDummy?: boolean }][];
};

export type ReflectShotGenMetrics = {
  totalMs: number;
  /** `generateGridStage` が成功した（フォールバック未使用） */
  usedPrimary: boolean;
  /** フォールバック探索のオフセット t（プライマリ成功時は 0） */
  fallbackT: number;
  /** `GENERATE` で渡した seed */
  requestSeed: number;
  /** 盤 `board.seed` と一致する、生成に実際に使った seed */
  effectiveSeed: number;
};

/** Grade5（Lv.4）経路生成。`rFirst` / `rSecond` はデバッグ UI からのみ指定想定 */
export type ReflectShotLv4GenMode = "default" | "rFirst" | "rSecond";

export type ReflectShotMainToWorkerGenerate = {
  type: "GENERATE";
  requestId: string;
  grade: number;
  seed: number;
  /** Grade4（Lv.3・折れ6）のみ。全体目標折れ 6/7/8 を Worker に反映（未指定時は乱択） */
  grade2Bend6TotalBends?: 6 | 7 | 8;
  /** デバッグ UI オン時: start 延長の棄却理由を Worker の console に出す */
  debugReflecShotConsole?: boolean;
  /** Grade5+・デバッグ時: Lv.4（再訪1）の生成アルゴリズム */
  lv4GenMode?: ReflectShotLv4GenMode;
  /** devtj+DEBUG: ダミーバンパー密度 0〜100 */
  dummyDensityPct?: number;
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
