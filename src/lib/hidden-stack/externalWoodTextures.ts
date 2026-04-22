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

/**
 * 共有ベーステクスチャをクローンし、メッシュごとに UV オフセット・90°単位回転を付与する。
 *（`map.offset` / `rotation` は Texture 単位のため clone が必須）
 */
export function cloneExternalWoodTextureForMesh(
  base: THREE.Texture,
  offsetU: number,
  offsetV: number,
  rotationQuarters: number,
  gl: THREE.WebGLRenderer
): THREE.Texture {
  const tex = base.clone();
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.center.set(0.5, 0.5);
  tex.rotation = (Math.PI / 2) * Math.floor(rotationQuarters % 4);
  tex.offset.set(offsetU, offsetV);
  setWoodTextureMaxAnisotropy(tex, gl);
  tex.needsUpdate = true;
  return tex;
}
