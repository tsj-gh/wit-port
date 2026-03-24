/**
 * 保険用ハッシュリスト（9,000本ノック由来）の非同期読み込み
 * 初期ロードを妨げないよう、必要な時に fetch で取得
 */

export type InsuranceEntry = { seed: string; boardHash: string };

export type InsuranceAssetsByGrade = Record<string, InsuranceEntry[]>;

let cachedAssets: InsuranceAssetsByGrade | null = null;
let loadPromise: Promise<InsuranceAssetsByGrade> | null = null;

/** 保険アセットを非同期で取得（キャッシュ付き） */
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

/** 指定グレードの保険エントリ一覧を取得（空配列の場合は空） */
export async function getInsuranceEntriesForGrade(grade: number): Promise<InsuranceEntry[]> {
  const assets = await loadInsuranceAssets();
  const key = String(grade);
  const arr = assets[key];
  return Array.isArray(arr) && arr.length > 0 ? arr : [];
}
