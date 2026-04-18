"use client";

import type { SVGProps } from "react";
import { SPLATTER_VECTOR_DEFS } from "./splatterVectorDefs";

export type SplatterSvgVariant = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type SplatterSvgProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "children"> & {
  variant: SplatterSvgVariant;
};

/**
 * Lightweight SVG view of one splatter variant (path data from {@link SPLATTER_VECTOR_DEFS}).
 * Use `fill="currentColor"` via className for themed previews; canvas paint uses {@link rasterizeSplatterVectorDef}.
 */
export function SplatterSvg({ variant, className, ...rest }: SplatterSvgProps) {
  const def = SPLATTER_VECTOR_DEFS[variant - 1];
  if (!def) return null;
  const vb = `0 0 ${def.w} ${def.h}`;
  return (
    <svg
      viewBox={vb}
      width={def.w}
      height={def.h}
      className={className}
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden
      {...rest}
    >
      {def.paths.map((d, i) => (
        <path key={i} d={d} fill="currentColor" fillRule="evenodd" />
      ))}
    </svg>
  );
}
