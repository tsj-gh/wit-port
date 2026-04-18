import type { SplatterVectorDef } from "./splatterVectorDefs";

/**
 * Renders vector splatter paths to a canvas (black silhouette, transparent outside fill).
 * Used by tap-coloring paint pipeline; same pixel contract as the former PNG splatters.
 */
export function rasterizeSplatterVectorDef(def: SplatterVectorDef): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = def.w;
  c.height = def.h;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#000000";
  for (const d of def.paths) {
    try {
      const p = new Path2D(d);
      ctx.fill(p, "evenodd");
    } catch {
      /* skip invalid path segment */
    }
  }
  return c;
}
