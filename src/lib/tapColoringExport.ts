/**
 * Tap Coloring 用の高解像度エクスポート合成。
 * 外側白の洪水塗り透過 → 1024 作業面合成 → 額縁外寸トリミング → 空洞内にロゴ・日付。
 */

export const EXPORT_WORK_SIZE = 1024;

export type TapColoringFrameVariant = "01" | "02" | "03";

export type TapColoringExportRect = { x: number; y: number; width: number; height: number };

export type TapColoringExportOptions = {
  frameVariant: TapColoringFrameVariant;
  includeFrame: boolean;
  includeDate: boolean;
  pictureScale: number;
  exportBackgroundColor: string;
};

const FRAME_PUBLIC = "/assets/tap-coloring/Frame";
const LOGO_SRC = "/assets/logo/logo_wispo.png";

/**
 * cropArea: 1024 作業 Canvas から切り出す「額縁の外寸」
 * innerHoleAfterCrop: トリミング後の画像座標（左上 0,0）での「開口」＝ロゴ配置・被り判定領域
 */
export const FRAME_CONFIG: Record<
  TapColoringFrameVariant,
  {
    file: string;
    cropArea: TapColoringExportRect;
    /** 開口内からロゴ・日付をさらに内側へ寄せるマージン */
    logoMarginInner: number;
    innerHoleAfterCrop: TapColoringExportRect;
    centerX: number;
    centerY: number;
    artBase: number;
    overlapScale: number;
  }
> = {
  "01": {
    file: `${FRAME_PUBLIC}/frame_01.png`,
    cropArea: { x: 22, y: 22, width: 980, height: 980 },
    logoMarginInner: 10,
    innerHoleAfterCrop: { x: 158, y: 164, width: 664, height: 648 },
    centerX: 512,
    centerY: 508,
    artBase: 548,
    overlapScale: 1.022,
  },
  "02": {
    file: `${FRAME_PUBLIC}/frame_02.png`,
    cropArea: { x: 26, y: 24, width: 972, height: 976 },
    logoMarginInner: 10,
    innerHoleAfterCrop: { x: 162, y: 168, width: 648, height: 632 },
    centerX: 512,
    centerY: 510,
    artBase: 544,
    overlapScale: 1.026,
  },
  "03": {
    file: `${FRAME_PUBLIC}/frame_03.png`,
    cropArea: { x: 18, y: 20, width: 988, height: 984 },
    logoMarginInner: 10,
    innerHoleAfterCrop: { x: 152, y: 158, width: 684, height: 664 },
    centerX: 512,
    centerY: 506,
    artBase: 550,
    overlapScale: 1.02,
  },
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

const imageCache = new Map<string, Promise<HTMLImageElement>>();

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

function formatExportDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
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

/** 暗い背景ならロゴ反転・日付は白、明るい背景なら日付は黒 */
export function pickExportUiStyle(bgHex: string): { invertLogo: boolean; dateFill: string } {
  const lum = relativeLuminanceFromHex(bgHex);
  if (lum < 0.48) {
    return { invertLogo: true, dateFill: "rgba(255, 255, 255, 0.95)" };
  }
  return { invertLogo: false, dateFill: "rgba(28, 28, 28, 0.9)" };
}

/** (0,0) から輪郭外の白〜下地を透明化（内側の白は線で遮断されれば維持） */
function floodFillOutsideTransparent(
  data: ImageData,
  width: number,
  height: number,
  startX: number,
  startY: number,
  seedTolerance: number,
): void {
  const d = data.data;
  const idx = (x: number, y: number) => (y * width + x) * 4;
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;
  const si = idx(startX, startY);
  const sr = d[si]!;
  const sg = d[si + 1]!;
  const sb = d[si + 2]!;
  const sa = d[si + 3]!;
  if (sa < 8) return;

  const fillable = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const i = idx(x, y);
    const a = d[i + 3]!;
    if (a < 16) return false;
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    const dr = Math.abs(r - sr);
    const dg = Math.abs(g - sg);
    const db = Math.abs(b - sb);
    if (dr + dg + db <= seedTolerance) return true;
    if (r > 250 && g > 250 && b > 250) return true;
    return false;
  };

  const visited = new Uint8Array(width * height);
  const qx: number[] = [startX];
  const qy: number[] = [startY];
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
    d[i + 3] = 0;
    qx.push(x + 1, x - 1, x, x);
    qy.push(y, y, y + 1, y - 1);
  }
}

/** 塗り絵を指定サイズに描画し、外側白を透明化した Canvas を返す */
function rasterizeArtWithOutsideTransparent(
  artSource: CanvasImageSource,
  pixelW: number,
  pixelH: number,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(pixelW));
  c.height = Math.max(1, Math.round(pixelH));
  const xctx = c.getContext("2d");
  if (!xctx) return c;
  xctx.imageSmoothingEnabled = true;
  xctx.imageSmoothingQuality = "high";
  xctx.clearRect(0, 0, c.width, c.height);
  xctx.drawImage(artSource, 0, 0, c.width, c.height);
  const img = xctx.getImageData(0, 0, c.width, c.height);
  floodFillOutsideTransparent(img, c.width, c.height, 0, 0, 28);
  xctx.putImageData(img, 0, 0);
  return c;
}

function clampRectToBounds(r: TapColoringExportRect, bw: number, bh: number): TapColoringExportRect {
  const x = Math.max(0, Math.min(bw - 1, Math.floor(r.x)));
  const y = Math.max(0, Math.min(bh - 1, Math.floor(r.y)));
  const x2 = Math.max(x + 1, Math.min(bw, Math.ceil(r.x + r.width)));
  const y2 = Math.max(y + 1, Math.min(bh, Math.ceil(r.y + r.height)));
  return { x, y, width: x2 - x, height: y2 - y };
}

