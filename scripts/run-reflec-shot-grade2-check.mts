/**
 * Grade2 生成の仕様チェック（約30試行）
 * 実行: npx --yes tsx scripts/run-reflec-shot-grade2-check.mts
 */
import {
  fallbackGridStage,
  generateGridStage,
} from "../src/app/lab/reflec-shot/gridStageGen";
import * as GT from "../src/app/lab/reflec-shot/gridTypes";

const { DIR, dirsEqual, keyCell, unitOrthoDirBetween } = GT;
type CellCoord = GT.CellCoord;

function unitStepDir(dc: number, dr: number) {
  if (!((Math.abs(dc) === 1 && dr === 0) || (dc === 0 && Math.abs(dr) === 1))) return null;
  return GT.gridDeltaToScreenDir({ dx: dc, dy: dr });
}

function orthogonalDirs(a: { dx: number; dy: number }, b: { dx: number; dy: number }) {
  return a.dx * b.dx + a.dy * b.dy === 0 && a.dx * a.dx + a.dy * a.dy === 1 && b.dx * b.dx + b.dy * b.dy === 1;
}

function countRightAngles(path: CellCoord[]) {
  let n = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const d0 = unitStepDir(path[i]!.c - path[i - 1]!.c, path[i]!.r - path[i - 1]!.r);
    const d1 = unitStepDir(path[i + 1]!.c - path[i]!.c, path[i + 1]!.r - path[i]!.r);
    if (d0 && d1 && orthogonalDirs(d0, d1)) n++;
  }
  return n;
}

function pathFirstStepDir(path: CellCoord[]) {
  if (path.length < 2) return null;
  return unitStepDir(path[1]!.c - path[0]!.c, path[1]!.r - path[0]!.r);
}

function isStrictlyOutside(c: number, r: number, w: number, h: number) {
  return c < 0 || c >= w || r < 0 || r >= h;
}

function validateGrade2(st: ReturnType<typeof generateGridStage>, label: string) {
  if (!st) {
    console.error(label, "null stage");
    return false;
  }
  const path = st.solutionPath;
  const fs = pathFirstStepDir(path);
  const entry = unitOrthoDirBetween(st.startPad, st.start);
  if (!fs || !dirsEqual(fs, DIR.U)) {
    console.error(label, "first step not DIR.U", fs);
    return false;
  }
  if (!entry || !dirsEqual(entry, DIR.U)) {
    console.error(label, "startPad→start not DIR.U", entry);
    return false;
  }
  const prev = path[path.length - 2]!;
  const goal = path[path.length - 1]!;
  const dx = Math.sign(goal.c - prev.c);
  const dy = Math.sign(goal.r - prev.r);
  const expectedPad = { c: goal.c + dx, r: goal.r + dy };
  if (expectedPad.c !== st.goalPad.c || expectedPad.r !== st.goalPad.r) {
    console.error(label, "goalPad mismatch", expectedPad, st.goalPad);
    return false;
  }
  if (!isStrictlyOutside(st.goalPad.c, st.goalPad.r, st.width, st.height)) {
    console.error(label, "goalPad not strictly outside board");
    return false;
  }
  const bends = countRightAngles(path);
  if (st.bumpers.size !== bends) {
    console.error(label, "bumper count", st.bumpers.size, "!= bends", bends);
    return false;
  }
  const sk = keyCell(st.start.c, st.start.r);
  const gk = keyCell(st.goal.c, st.goal.r);
  if (st.bumpers.has(sk) || st.bumpers.has(gk)) {
    console.error(label, "bumper on start or goal");
    return false;
  }
  return true;
}

let ok = true;
ok = validateGrade2(fallbackGridStage(2, 0), "fallback(2,0)") && ok;

let genOk = 0;
for (let i = 0; i < 30; i++) {
  const st = generateGridStage(2, (i + 1) * 999983);
  if (!st) continue;
  if (validateGrade2(st, `gen seed ${(i + 1) * 999983}`)) genOk++;
  else ok = false;
}
console.log("Grade2 generateGridStage valid trials:", genOk, "/ 30");

if (!ok) process.exit(1);
console.log("All checks passed.");
