/**
 * rs2.4.7c597d85 + デバッグ相当オプションで (1,0) が BACKSLASH かつ solution でシミュがゴールするか検証
 * npx --yes tsx scripts/verify-reflec-rs2-swapfix.mts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const grid = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridStageGen.ts")).href);
const { applyBumper } = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/bumperRules.ts")).href);
const gt = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridTypes.ts")).href);
const { addCell, keyCell, unitOrthoDirBetween } = gt;

const seed = 0x7c597d85 >>> 0;
const st = grid.generateGridStageWithFallback(4, seed, {
  grade2Bend6TotalBends: 7,
  debugReflecShotConsole: true,
});

const k10 = keyCell(1, 0);
const sol = st.bumpers.get(k10)?.solution;
if (sol !== "BACKSLASH") {
  console.error("FAIL: (1,0) solution expected BACKSLASH got", sol);
  process.exit(1);
}

let B = { ...st.startPad };
let incoming = unitOrthoDirBetween(st.startPad, st.start)!;
for (let step = 0; step < 600; step++) {
  if (B.c === st.goalPad.c && B.r === st.goalPad.r) {
    console.log("OK: (1,0)=", sol, "sim reached goalPad in", step, "steps");
    process.exit(0);
  }
  let dOut = incoming;
  const bump = st.bumpers.get(keyCell(B.c, B.r));
  if (bump) dOut = applyBumper(incoming, bump.solution);
  const next = addCell(B, dOut);
  const agent =
    (next.c === st.goalPad.c && next.r === st.goalPad.r) ||
    (next.c === st.startPad.c && next.r === st.startPad.r) ||
    (next.c >= 0 &&
      next.c < st.width &&
      next.r >= 0 &&
      next.r < st.height &&
      !!st.pathable[next.c]![next.r]);
  if (!agent) {
    console.error("FAIL: lost at", next, "step", step);
    process.exit(1);
  }
  B = next;
  incoming = dOut;
}
console.error("FAIL: timeout");
process.exit(1);
