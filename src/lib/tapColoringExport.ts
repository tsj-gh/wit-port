/**
 * Tap Coloring 用の高解像度エクスポート合成。
 * フレームの内枠を自動検出し、作品領域基準でロゴ・日付を配置する。
 */

export type TapColoringFrameVariant = "01" | "02" | "03";

export type TapColoringExportRect = { x: number; y: number; width: number; height: number };

export type TapColoringExportOptions = {
  frameVariant: TapColoringFrameVariant;
  includeFrame: boolean;
  includeDate: boolean;
  pictureScale: number;
  exportBackgroundColor: string;
  /** 作品領域に対するロゴ・日付の内側マージン率（0.03 = 3%） */
  overlayMarginPct: number;
};

const FRAME_PUBLIC = "/assets/tap-coloring/Frame";
const LOGO_SRC = "/assets/logo/logo_wispo.png";

export const FRAME_CONFIG: Record<
  TapColoringFrameVariant,
  {
    file: string;
    /** 検出失敗時の保険（横幅に対する内枠の左右余白率） */
    fallbackInsetXPct: number;
    /** 検出失敗時の保険（高さに対する内枠の上下余白率） */
    fallbackInsetYPct: number;
  }
> = {
  "01": { file: `${FRAME_PUBLIC}/frame_01.png`, fallbackInsetXPct: 0.15, fallbackInsetYPct: 0.15 },
  "02": { file: `${FRAME_PUBLIC}/frame_02.png`, fallbackInsetXPct: 0.16, fallbackInsetYPct: 0.16 },
  "03": { file: `${FRAME_PUBLIC}/frame_03.png`, fallbackInsetXPct: 0.145, fallbackInsetYPct: 0.145 },
};

export const EXPORT_SURFACE_PRESETS: readonly { id: string; label: string; color: string }[] = [
  { id: "white", label: "白", color: "#FFFFFF" },
  { id: "paper", label: "紙白", color: "#FDFDFD" },
  { id: "blackboard", label: "黒板", color: "#333333" },
  { id: "black", label: "黒", color: "#000000" },
  { id: "navy", label: "ネイビー", color: "#2C3E50" },
  { id: "sage", label: "セージ", color: "#8DA399" },
  { id: "saffron", label: "サフラン", color: "#F4D03F" },
  { id: "taupe", label: "トープ", color: "#D5CABD" },
] as const;

type FrameMeta = {
  image: HTMLImageElement;
  innerHole: TapColoringExportRect;
};

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const frameMetaCache = new Map<TapColoringFrameVariant, Promise<FrameMeta>>();

