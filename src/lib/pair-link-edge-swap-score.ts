/** Edge-Swap 評価（board-worker の computeMutationScoreBreakdown）と揃えた既定値・マージ */

export type EdgeSwapScoreParams = {
  coverageMult: number;
  wEndpoint: number;
  wParallel: number;
  enclosureMult: number;
  semiDist3Weight: number;
  adjRateT1: number;
  adjRateT2: number;
};

export const EDGE_SWAP_SCORE_DEFAULTS: EdgeSwapScoreParams = {
  coverageMult: 1.5,
  wEndpoint: 2,
  wParallel: 7,
  enclosureMult: 1.5,
  semiDist3Weight: 0.5,
  adjRateT1: 0.15,
  adjRateT2: 0.3,
};

export function mergeEdgeSwapScoreParams(
  raw?: Partial<Record<keyof EdgeSwapScoreParams, number>>
): EdgeSwapScoreParams {
  const d: EdgeSwapScoreParams = { ...EDGE_SWAP_SCORE_DEFAULTS };
  if (!raw) return d;
  (Object.keys(d) as (keyof EdgeSwapScoreParams)[]).forEach((key) => {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      if (key === "adjRateT1" || key === "adjRateT2") {
        d[key] = Math.max(0.01, Math.min(0.99, v));
      } else {
        d[key] = Math.max(0, Math.min(30, v));
      }
    }
  });
  if (d.adjRateT2 <= d.adjRateT1) {
    d.adjRateT2 = Math.min(0.99, d.adjRateT1 + 0.01);
  }
  return d;
}
