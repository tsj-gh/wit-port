import * as THREE from "three";

const WOOD_BASE_FILL = "#d2b48c";

type Knot = { x: number; y: number; rx: number; ry: number };

function knotDeflectX(x: number, y: number, knots: readonly Knot[]): number {
  let xOut = x;
  for (const k of knots) {
    const nx = (xOut - k.x) / Math.max(k.rx, 1e-3);
    const ny = (y - k.y) / Math.max(k.ry, 1e-3);
    const d2 = nx * nx + ny * ny;
    if (d2 < 1.15) {
      const w = 1 - d2 / 1.15;
      const push = w * w * k.rx * 0.55;
      xOut += Math.sign(nx || 0.001) * push;
    }
  }
  return xOut;
}

/**
 * Canvas 2D で「流れる」木目アルベドを生成（外部画像なし）。
 * 太い主筋＋節＋茶の重ね染め＋横方向の微ノイズ。
 */
export function createWoodTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("createWoodTexture: 2d context unavailable");
  }

  ctx.fillStyle = WOOD_BASE_FILL;
  ctx.fillRect(0, 0, size, size);

  const knots: Knot[] = [];
  const knotCount = 1 + Math.floor(Math.random() * 3);
  for (let k = 0; k < knotCount; k++) {
    knots.push({
      x: size * (0.15 + Math.random() * 0.7),
      y: size * (0.12 + Math.random() * 0.76),
      rx: size * (0.04 + Math.random() * 0.05),
      ry: size * (0.028 + Math.random() * 0.04),
    });
  }

  ctx.save();
  for (const k of knots) {
    ctx.beginPath();
    ctx.ellipse(k.x, k.y, k.rx, k.ry, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(101, 67, 33, 0.14)";
    ctx.fill();
  }
  ctx.restore();

  const flowCount = 6 + Math.floor(Math.random() * 5);
  const phase = Math.random() * Math.PI * 2;

  for (let r = 0; r < flowCount; r++) {
    const tFrac = flowCount > 1 ? r / (flowCount - 1) : 0.5;
    const xBase = size * (0.1 + tFrac * 0.8) + (Math.random() - 0.5) * size * 0.08;
    const sway = size * (0.1 + Math.random() * 0.16);

    const y1 = size * 0.32;
    const y2 = size * 0.64;
    const rawX1 = xBase + Math.sin(phase + r * 0.9) * sway;
    const rawX2 = xBase - Math.sin(phase * 0.7 + r * 1.1) * sway * 0.9;
    const x0 = knotDeflectX(xBase + (Math.random() - 0.5) * size * 0.02, 0, knots);
    const cx1 = knotDeflectX(rawX1, y1, knots);
    const cy1 = y1;
    const cx2 = knotDeflectX(rawX2, y2, knots);
    const cy2 = y2;
    const x3 = knotDeflectX(xBase + Math.sin(phase + r) * sway * 0.35, size, knots);

    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x3, size);

    ctx.strokeStyle = `rgba(${58 + Math.floor(Math.random() * 48)}, ${36 + Math.floor(Math.random() * 38)}, ${20 + Math.floor(Math.random() * 30)}, ${0.26 + Math.random() * 0.22})`;
    ctx.lineWidth = 6 + Math.random() * 11;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 1;
    ctx.stroke();
  }

  const wispCount = 2 + Math.floor(Math.random() * 2);
  for (let w = 0; w < wispCount; w++) {
    const xAnchor = Math.random() * size;
    const waveAmp = size * (0.03 + Math.random() * 0.05);
    const waveFreq = (2.2 + Math.random() * 2) / size;
    const pts = 28 + Math.floor(Math.random() * 16);
    ctx.beginPath();
    for (let i = 0; i <= pts; i++) {
      const t = i / pts;
      const y = t * size;
      const wave = Math.sin(y * waveFreq * Math.PI * 2 + phase + w) * waveAmp;
      const x = knotDeflectX(xAnchor + wave * (0.4 + t * 0.6), y, knots);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${72 + Math.floor(Math.random() * 35)}, ${48 + Math.floor(Math.random() * 28)}, ${28 + Math.floor(Math.random() * 22)}, ${0.14 + Math.random() * 0.12})`;
    ctx.lineWidth = 3 + Math.random() * 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  const washLayers = 55 + Math.floor(Math.random() * 35);
  for (let w = 0; w < washLayers; w++) {
    ctx.globalAlpha = 0.045 + Math.random() * 0.055;
    ctx.fillStyle = "rgba(139, 69, 19, 0.12)";
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const rw = size * (0.08 + Math.random() * 0.22);
    const rh = size * (0.06 + Math.random() * 0.18);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw, rh, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let y = 0; y < size; y++) {
    const a = 0.012 + Math.random() * 0.018;
    ctx.fillStyle = `rgba(48, 40, 34, ${a})`;
    ctx.fillRect(0, y, size, 1);
  }

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