function loadImageCached(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(`failed to load ${src}`));
      im.src = src;
    });
    imageCache.set(src, p);
  }
  return p;
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return { r: 253, g: 253, b: 253 };
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relativeLuminanceFromHex(hex: string): number {
  const { r, g, b } = parseHexRgb(hex);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function pickExportUiStyle(bgHex: string): { invertLogo: boolean; dateFill: string } {
  const lum = relativeLuminanceFromHex(bgHex);
  if (lum < 0.48) return { invertLogo: true, dateFill: "rgba(255, 255, 255, 0.95)" };
  return { invertLogo: false, dateFill: "rgba(28, 28, 28, 0.9)" };
}

function formatExportDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function fallbackInnerHole(variant: TapColoringFrameVariant, w: number, h: number): TapColoringExportRect {
  const cfg = FRAME_CONFIG[variant];
  const ix = Math.round(w * cfg.fallbackInsetXPct);
  const iy = Math.round(h * cfg.fallbackInsetYPct);
  return {
    x: ix,
    y: iy,
    width: Math.max(1, w - ix * 2),
    height: Math.max(1, h - iy * 2),
  };
}

function detectInnerHoleFromFrame(
  variant: TapColoringFrameVariant,
  image: HTMLImageElement,
): TapColoringExportRect {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  if (w < 4 || h < 4) return fallbackInnerHole(variant, Math.max(4, w), Math.max(4, h));

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return fallbackInnerHole(variant, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  const isTransparent = (x: number, y: number): boolean => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    const i = (y * w + x) * 4;
    return data[i + 3]! <= 16;
  };

  // まず中心近傍から透明ピクセルを探索（内枠空洞のシード想定）
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  let sx = -1;
  let sy = -1;
  const maxR = Math.max(cx, cy);
  for (let r = 0; r <= maxR; r++) {
    const x0 = Math.max(0, cx - r);
    const x1 = Math.min(w - 1, cx + r);
    const y0 = Math.max(0, cy - r);
    const y1 = Math.min(h - 1, cy + r);
    for (let x = x0; x <= x1; x++) {
      if (isTransparent(x, y0)) {
        sx = x;
        sy = y0;
        break;
      }
      if (isTransparent(x, y1)) {
        sx = x;
        sy = y1;
        break;
      }
    }
    if (sx >= 0) break;
    for (let y = y0 + 1; y < y1; y++) {
      if (isTransparent(x0, y)) {
        sx = x0;
        sy = y;
        break;
      }
      if (isTransparent(x1, y)) {
        sx = x1;
        sy = y;
        break;
      }
    }
    if (sx >= 0) break;
  }
  if (sx < 0 || sy < 0) return fallbackInnerHole(variant, w, h);

  const visited = new Uint8Array(w * h);
  const qx: number[] = [sx];
  const qy: number[] = [sy];
  let head = 0;
  let minX = sx;
  let minY = sy;
  let maxX = sx;
  let maxY = sy;
  let count = 0;
  while (head < qx.length) {
    const x = qx[head]!;
    const y = qy[head]!;
    head++;
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    const vi = y * w + x;
    if (visited[vi]) continue;
    if (!isTransparent(x, y)) continue;
    visited[vi] = 1;
    count++;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    qx.push(x + 1, x - 1, x, x);
    qy.push(y, y, y + 1, y - 1);
  }

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const tooSmall = bw < w * 0.25 || bh < h * 0.25 || count < (w * h * 0.08);
  const touchesEdge = minX <= 0 || minY <= 0 || maxX >= w - 1 || maxY >= h - 1;
  if (tooSmall || touchesEdge) return fallbackInnerHole(variant, w, h);

  return { x: minX, y: minY, width: bw, height: bh };
}

async function loadFrameMeta(variant: TapColoringFrameVariant): Promise<FrameMeta> {
  let p = frameMetaCache.get(variant);
  if (!p) {
    const cfg = FRAME_CONFIG[variant];
    p = loadImageCached(cfg.file).then((image) => ({
      image,
      innerHole: detectInnerHoleFromFrame(variant, image),
    }));
    frameMetaCache.set(variant, p);
  }
  return p;
}

/** (0,0) から連結する外側白のみを背景色へ置換（内側白は保持） */
function floodFillOutsideToBg(
  imageData: ImageData,
  width: number,
  height: number,
  bg: { r: number; g: number; b: number },
): void {
  const d = imageData.data;
  const idx = (x: number, y: number) => (y * width + x) * 4;
  const sr = d[0]!;
  const sg = d[1]!;
  const sb = d[2]!;
  const seedTolerance = 28;

  const fillable = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const i = idx(x, y);
    const a = d[i + 3]!;
    if (a < 12) return false;
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    const diffSeed = Math.abs(r - sr) + Math.abs(g - sg) + Math.abs(b - sb);
    if (diffSeed <= seedTolerance) return true;
    if (r >= 248 && g >= 248 && b >= 248) return true;
    return false;
  };

  const visited = new Uint8Array(width * height);
  const qx: number[] = [0];
  const qy: number[] = [0];
  let head = 0;
  while (head < qx.length) {
    const x = qx[head]!;
    const y = qy[head]!;
    head++;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const vi = y * width + x;
    if (visited[vi]) continue;
    if (!fillable(x, y)) continue;
    visited[vi] = 1;
    const i = idx(x, y);
    d[i] = bg.r;
    d[i + 1] = bg.g;
    d[i + 2] = bg.b;
    d[i + 3] = 255;
    qx.push(x + 1, x - 1, x, x);
    qy.push(y, y, y + 1, y - 1);
  }
}

function prepareArtWithFloodFill(
  artSource: CanvasImageSource,
  sidePx: number,
  bgHex: string,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sidePx));
  c.height = Math.max(1, Math.round(sidePx));
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(artSource, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  floodFillOutsideToBg(data, c.width, c.height, parseHexRgb(bgHex));
  ctx.putImageData(data, 0, 0);
  return c;
}

type AnchorId = "BR" | "TR" | "RM";

