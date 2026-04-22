import * as THREE from "three";
import { setWoodTextureMaxAnisotropy } from "@/lib/hidden-stack/createWoodTexture";

/** Dark Walnut 01〜03 → Light Oak 01〜03（`TextureLoader` 一括ロード順） */
export const EXTERNAL_WOOD_TEXTURE_PATHS = [
  "/textures/texture_wood_darkwalnut_01.jpg",
  "/textures/texture_wood_darkwalnut_02.jpg",
  "/textures/texture_wood_darkwalnut_03.jpg",
  "/textures/texture_wood_lightoak_01.jpg",
  "/textures/texture_wood_lightoak_02.jpg",
  "/textures/texture_wood_lightoak_03.jpg",
] as const;

export type ExternalWoodTextureIndex = 0 | 1 | 2 | 3 | 4 | 5;

export const EXTERNAL_WOOD_TEXTURE_COUNT = EXTERNAL_WOOD_TEXTURE_PATHS.length;

const DEFAULT_UV_EDGE_GUARD = 0.012;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * RepeatWrapping 時に端またぎが起きにくい offset を作る。
 * repeat が小さいほど端を踏みやすいため、guard を残して内側のみ使う。
 */
export function safeOffsetForRepeat(random01: number, repeatScale: number, guard = DEFAULT_UV_EDGE_GUARD): number {
  const r = Math.max(1e-4, Math.min(1, repeatScale));
  const maxOffset = 1 - r;
  if (maxOffset <= 0) return 0;
  const edge = Math.min(Math.max(guard, 0), maxOffset * 0.5);
  const span = maxOffset - edge * 2;
  if (span <= 1e-6) return maxOffset * 0.5;
  return edge + clamp01(random01) * span;
}

/**
 * 共有ベーステクスチャをクローンし、メッシュごとに UV オフセット・90°単位回転を付与する。
 *（`map.offset` / `rotation` は Texture 単位のため clone が必須）
 */
export function cloneExternalWoodTextureForMesh(
  base: THREE.Texture,
  offsetU: number,
  offsetV: number,
  rotationQuarters: number,
  repeatScale: number,
  gl: THREE.WebGLRenderer
): THREE.Texture {
  const tex = base.clone();
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatScale, repeatScale);
  tex.center.set(0.5, 0.5);
  tex.rotation = (Math.PI / 2) * Math.floor(rotationQuarters % 4);
  tex.offset.set(safeOffsetForRepeat(offsetU, repeatScale), safeOffsetForRepeat(offsetV, repeatScale));
  setWoodTextureMaxAnisotropy(tex, gl);
  tex.needsUpdate = true;
  return tex;
}
