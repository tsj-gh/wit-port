import * as THREE from "three";

/** 板目（Itame）風アルベドの基調 */
const BR = 210;
const BG = 180;
const BB = 140;
const DR = 118;
const DG = 84;
const DB = 56;

function hashUnit(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix + seed, 0x1a85ec53) ^ Math.imul(iy + (seed << 3), 0x7f4a7c15);
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), 61);
  return (n >>> 0) / 4294967296;
}

/** 格子値の双線形補間による滑らかな 2D ノイズ（簡易 Perlin 系） */
function smoothValueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xf = x - x0;
  const yf = y - y0;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hashUnit(x0, y0, seed);
  const b = hashUnit(x0 + 1, y0, seed);
  const c = hashUnit(x0, y0 + 1, seed);
  const d = hashUnit(x0 + 1, y0 + 1, seed);
  const xb = a + u * (b - a);
  const xc = c + u * (d - c);
  return xb + v * (xc - xb);
}

function fbm(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * smoothValueNoise(x * freq + seed * 0.01 * i, y * freq + seed * 0.02 * i, seed + i * 17);
    norm += amp;
    amp *= 0.52;
    freq *= 2.05;
  }
  return sum / norm;
}

/**
 * 外部画像なし：全ピクセルを疑似ノイズ＋ sin で「板目」風の流れを計算。
 * 線の重ね描きは行わない。
 */
export function createWoodTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("createWoodTexture: 2d context unavailable");
  }

  const seed = (Math.random() * 0x7fffffff) | 0;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      /** Y 方向のスケールを X より小さくし、縦に長く流れる板目の基調ノイズ */
      const nFlow = fbm(x * 0.11 + seed * 0.001, y * 0.0065 + seed * 0.002, seed, 3);
      const nFine = fbm(x * 0.22, y * 0.018, seed + 101, 2) * 0.22;

      const wobble = (nFlow - 0.5) * 2;
      const stripArg = x * 0.088 + wobble * 11 + nFine * 7 + y * 0.0065;
      let v = Math.sin(stripArg) * 0.5 + 0.5;
      v = 0.44 + v * 0.14;

      const r = BR + (DR - BR) * v;
      const g = BG + (DG - BG) * v;
      const b = BB + (DB - BB) * v;
      const i = (y * size + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }

  /** 極めて薄い横方向の導管っぽいドット */
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h = hashUnit(x, y, seed + 999);
      if (h < 0.0035) {
        const i = (y * size + x) * 4;
        const k = 0.94 + h * 0.04;
        d[i] *= k;
        d[i + 1] *= k;
        d[i + 2] *= k * 0.98;
      }
    }
  }

  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.offset.set(Math.random(), Math.random());
  tex.repeat.set(0.9 + Math.random() * 0.45, 0.9 + Math.random() * 0.45);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function setWoodTextureMaxAnisotropy(texture: THREE.Texture, renderer: THREE.WebGLRenderer): void {
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;
}
