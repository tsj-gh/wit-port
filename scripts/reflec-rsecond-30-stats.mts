/**
 * R-Second・Grade5 を 30 回成功まで生成し、再訪セル座標と「再訪→他折れ点」のマンハッタン距離を集計する。
 * npx --yes tsx scripts/reflec-rsecond-30-stats.mts
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type Cell = { c: number; r: number };

const __dirname = dirname(fileURLToPath(import.meta.url));
const grid = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridStageGen.ts")).href);
const { generateGridStage } = grid;

function keyOf(p: Cell) {
  return `${p.c},${p.r}`;
}

/** ちょうど 1 マスが 2 回出現 → 再訪セル */
function revisitCell(path: Cell[]): Cell | null {
  const m = new Map<string, number>();
  for (const p of path) {
    const k = keyOf(p);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  let dup: string | null = null;
  for (const [k, n] of m) {
    if (n === 2) {
      if (dup !== null) return null;
      dup = k;
    }
  }
  if (!dup) return null;
  const [c, r] = dup.split(",").map(Number);
  return { c: c!, r: r! };
}

function orthBendAt(path: Cell[], i: number): boolean {
  if (i <= 0 || i >= path.length - 1) return false;
  const a = path[i - 1]!;
  const b = path[i]!;
  const c = path[i + 1]!;
  const dc0 = b.c - a.c;
  const dr0 = b.r - a.r;
  const dc1 = c.c - b.c;
  const dr1 = c.r - b.r;
  if (Math.abs(dc0) + Math.abs(dr0) !== 1 || Math.abs(dc1) + Math.abs(dr1) !== 1) return false;
  return dc0 * dc1 + dr0 * dr1 === 0;
}

/** 添字 i で直角折れするマス（再訪は 2 添字で同じ座標が 2 回登録されうる） */
function bendVertexKeys(path: Cell[]): string[] {
  const out: string[] = [];
  for (let i = 1; i <= path.length - 2; i++) {
    if (orthBendAt(path, i)) out.push(keyOf(path[i]!));
  }
  return out;
}

function manhattan(a: Cell, b: Cell) {
  return Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
}

const TARGET = 30;
const RANDOM = process.argv.includes("--random");
const rows: { seed: number; R: Cell; bendKeys: Set<string>; dists: number[] }[] = [];

let s = 0;
let rnd = 0xdefaced;
while (rows.length < TARGET && s < 500_000) {
  s++;
  const seed = RANDOM ? (rnd = (rnd * 1664525 + 1013904223) >>> 0) : (s >>> 0);
  const st = generateGridStage(5, seed, { lv4GenMode: "rSecond" });
  if (!st) continue;
  const path = st.solutionPath.map((p) => ({ ...p }));
  const R = revisitCell(path);
  if (!R) {
    console.error("seed", seed, "no revisit cell");
    continue;
  }
  const bends = bendVertexKeys(path);
  const uniqBendCells = new Set(bends);
  const rk = keyOf(R);
  const others = [...uniqBendCells].filter((k) => k !== rk);
  const dists = others.map((k) => {
    const [c, r] = k.split(",").map(Number);
    return manhattan(R, { c: c!, r: r! });
  });
  rows.push({ seed: seed >>> 0, R: { ...R }, bendKeys: uniqBendCells, dists });
}

if (rows.length < TARGET) {
  console.error("成功不足:", rows.length);
  process.exit(1);
}

const rCount = new Map<string, number>();
for (const row of rows) {
  const k = keyOf(row.R);
  rCount.set(k, (rCount.get(k) ?? 0) + 1);
}

const distHist = new Map<number, number>();
for (const row of rows) {
  for (const d of row.dists) {
    distHist.set(d, (distHist.get(d) ?? 0) + 1);
  }
}

const nDist = [...distHist.values()].reduce((a, b) => a + b, 0);

console.log("R-Second Grade5: 成功サンプル数", rows.length, RANDOM ? "(--random)" : "(連番1..)");
console.log("使用シード:", rows.map((r) => "0x" + (r.seed >>> 0).toString(16)).join(", "));
console.log("");
console.log("=== 再訪折れ点セル (c,r) の出現回数（30回中）===");
const rSorted = [...rCount.entries()].sort((a, b) => b[1] - a[1]);
for (const [cell, n] of rSorted) {
  console.log(`  (${cell.replace(",", ", ")})  ${n} 回  (${((n / TARGET) * 100).toFixed(1)}%)`);
}
console.log("");
console.log("=== 再訪マス → 他の直角折れマス（一意・再訪除く）へのマンハッタン距離 ===");
console.log("1 盤あたり距離サンプル数:", rows[0]!.dists.length, "（理論上 4）");
console.log("全サンプル数（30×4）:", nDist);
const dSorted = [...distHist.entries()].sort((a, b) => a[0] - b[0]);
for (const [d, n] of dSorted) {
  console.log(`  距離 ${d}: ${n} 回  (${((n / nDist) * 100).toFixed(1)}%)`);
}
console.log("");
console.log("=== 各試行サマリ（seed / R / 他折れ点距離 [d1,d2,d3,d4]）===");
for (const row of rows) {
  console.log(
    `seed=${row.seed}  R=(${row.R.c},${row.R.r})  dists=[${row.dists.sort((a, b) => a - b).join(",")}]`
  );
}
