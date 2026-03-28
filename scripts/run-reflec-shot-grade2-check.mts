/**
 * Grade2 生成の仕様チェック（約30試行）
 * 実行: npx --yes tsx scripts/run-reflec-shot-grade2-check.mts
 *
 * `import.meta.url` 基準で `src` を解決する（tsx の実行時パス差で `../src` がずれるのを避ける）
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gridStageGen = await import(
  pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridStageGen.ts")).href
);
const { fallbackGridStage, generateGridStage, totalDiagonalTurnCount } = gridStageGen;
const GT = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridTypes.ts")).href);

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
  if (!fs) {
    console.error(label, "first step undefined");
    return false;
  }
  if (!entry || !dirsEqual(entry, DIR.U)) {
    console.error(label, "startPad→start not DIR.U", entry);
    return false;
  }
  const prev = path[path.length - 2]!;
  const goal = path[path.length - 1]!;
  const bends = countRightAngles(path);
  const sk = keyCell(st.start.c, st.start.r);
  const gk = keyCell(st.goal.c, st.goal.r);
  const fixedPad = { c: goal.c, r: goal.r - 1 };
  const extPad = {
    c: goal.c + Math.sign(goal.c - prev.c),
    r: goal.r + Math.sign(goal.r - prev.r),
  };
  const coheresFixed =
    st.goalPad.c === fixedPad.c && st.goalPad.r === fixedPad.r;
  const coheresExt = st.goalPad.c === extPad.c && st.goalPad.r === extPad.r;
  if (!coheresFixed && !coheresExt) {
    console.error(label, "goalPad mismatch", { fixedPad, extPad }, st.goalPad);
    return false;
  }
  /** 延長パッドのみ → 折れ4。真上のみ → 折れ6。真上＝延長が同座標のときは折れ数・端点バンパーで判別 */
  let bend6Like: boolean;
  if (coheresExt && !coheresFixed) bend6Like = false;
  else if (coheresFixed && !coheresExt) bend6Like = true;
  else
    bend6Like =
      bends >= 6 ||
      st.bumpers.has(sk) ||
      st.bumpers.has(gk) ||
      st.bumpers.size !== bends;
  if (!isStrictlyOutside(st.goalPad.c, st.goalPad.r, st.width, st.height)) {
    console.error(label, "goalPad not strictly outside board");
    return false;
  }
  if (bend6Like) {
    if (bends < 6 || bends > 8) {
      console.error(label, "bend count for bend6 expects 6..8", bends);
      return false;
    }
    const exp = totalDiagonalTurnCount(path, st.startPad, st.goalPad);
    if (st.bumpers.size !== exp) {
      console.error(label, "bumper count", st.bumpers.size, "!= totalDiagonalTurnCount", exp);
      return false;
    }
  } else {
    if (!dirsEqual(fs, DIR.U)) {
      console.error(label, "first step not DIR.U", fs);
      return false;
    }
    if (st.bumpers.size !== bends) {
      console.error(label, "bumper count", st.bumpers.size, "!= bends", bends);
      return false;
    }
    if (st.bumpers.has(sk) || st.bumpers.has(gk)) {
      console.error(label, "bumper on start or goal");
      return false;
    }
  }
  return true;
}

let ok = true;
ok = validateGrade2(fallbackGridStage(3, 0), "fallback(3,0)") && ok;
ok = validateGrade2(fallbackGridStage(4, 0), "fallback(4,0)") && ok;

let genOk3 = 0;
let genOk4 = 0;
for (let i = 0; i < 30; i++) {
  const seed = (i + 1) * 999983;
  const st3 = generateGridStage(3, seed);
  if (st3 && validateGrade2(st3, `G3 seed ${seed}`)) genOk3++;
  else if (st3) ok = false;
  const st4 = generateGridStage(4, seed);
  if (st4 && validateGrade2(st4, `G4 seed ${seed}`)) genOk4++;
  else if (st4) ok = false;
}
console.log("Grade3 (Lv.2) generateGridStage valid trials:", genOk3, "/ 30");
console.log("Grade4 (Lv.3) generateGridStage valid trials:", genOk4, "/ 30");

if (!ok) process.exit(1);
console.log("All checks passed.");
