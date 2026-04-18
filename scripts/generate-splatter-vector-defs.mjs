/**
 * Regenerates `src/components/lab/splatter/splatterVectorDefs.ts` from
 * `public/assets/tap-coloring/Splatter/SVG/splatter_XX.svg`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "../public/assets/tap-coloring/Splatter/SVG");
const outDir = path.join(__dirname, "../src/components/lab/splatter");
const out = path.join(outDir, "splatterVectorDefs.ts");
fs.mkdirSync(outDir, { recursive: true });

const defs = [];
for (let i = 1; i <= 9; i++) {
  const code = String(i).padStart(2, "0");
  const s = fs.readFileSync(path.join(dir, `splatter_${code}.svg`), "utf8");
  const wh = s.match(/width="(\d+)px"\s+height="(\d+)px"/);
  const w = wh ? +wh[1] : 100;
  const h = wh ? +wh[2] : 100;
  const paths = [...s.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  defs.push({ id: i, w, h, paths });
}

const header = `/**
 * Vector splatter shapes extracted from \`public/assets/tap-coloring/Splatter/SVG/\`.
 * Regenerate: \`node scripts/generate-splatter-vector-defs.mjs\`
 */
`;

const body = `export type SplatterVectorDef = {
  readonly id: number;
  readonly w: number;
  readonly h: number;
  /** SVG path \`d\` attributes (fill with evenodd, same as source SVG) */
  readonly paths: readonly string[];
};

export const SPLATTER_VECTOR_DEFS: readonly SplatterVectorDef[] = ${JSON.stringify(defs, null, 2)} as const;
`;

fs.writeFileSync(out, header + body, "utf8");
console.log("Wrote", out);
