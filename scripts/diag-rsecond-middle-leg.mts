/**
 * R-Second 中脚診断: `lv4RSecondMidDiag` の行を集計する。
 * 実行: npx --yes tsx scripts/diag-rsecond-middle-leg.mts [seed0 seed1 ...]
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gridStageGen = await import(
  pathToFileURL(join(__dirname, "../src/app/lab/reflec-shot/gridStageGen.ts")).href
);
const { generateGridStage } = gridStageGen;

function parseMidLine(line: string): Record<string, string | number | boolean> | null {
  if (line.startsWith("mid pick ")) {
    const m = line.match(
      /tryR=(\d+) split=([^ ]+) hasShort=(\w+) hasLong=(\w+) picked=(\w+)/
    );
    if (!m) return null;
    return {
      kind: "pick",
      tryR: Number(m[1]),
      split: m[2]!,
      hasShort: m[3] === "true",
      hasLong: m[4] === "true",
      picked: m[5]!,
    };
  }
  const mShort = line.match(
    /^mid short tryR=(\d+) split=([^ ]+) pass=(\d+) jp=(\w+) ok=(\w+) ft=(\d+) np=(\d+) ce=(\d+) fN=(\d+) fJ=(\d+)$/
  );
  if (mShort) {
    return {
      kind: "short",
      tryR: Number(mShort[1]),
      split: mShort[2]!,
      pass: Number(mShort[3]),
      jp: mShort[4]!,
      ok: mShort[5] === "true",
      ft: Number(mShort[6]),
      np: Number(mShort[7]),
      ce: Number(mShort[8]),
      fN: Number(mShort[9]),
      fJ: Number(mShort[10]),
    };
  }
  const mLong = line.match(
    /^mid long tryR=(\d+) lt=(\d+) split=([^ ]+) pass=(\d+) jp=(\w+) ok=(\w+) ft=(\d+) np=(\d+) ce=(\d+) fN=(\d+) fJ=(\d+)$/
  );
  if (mLong) {
    return {
      kind: "long",
      tryR: Number(mLong[1]),
      lt: Number(mLong[2]),
      split: mLong[3]!,
      pass: Number(mLong[4]),
      jp: mLong[5]!,
      ok: mLong[6] === "true",
      ft: Number(mLong[7]),
      np: Number(mLong[8]),
      ce: Number(mLong[9]),
      fN: Number(mLong[10]),
      fJ: Number(mLong[11]),
    };
  }
  return null;
}

function main() {
  const seeds =
    process.argv.length > 2
      ? process.argv.slice(2).map((s) => Number(s) >>> 0)
      : [0, 1, 2, 3, 4, 42, 99, 12345, 999_001];

  let totalShortOk = 0;
  let totalShortFail = 0;
  let totalLongOk = 0;
  let totalLongFail = 0;
  const jpShortOk = new Map<string, number>();
  const jpLongOk = new Map<string, number>();
  const pickHist = new Map<string, number>();
  let sumLongFailFJ = 0;
  let sumLongFailFN = 0;
  let longFailRows = 0;

  for (const seed of seeds) {
    const midDiag = { lines: [] as string[], maxLines: 12_000 };
    const st = generateGridStage(5, seed, {
      lv4GenMode: "rSecond",
      lv4RSecondMidDiag: midDiag,
    });
    console.log(`\n--- seed=${seed} stageOk=${st != null} midLines=${midDiag.lines.length}`);

    for (const line of midDiag.lines) {
      const p = parseMidLine(line);
      if (!p) continue;
      if (p.kind === "short") {
        if (p.ok) {
          totalShortOk++;
          jpShortOk.set(String(p.jp), (jpShortOk.get(String(p.jp)) ?? 0) + 1);
        } else totalShortFail++;
      } else if (p.kind === "long") {
        if (p.ok) {
          totalLongOk++;
          jpLongOk.set(String(p.jp), (jpLongOk.get(String(p.jp)) ?? 0) + 1);
        } else {
          totalLongFail++;
          sumLongFailFJ += Number(p.fJ);
          sumLongFailFN += Number(p.fN);
          longFailRows++;
        }
      } else if (p.kind === "pick") {
        pickHist.set(String(p.picked), (pickHist.get(String(p.picked)) ?? 0) + 1);
      }
    }

    const picks = midDiag.lines.filter((l) => l.startsWith("mid pick "));
    if (picks.length) console.log("  last picks:", picks.slice(-4).join(" | "));
    const longOkLines = midDiag.lines.filter((l) => l.startsWith("mid long ") && l.includes("ok=true"));
    if (longOkLines.length) console.log("  long ok samples:", longOkLines.slice(0, 3).join("\n    "));
  }

  console.log("\n=== aggregate (all seeds) ===");
  console.log(
    `short rows: ok=${totalShortOk} fail=${totalShortFail} | long rows: ok=${totalLongOk} fail=${totalLongFail}`
  );
  if (longFailRows)
    console.log(
      `long fail row avg fJ=${(sumLongFailFJ / longFailRows).toFixed(2)} fN=${(sumLongFailFN / longFailRows).toFixed(2)} (rows=${longFailRows})`
    );
  console.log("jp when short ok:", Object.fromEntries(jpShortOk));
  console.log("jp when long ok:", Object.fromEntries(jpLongOk));
  console.log("mid pick picked:", Object.fromEntries(pickHist));
}

main();