function scoreAnchor(
  ctx: CanvasRenderingContext2D,
  hole: TapColoringExportRect,
  blockW: number,
  blockH: number,
  pad: number,
  anchor: AnchorId,
  bg: { r: number; g: number; b: number },
): number {
  const { x: ix, y: iy, width: iw, height: ih } = hole;
  let bx = 0;
  let by = 0;
  if (anchor === "BR") {
    bx = ix + iw - pad - blockW;
    by = iy + ih - pad - blockH;
  } else if (anchor === "TR") {
    bx = ix + iw - pad - blockW;
    by = iy + pad;
  } else {
    bx = ix + iw - pad - blockW;
    by = iy + ih / 2 - blockH / 2;
  }
  const rx = Math.max(0, Math.floor(bx));
  const ry = Math.max(0, Math.floor(by));
  const rw = Math.max(1, Math.min(ctx.canvas.width - rx, Math.ceil(blockW)));
  const rh = Math.max(1, Math.min(ctx.canvas.height - ry, Math.ceil(blockH)));
  const region = ctx.getImageData(rx, ry, rw, rh);
  const d = region.data;
  let hit = 0;
  let total = 0;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]!;
    if (a < 40) continue;
    total++;
    const diff = Math.abs(d[i]! - bg.r) + Math.abs(d[i + 1]! - bg.g) + Math.abs(d[i + 2]! - bg.b);
    if (diff > 44) hit++;
  }
  return total > 0 ? hit / total : 0;
}

function layoutOverlay(
  hole: TapColoringExportRect,
  blockW: number,
  blockH: number,
  pad: number,
  anchor: AnchorId,
): { x: number; y: number } {
  const { x: ix, y: iy, width: iw, height: ih } = hole;
  if (anchor === "BR") return { x: ix + iw - pad - blockW, y: iy + ih - pad - blockH };
  if (anchor === "TR") return { x: ix + iw - pad - blockW, y: iy + pad };
  return { x: ix + iw - pad - blockW, y: iy + ih / 2 - blockH / 2 };
}

export async function composeTapColoringExport(
  artSource: CanvasImageSource,
  options: TapColoringExportOptions,
): Promise<string> {
  const meta = await loadFrameMeta(options.frameVariant);
  const frame = meta.image;
  const W = frame.naturalWidth;
  const H = frame.naturalHeight;
  if (W < 2 || H < 2) throw new Error("invalid frame dimensions");

  const hole = meta.innerHole;
  const bgHex = options.exportBackgroundColor;
  const bgRgb = parseHexRgb(bgHex);
  const style = pickExportUiStyle(bgHex);

  const work = document.createElement("canvas");
  work.width = W;
  work.height = H;
  const ctx = work.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // STEP1 背景
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, W, H);

  // STEP2 絵（内枠中心・隙間を出さない cover ベース）
  const coverSide = Math.max(hole.width, hole.height);
  const side = coverSide * Math.max(0.5, Math.min(1.5, options.pictureScale));
  const art = prepareArtWithFloodFill(artSource, side, bgHex);
  const ax = hole.x + hole.width / 2 - side / 2;
  const ay = hole.y + hole.height / 2 - side / 2;
  ctx.drawImage(art, ax, ay, side, side);

  // STEP3 額縁
  if (options.includeFrame) {
    ctx.drawImage(frame, 0, 0, W, H);
  }

  const logo = await loadImageCached(LOGO_SRC);
  const dateStr = formatExportDate(new Date());
  const logoW = Math.min(Math.round(hole.width * 0.19), 116);
  const logoH = (logo.naturalHeight / logo.naturalWidth) * logoW;
  const measureEl = document.createElement("canvas");
  const measureCtx = measureEl.getContext("2d");
  if (measureCtx) {
    measureCtx.font = "300 20px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
  }
  const dateW = options.includeDate && measureCtx ? measureCtx.measureText(dateStr).width : 0;
  const dateH = 22;
  const gap = 10;
  const blockW = (options.includeDate ? dateW + gap : 0) + logoW;
  const blockH = Math.max(logoH, options.includeDate ? dateH : logoH);
  const pad = Math.max(6, Math.round(Math.min(hole.width, hole.height) * options.overlayMarginPct));

  // STEP5 被り判定（右下→右上→右中央）
  const anchors: AnchorId[] = ["BR", "TR", "RM"];
  let best: AnchorId = "BR";
  let bestScore = Infinity;
  for (const a of anchors) {
    const s = scoreAnchor(ctx, hole, blockW, blockH, pad, a, bgRgb);
    if (s < bestScore) {
      bestScore = s;
      best = a;
    }
  }
  const pos = layoutOverlay(hole, blockW, blockH, pad, best);

  // STEP4 ロゴ
  ctx.save();
  if (style.invertLogo) {
    ctx.filter = "invert(1) brightness(1.06)";
  }
  ctx.globalAlpha = 0.94;
  ctx.drawImage(logo, pos.x + blockW - logoW, pos.y + blockH - logoH, logoW, logoH);
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.restore();

  // STEP5 日付
  if (options.includeDate) {
    ctx.save();
    ctx.font = "300 20px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.fillStyle = style.dateFill;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(dateStr, pos.x, pos.y + blockH - 2);
    ctx.restore();
  }

  // 出力はフレーム物理寸法に完全一致（余白なし）
  return work.toDataURL("image/png");
}