/** 開口内で「塗り」（背景と十分違う不透明画素）の占有率 */
function regionPaintScore(imageData: ImageData, bg: { r: number; g: number; b: number }): number {
  const d = imageData.data;
  let hit = 0;
  let denom = 0;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]!;
    if (a < 36) continue;
    denom++;
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    const diff = Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b);
    if (diff > 42) hit++;
  }
  return denom > 0 ? hit / denom : 0;
}

type AnchorId = "BR" | "TR" | "RM";

function scoreAnchorOnAnalysis(
  actx: CanvasRenderingContext2D,
  aw: number,
  ah: number,
  hole: TapColoringExportRect,
  pad: number,
  blockW: number,
  blockH: number,
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
  const r = clampRectToBounds({ x: bx, y: by, width: blockW, height: blockH }, aw, ah);
  const data = actx.getImageData(r.x, r.y, r.width, r.height);
  return regionPaintScore(data, bg);
}

function layoutOverlayInHole(
  hole: TapColoringExportRect,
  pad: number,
  anchor: AnchorId,
  lw: number,
  lh: number,
  dateW: number,
  dateH: number,
  gap: number,
  includeDate: boolean,
): { logoX: number; logoY: number; textX: number; textY: number } {
  const blockW = includeDate ? dateW + gap + lw : lw;
  const blockH = Math.max(lh, includeDate ? dateH : lh);
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
  return {
    logoX: bx + blockW - lw,
    logoY: by + blockH - lh,
    textX: bx,
    textY: by + blockH - 2,
  };
}

/**
 * 表示用キャンバス（正方形）を合成し、額縁外寸でトリミングした PNG data URL を返す。
 */
export async function composeTapColoringExport(
  artSource: CanvasImageSource,
  options: TapColoringExportOptions,
): Promise<string> {
  const W = EXPORT_WORK_SIZE;
  const H = EXPORT_WORK_SIZE;
  const cfg = FRAME_CONFIG[options.frameVariant];
  const crop = options.includeFrame
    ? cfg.cropArea
    : ({ x: 0, y: 0, width: W, height: H } satisfies TapColoringExportRect);

  const bgHex = options.exportBackgroundColor;
  const bgRgb = parseHexRgb(bgHex);
  const uiStyle = pickExportUiStyle(bgHex);

  const side =
    cfg.artBase * cfg.overlapScale * Math.max(0.5, Math.min(1.5, options.pictureScale));
  const ax = cfg.centerX - side / 2;
  const ay = cfg.centerY - side / 2;

  const artPrepared = rasterizeArtWithOutsideTransparent(artSource, side, side);

  const work = document.createElement("canvas");
  work.width = W;
  work.height = H;
  const ctx = work.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(artPrepared, ax, ay, side, side);

  const analysis = document.createElement("canvas");
  analysis.width = crop.width;
  analysis.height = crop.height;
  const actx = analysis.getContext("2d");
  if (!actx) throw new Error("no analysis ctx");
  actx.imageSmoothingEnabled = true;
  actx.imageSmoothingQuality = "high";
  actx.drawImage(work, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

  const holeRaw = options.includeFrame
    ? cfg.innerHoleAfterCrop
    : { x: 56, y: 56, width: crop.width - 112, height: crop.height - 112 };
  const hole = clampRectToBounds(holeRaw, analysis.width, analysis.height);
  const innerPad = cfg.logoMarginInner;

  const logo = await loadImageCached(LOGO_SRC);
  const logoMaxW = 112;
  const lw = Math.min(logoMaxW, logo.naturalWidth);
  const lh = (logo.naturalHeight / logo.naturalWidth) * lw;
  const dateStr = formatExportDate(new Date());

  const mEl = document.createElement("canvas");
  const measure = mEl.getContext("2d");
  if (measure) {
    measure.font = "300 20px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
  }
  const dateW = options.includeDate && measure ? measure.measureText(dateStr).width : 0;
  const dateH = 22;
  const gap = 10;
  const blockW = (options.includeDate ? dateW + gap : 0) + lw;
  const blockH = Math.max(lh, options.includeDate ? dateH : lh);

  const anchors: AnchorId[] = ["BR", "TR", "RM"];
  let best: AnchorId = "BR";
  let bestScore = Infinity;
  for (const a of anchors) {
    const s = scoreAnchorOnAnalysis(actx, analysis.width, analysis.height, hole, innerPad, blockW, blockH, a, bgRgb);
    if (s < bestScore) {
      bestScore = s;
      best = a;
    }
  }

  if (options.includeFrame) {
    const frame = await loadImageCached(cfg.file);
    ctx.drawImage(frame, 0, 0, W, H);
  }

  const out = document.createElement("canvas");
  out.width = crop.width;
  out.height = crop.height;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("no out ctx");
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(work, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

  const { logoX, logoY, textX, textY } = layoutOverlayInHole(
    hole,
    innerPad,
    best,
    lw,
    lh,
    dateW,
    dateH,
    gap,
    options.includeDate,
  );

  octx.save();
  if (uiStyle.invertLogo) {
    octx.filter = "invert(1) brightness(1.06)";
  }
  octx.globalAlpha = 0.94;
  octx.drawImage(logo, logoX, logoY, lw, lh);
  octx.filter = "none";
  octx.globalAlpha = 1;
  octx.restore();

  if (options.includeDate) {
    octx.save();
    octx.font = "300 20px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
    octx.fillStyle = uiStyle.dateFill;
    octx.textAlign = "left";
    octx.textBaseline = "bottom";
    octx.fillText(dateStr, textX, textY);
    octx.restore();
  }

  return out.toDataURL("image/png");
}
