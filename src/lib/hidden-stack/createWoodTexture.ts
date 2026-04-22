import * as THREE from "three";

const WOOD_BASE_FILL = "#d2b48c";

/** ベースより少し濃い茶系のストローク色 */
function randomGrainStroke(): string {
  const r = 88 + Math.floor(Math.random() * 70);
  const g = 58 + Math.floor(Math.random() * 55);
  const b = 32 + Math.floor(Math.random() * 48);
  const a = 0.1 + Math.random() * 0.28;
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * 外部画像なしで Canvas 2D から木目風アルベドを生成する。
 * 呼び出しごとに異なるパターン（ブロック専用テクスチャ用）。
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

  const strokeCount = Math.floor(size * 1.25 + Math.random() * size * 0.6);

  for (let i = 0; i < strokeCount; i++) {
    ctx.strokeStyle = randomGrainStroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 0.4 + Math.random() * 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const alongY = Math.random() > 0.12;
    const steps = 5 + Math.floor(Math.random() * 16);
    const wobbleFreq = 0.035 + Math.random() * 0.055;
    const wobbleAmp = 2.5 + Math.random() * (size * 0.07);
    const phase = Math.random() * Math.PI * 2;

    ctx.beginPath();
    if (alongY) {
      const x0 = Math.random() * size;
      for (let s = 0; s <= steps; s++) {
        const y = (s / steps) * size;
        const x = x0 + Math.sin(y * wobbleFreq + phase) * wobbleAmp + (Math.random() - 0.5) * 1.5;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      const y0 = Math.random() * size;
      for (let s = 0; s <= steps; s++) {
        const x = (s / steps) * size;
        const y = y0 + Math.cos(x * wobbleFreq + phase) * wobbleAmp * 0.85 + (Math.random() - 0.5) * 1.5;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
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
