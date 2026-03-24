/**
 * 知育ステップに最適化された11段階グレード定義（9,000本ノック分析結果に基づく）
 * 各グレードの閾値は CONSTANTS として分離し、後から微調整可能。
 */

export type GradeEnclosureRequirement =
  | { type: "any" }
  | { type: "eq"; value: number }
  | { type: "gte"; value: number }
  | { type: "lte"; value: number };

export type PairLinkGradeDef = {
  grade: number;
  size: number;
  pairs: number;
  /** 囲い込み条件: any=指定なし, eq=一致, gte=以上, lte=以下 */
  enclosureReq: GradeEnclosureRequirement;
  /** Score閾値（-1=なし/全許容）。Workerは finalScore >= scoreThreshold でフィルタ */
  scoreThreshold: number;
  /** 知育テーマ（UI表示用） */
  theme: string;
};

/** 各グレードの定義（微調整用） */
export const PAIR_LINK_GRADE_CONSTANTS: PairLinkGradeDef[] = [
  { grade: 1, size: 4, pairs: 3, enclosureReq: { type: "eq", value: 0 }, scoreThreshold: -1, theme: "【超入門】まずはつないでみよう" },
  { grade: 2, size: 4, pairs: 3, enclosureReq: { type: "gte", value: 1 }, scoreThreshold: 0, theme: "【導入】最短以外のルートを意識" },
  { grade: 3, size: 5, pairs: 4, enclosureReq: { type: "eq", value: 0 }, scoreThreshold: 100, theme: "【初級】空間を埋める楽しさ" },
  { grade: 4, size: 5, pairs: 4, enclosureReq: { type: "gte", value: 1 }, scoreThreshold: 400, theme: "【初級】回り込みの概念を知る" },
  { grade: 5, size: 6, pairs: 5, enclosureReq: { type: "eq", value: 0 }, scoreThreshold: 200, theme: "【中級】効率的なルート設計" },
  { grade: 6, size: 6, pairs: 5, enclosureReq: { type: "gte", value: 1 }, scoreThreshold: 800, theme: "【中級】回り込みを使いこなす" },
  { grade: 7, size: 7, pairs: 7, enclosureReq: { type: "lte", value: 1 }, scoreThreshold: 0, theme: "【難関への扉】高密度な盤面の整理" },
  { grade: 8, size: 8, pairs: 8, enclosureReq: { type: "lte", value: 1 }, scoreThreshold: 300, theme: "【上級】広い盤面でのルート俯瞰" },
  { grade: 9, size: 8, pairs: 9, enclosureReq: { type: "gte", value: 2 }, scoreThreshold: 1500, theme: "【特級】複雑な干渉を解き明かす" },
  { grade: 10, size: 9, pairs: 10, enclosureReq: { type: "gte", value: 1 }, scoreThreshold: 2500, theme: "【達人】AIが選んだ迷宮に挑む" },
  { grade: 11, size: 10, pairs: 10, enclosureReq: { type: "gte", value: 2 }, scoreThreshold: 3500, theme: "【神・隠し】極限の思考の先へ" },
];

/**
 * 全グレード共通の盤面採用条件（ストック投入・即時生成の fetch フィルタ）。
 * Worker の `postMutationScoreBreakdown.adjRate`（各ペアの2端点間マンハッタン距離に基づく
 * 隣接密度を pathCount で割った値。Dist2+Dist3重み付き）がこの値 **未満** であること。
 * すなわち「隣接ペア相当の割合」が全ペアの 40% 未満。
 */
export const GRADE_ADOPTION_MAX_ADJ_RATE = 0.4;

/** グレード番号→定義のマップ */
export const GRADE_MAP = new Map(PAIR_LINK_GRADE_CONSTANTS.map((g) => [g.grade, g]));

/** 成功率が低い（Positive率が低い）グレード：リトライ上限を多めに */
export const LOW_SUCCESS_GRADES = new Set([1, 2, 7]);

/** ストック数の設定 */
export const STOCK_PER_GRADE_MIN = 3;
export const STOCK_PER_GRADE_MAX = 5;
export const STOCK_REFILL_THRESHOLD = 2;

/** グレード別リトライ上限（低成功率グレードは多め） */
export const MAX_RETRIES_PER_PUZZLE = 300;
