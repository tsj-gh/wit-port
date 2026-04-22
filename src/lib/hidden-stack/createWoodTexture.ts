import * as THREE from "three";

/** 3 色ブレンド（ベース → 中間 → 濃い茶） */
const C0 = { r: 210, g: 180, b: 140 };
const C1 = { r: 186, g: 156, b: 118 };
const C2 = { r: 102, g: 72, b: 50 };

const LACUNARITY = [1, 2.1, 4.3] as const;
const OCTAVE_GAIN = 0.48;

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function hashUnit(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix + seed, 0x1a85ec53) ^ Math.imul(iy + (seed << 3), 0x7f4a7c15);
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), 61);
  return (n >>> 0) / 4294967296;
}

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

/**
 * 3 オクターブ・周波数比 1 : 2.1 : 4.3 の fBm（Y を細かくし縦長の流れを維持）
 */
function fbmWood(x: number, y: number, seed: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let i = 0; i < 3; i++) {
    const f = LACUNARITY[i];
    sum +=
      amp *
      smoothValueNoise(x * 0.11 * f + seed * 0.012 * i, y * 0.0066 * f + seed * 0.019 * i, seed + i * 83);
    norm += amp;
    amp *= OCTAVE_GAIN;
  }
  return sum / norm;
}

function lerp3(t: number): { r: number; g: number; b: number } {
  const u = THREE.MathUtils.clamp(0.42 + (t - 0.5) * 0.26, 0, 1);
  if (u <= 0.5) {
    const k = u * 2;
    const kk = k * k * (3 - 2 * k);
    return {
      r: C0.r + (C1.r - C0.r) * kk,
      g: C0.g + (C1.g - C0.g) * kk,
      b: C0.b + (C1.b - C0.b) * kk,
    };
  }
  const k = (u - 0.5) * 2;
  const kk = k * k * (3 - 2 * k);
  return {
    r: C1.r + (C2.r - C1.r) * kk,
    g: C1.g + (C2.g - C1.g) * kk,
    b: C1.b + (C2.b - C1.b) * kk,
  };
}

/**
 * 全ピクセル計算の板目風アルベド。線描画なし。
 * 仕上げに横方向の微ノイズ（導管感）を alpha 相当で重ねる。
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
      const nFlow = fbmWood(x + seed * 0.001, y + seed * 0.002, seed);
      const nGrain = fbmWood(x * 1.15 + 17, y * 1.05 + 23, seed + 911);
      const wobble = (nFlow - 0.5) * 2;
      const stripArg = x * 0.086 + wobble * 12.5 + (nGrain - 0.5) * 6.2 + y * 0.0062;
      let band = Math.sin(stripArg) * 0.5 + 0.5;
      const t = band * 0.58 + nFlow * 0.42;
      const { r, g, b } = lerp3(t);
      const i = (y * size + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }

  /** 横方向の極薄ノイズ（導管 / ブラッシング）。重ね合わせ強度 ~0.05 */
  const brushSeed = seed + 2027;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = smoothValueNoise(x * 0.9 + brushSeed * 0.01, y * 0.028 + x * 0.002, brushSeed);
      const ny = smoothValueNoise(x * 0.14, y * 0.55 + brushSeed * 0.02, brushSeed + 3);
      const micro = ((nx - 0.5) * 0.65 + (ny - 0.5) * 0.35) * 0.05 * 55;
      const i = (y * size + x) * 4;
      d[i] = clamp255(d[i] + micro);
      d[i + 1] = clamp255(d[i + 1] + micro * 0.96);
      d[i + 2] = clamp255(d[i + 2] + micro * 0.92);
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
