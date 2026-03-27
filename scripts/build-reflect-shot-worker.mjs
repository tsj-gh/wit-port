import { build } from "esbuild";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [join(root, "src/workers/reflect-shot.worker.entry.ts")],
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2017",
  outfile: join(root, "public/workers/reflect-shot-worker.js"),
  logLevel: "info",
});
