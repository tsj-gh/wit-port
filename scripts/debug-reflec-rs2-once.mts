/**
 * 一回限り: rs2 ハッシュから Grade2 盤の端点・パッドを表示
 * npx --yes tsx scripts/debug-reflec-rs2-once.mts
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { parseReflecHash } = await import(
  pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/reflecShotStageHash.ts")).href
);
const grid = await import(
  pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridStageGen.ts")).href
);
const raw = "rs2.2.3bb3e6ed";
const parsed = parseReflecHash(raw);
if (!parsed || parsed.kind !== "rs2") throw new Error("parse");
const { grade, seed } = parsed;

const { generateGridStageWithFallback, totalDiagonalTurnCount } = grid;

const st = generateGridStageWithFallback(grade, seed);
const path = st.solutionPath;
let bends = 0;
for (let i = 1; i < path.length - 1; i++) {
  const dc0 = path[i]!.c - path[i - 1]!.c;
  const dr0 = path[i]!.r - path[i - 1]!.r;
  const dc1 = path[i + 1]!.c - path[i]!.c;
  const dr1 = path[i + 1]!.r - path[i]!.r;
  const orth =
    (Math.abs(dc0) === 1 && dr0 === 0 && dc1 === 0 && Math.abs(dr1) === 1) ||
    (dc0 === 0 && Math.abs(dr0) === 1 && Math.abs(dc1) === 1 && dr1 === 0);
  if (orth) bends++;
}
const prev = path[path.length - 2]!;
const goal = path[path.length - 1]!;
const computedGoalPad = {
  c: goal.c + Math.sign(goal.c - prev.c),
  r: goal.r + Math.sign(goal.r - prev.r),
};

console.log("hash:", raw);
console.log("parsed grade:", grade, "seed:", seed, "(0x" + seed.toString(16) + ")");
console.log("board:", st.width, "x", st.height, "grade2PadAdjust:", st.grade2PadAdjustLabel ?? "(none)");
console.log("startPad:", st.startPad, "start:", st.start);
console.log("goal:", st.goal, "goalPad:", st.goalPad);
console.log("goalPad matches prev→goal extension:", computedGoalPad.c === st.goalPad.c && computedGoalPad.r === st.goalPad.r);
const expBump = totalDiagonalTurnCount(path, st.startPad, st.goalPad);
console.log("bends (interior right angles):", bends, "bumpers:", st.bumpers.size, "totalDiagonalTurnCount:", expBump);
if (path.length <= 24) console.log("solutionPath:", path);
else console.log("solutionPath length:", path.length);
