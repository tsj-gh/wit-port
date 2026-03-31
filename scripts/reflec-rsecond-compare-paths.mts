import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const grid = await import(pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridStageGen.ts")).href);
const { generateGridStage } = grid;
function sig(s: number) {
  const st = generateGridStage(5, s >>> 0, { lv4GenMode: "rSecond" });
  return st ? st.solutionPath.map((x) => `${x.c},${x.r}`).join("|") : "";
}
const a = sig(1);
const b = sig(30);
const c = sig(100);
console.log("1===30", a === b, "len", a.length);
console.log("1===100", a === c);
console.log("path1", a);
console.log("path30", b);
console.log("path100", c);
