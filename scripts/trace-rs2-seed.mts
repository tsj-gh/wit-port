/**
 * rs2 シードの Grade2 6 折れトレース（lastGrade2Bend6Trace 利用）
 * 実行: npx tsx scripts/trace-rs2-seed.mts [rs2.2.xxx]
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GS = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridStageGen.ts")).href);
const HASH = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/reflecShotStageHash.ts")).href);
const GT = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridTypes.ts")).href);

const { generateGridStage, totalDiagonalTurnCount } = GS;
const { keyCell } = GT;

function unitStepDir(dc: number, dr: number) {
  if (!((Math.abs(dc) === 1 && dr === 0) || (dc === 0 && Math.abs(dr) === 1))) return null;
  return GT.gridDeltaToScreenDir({ dx: dc, dy: dr });
}

function orthogonalDirs(a: { dx: number; dy: number }, b: { dx: number; dy: number }) {
  return a.dx * b.dx + a.dy * b.dy === 0 && a.dx * a.dx + a.dy * a.dy === 1 && b.dx * b.dx + b.dy * b.dy === 1;
}

function countRightAngles(path: { c: number; r: number }[]) {
  let n = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const d0 = unitStepDir(path[i]!.c - path[i - 1]!.c, path[i]!.r - path[i - 1]!.r);
    const d1 = unitStepDir(path[i + 1]!.c - path[i]!.c, path[i + 1]!.r - path[i]!.r);
    if (d0 && d1 && orthogonalDirs(d0, d1)) n++;
  }
  return n;
}

function portalBendAtStart(path: { c: number; r: number }[], startPad: { c: number; r: number }) {
  if (path.length < 2) return false;
  const dx0 = Math.sign(path[0]!.c - startPad.c);
  const dy0 = Math.sign(path[0]!.r - startPad.r);
  const dx1 = Math.sign(path[1]!.c - path[0]!.c);
  const dy1 = Math.sign(path[1]!.r - path[0]!.r);
  return (
    dx0 * dx1 + dy0 * dy1 === 0 &&
    Math.abs(dx0) + Math.abs(dy0) === 1 &&
    Math.abs(dx1) + Math.abs(dy1) === 1
  );
}

function portalBendAtGoal(path: { c: number; r: number }[], goalPad: { c: number; r: number }) {
  if (path.length < 2) return false;
  const g = path[path.length - 1]!;
  const prev = path[path.length - 2]!;
  const dx0 = Math.sign(g.c - prev.c);
  const dy0 = Math.sign(g.r - prev.r);
  const dx1 = Math.sign(goalPad.c - g.c);
  const dy1 = Math.sign(goalPad.r - g.r);
  return (
    dx0 * dx1 + dy0 * dy1 === 0 &&
    Math.abs(dx0) + Math.abs(dy0) === 1 &&
    Math.abs(dx1) + Math.abs(dy1) === 1
  );
}

function fmt(p: { c: number; r: number }) {
  return `(${p.c},${p.r})`;
}

const raw = process.argv[2] ?? "rs2.2.3bb3e6ed";
const parsed = HASH.parseReflecHash(raw);
if (!parsed || parsed.kind !== "rs2" || parsed.grade !== 2) {
  console.error("Grade 2 の rs2 ハッシュが必要です:", raw);
  process.exit(1);
}
const seed = parsed.seed;
console.log("input:", raw);
console.log("seed uint32:", seed, "0x" + seed.toString(16));

const st = generateGridStage(2, seed);
if (!st) {
  console.error("generateGridStage(2) が null");
  process.exit(1);
}

const path = st.solutionPath;
const snap = GS.lastGrade2Bend6Trace;

console.log("\n--- 最終盤面（デバッグ表示＝solutionPath と同一） ---");
console.log("盤: 5×5 全体 pathable（Grade2）");
console.log("start:", fmt(st.start), "| goal:", fmt(st.goal));
console.log("startPad:", fmt(st.startPad), "← 仕様: start の真下 (c, r+1)。射入は画面向き DIR.U。");
const prevG = path[path.length - 2]!;
console.log(
  "goalPad:",
  fmt(st.goalPad),
  "← 仕様: prev→goal の単位ステップ (dx,dy) を goal に足した盤外 1 マス。",
  "prev=",
  fmt(prevG)
);
console.log("solutionPath（正解経路）:", path.map(fmt).join(" → "));
console.log("countRightAngles:", countRightAngles(path));
const exp = totalDiagonalTurnCount(path, st.startPad, st.goalPad);
console.log("totalDiagonalTurnCount:", exp);
console.log("portalBendAtStart:", portalBendAtStart(path, st.startPad));
console.log("portalBendAtGoal:", portalBendAtGoal(path, st.goalPad));
const gk = keyCell(st.goal.c, st.goal.r);
console.log("goal のマスにバンパー solution あり？", st.bumpers.has(gk), st.bumpers.get(gk) ?? null);
console.log("stageRowRange:", GT.stageRowRange(st), "（startPad, goalPad, start, goal, path 全行の min/max）");

if (snap) {
  const t = snap.trace;
  console.log("\n--- tryGrade2Bend6Path（向き調整前 raw）フック ---");
  console.log("polyline 外周リトライ attempt (outerAttempt):", t.outerAttempt);
  console.log("フック内 48 試行の勝ち index (innerAttempt):", t.innerAttempt);
  console.log("variantA (start 側フック):", t.variantA);
  console.log("ds（列方向ベクトル・マス数。pickSignedMag で符号付き乱数）:", t.ds);
  if (t.variantA) {
    console.log("S1 = (start.c+ds, start.r) =", fmt(t.S1!), "（start と同じ行で横移動）");
    console.log("S2 = (S1.c, S1.r-1) =", fmt(t.S2!), "（S1 の真上 1 マス）");
    console.log("尾 DFS・S2→goal（端点込み）:", t.tailPolyline.map(fmt).join(" → "));
  } else {
    console.log("G1 = (goal.c+ds, goal.r) =", fmt(t.G1!));
    console.log("G2 = (G1.c, G1.r+1) =", fmt(t.G2!));
    console.log("尾 DFS（反転前・G2 から start へ）:", t.tailPolyline.map(fmt).join(" → "));
  }
  console.log("raw Q（raw 経路の goal 直前）:", fmt(t.Q));
  console.log("raw 全頂点:", snap.rawPath.map(fmt).join(" → "));
  const same =
    path.length === snap.rawPath.length &&
    path.every((c, i) => c.c === snap.rawPath[i]!.c && c.r === snap.rawPath[i]!.r);
  console.log("\n正解経路 vs rawPath（pick 前） 完全一致:", same ? "はい" : "いいえ（90°回転・normalize 等で変形）");
  if (!same) {
    console.log("※ 最終 solutionPath は pickGrade2Bend6OrientedStage 適用後の座標系。");
  }
} else {
  console.log("\n※ lastGrade2Bend6Trace なし（このシードは折れ4、または取得漏れ）");
}
