/**
 * 修正後 R-Second が特定の解経路（(c,r) 列）を出す seed を探索
 * npx --yes tsx scripts/verify-reflec-rsecond-target-path.mts [maxSeed]
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const maxSeed = Number.parseInt(process.argv[2] ?? "400000", 10) >>> 0;

const { generateGridStage } = await import(
  pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "../src/app/lab/reflec-shot/gridStageGen.ts")).href
);

/** ユーザー経路 (r,c) を (c,r) にした直交展開 */
const want = JSON.stringify([
  { c: 4, r: 4 },
  { c: 4, r: 3 },
  { c: 4, r: 2 },
  { c: 4, r: 1 },
  { c: 3, r: 1 },
  { c: 2, r: 1 },
  { c: 1, r: 1 },
  { c: 1, r: 2 },
  { c: 0, r: 2 },
  { c: 0, r: 1 },
  { c: 1, r: 1 },
  { c: 1, r: 0 },
]);

let hit: number | null = null;
for (let s = 0; s < maxSeed; s++) {
  const st = generateGridStage(5, s >>> 0, { lv4GenMode: "rSecond" });
  if (!st) continue;
  if (JSON.stringify(st.solutionPath) === want) {
    hit = s;
    break;
  }
}
console.log(hit === null ? `no exact match in 0..${maxSeed - 1}` : `match seed=0x${hit.toString(16)} (${hit})`);
