/**
 * 保険用ハッシュリスト（9,000本ノック由来）の非同期読み込み
 * puzzle_insurance_assets.json（G1〜G11 全グレード対応）を必要な時に fetch
 * 初期ロードを妨げないよう、プリフェッチ時にバックグラウンドで先読み可能
 */

export type InsuranceEntry = { seed: string; boardHash: string };

export type InsuranceAssetsByGrade = Record<string, InsuranceEntry[]>;

let cachedAssets: InsuranceAssetsByGrade | null = null;
let loadPromise: Promise<InsuranceAssetsByGrade> | null = null;

/** 保険アセットを非同期で取得（キャッシュ付き、同一リクエストは共有） */
export async function loadInsuranceAssets(): Promise<InsuranceAssetsByGrade> {
  if (cachedAssets) return cachedAssets;
  if (loadPromise) return loadPromise;
  loadPromise = fetch("/puzzle_insurance_assets.json")
    .then((r) => {
      if (!r.ok) throw new Error("Failed to load puzzle_insurance_assets.json");
      return r.json();
    })
    .then((data: InsuranceAssetsByGrade) => {
      cachedAssets = data;
      return data;
    });
  return loadPromise;
}

/** 保険アセットをバックグラウンドで先読み（フォールバック時に即利用可能にする） */
export function preloadInsuranceAssets(): void {
  if (cachedAssets || loadPromise) return;
  loadInsuranceAssets().catch(() => {});
}

/** 指定グレード（1〜11）の保険エントリ一覧を取得。存在しない場合は空配列 */
export async function getInsuranceEntriesForGrade(grade: number): Promise<InsuranceEntry[]> {
  const assets = await loadInsuranceAssets();
  const key = String(grade);
  const arr = assets[key];
  return Array.isArray(arr) && arr.length > 0 ? arr : [];
}
