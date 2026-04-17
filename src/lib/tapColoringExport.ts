/**
 * Tap Coloring 用の高解像度エクスポート合成（1024 作業面 → 額縁外寸でトリミング）。
 */

export const EXPORT_WORK_SIZE = 1024;

export type TapColoringFrameVariant = "01" | "02" | "03";

export type TapColoringExportRect = { x: number; y: number; width: number; height: number };

export type TapColoringExportOptions = {
  frameVariant: TapColoringFrameVariant;
  includeFrame: boolean;
  includeDate: boolean;
  /** 絵の一辺スケール（中心固定）。はみ出しは額縁で隠す想定 */
  pictureScale: number;
  /** STEP1 内枠の背景色 */
  exportBackgroundColor: string;
};

const FRAME_PUBLIC = "/assets/tap-coloring/Frame";
const LOGO_SRC = "/assets/logo/logo_wispo.png";

/** 額縁 PNG（1024）に対するトリミング外寸・内マット・ロゴ回避・絵の配置 */
export const FRAME_CONFIG: Record<
  TapColoringFrameVariant,
  {
    file: string;
    cropArea: TapColoringExportRect;
    logoAvoidPadding: number;
    innerMatRect: TapColoringExportRect;
    centerX: number;
    centerY: number;
    artBase: number;
    overlapScale: number;
  }
> = {
  "01": {
    file: `${FRAME_PUBLIC}/frame_01.png`,
    cropArea: { x: 22, y: 22, width: 980, height: 980 },
    logoAvoidPadding: 16,
    innerMatRect: { x: 142, y: 146, width: 740, height: 732 },
    centerX: 512,
    centerY: 508,
    artBase: 548,
    overlapScale: 1.022,
  },
  "02": {
    file: `${FRAME_PUBLIC}/frame_02.png`,
    cropArea: { x: 26, y: 24, width: 972, height: 976 },
    logoAvoidPadding: 18,
    innerMatRect: { x: 148, y: 152, width: 728, height: 724 },
    centerX: 512,
    centerY: 510,
    artBase: 544,
    overlapScale: 1.026,
  },
  "03": {
    file: `${FRAME_PUBLIC}/frame_03.png`,
    cropArea: { x: 18, y: 20, width: 988, height: 984 },
    logoAvoidPadding: 15,
    innerMatRect: { x: 138, y: 142, width: 748, height: 736 },
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
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** 背景に対して読みやすいラベル色 */
export function pickExportLabelStyle(bgHex: string): { fill: string } {
  const lum = relativeLuminanceFromHex(bgHex);
  if (lum > 0.55) return { fill: "rgba(26, 26, 26, 0.9)" };
  return { fill: "rgba(252, 252, 252, 0.94)" };
}

function clampRectToCanvas(
  x: number,
  y: number,
  w: number,
  h: number,
  cw: number,
  ch: number,
): TapColoringExportRect {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(cw, Math.ceil(x + w));
  const y1 = Math.min(ch, Math.ceil(y + h));
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

function regionContentScore(imageData: ImageData, bg: { r: number; g: number; b: number }, threshold = 44): number {
  const d = imageData.data;
  let hit = 0;
  const total = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    const dr = Math.abs(d[i]! - bg.r);
    const dg = Math.abs(d[i + 1]! - bg.g);
    const db = Math.abs(d[i + 2]! - bg.b);
    if (dr + dg + db > threshold) hit++;
  }
  return total > 0 ? hit / total : 0;
}

type AnchorId = "BR" | "TR" | "RM";

function scoreAnchor(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  inner: TapColoringExportRect,
  pad: number,
  blockW: number,
  blockH: number,
  anchor: AnchorId,
  bg: { r: number; g: number; b: number },
): number {
  let bx = 0;
  let by = 0;
  const { x: ix, y: iy, width: iw, height: ih } = inner;
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
  const r = clampRectToCanvas(bx, by, blockW, blockH, cw, ch);
  const data = ctx.getImageData(r.x, r.y, r.width, r.height);
  return regionContentScore(data, bg);
}

function layoutOverlayBlock(
  inner: TapColoringExportRect,
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
  const { x: ix, y: iy, width: iw, height: ih } = inner;
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
  const logoX = bx + blockW - lw;
  const logoY = by + blockH - lh;
  const textX = bx;
  const textY = by + blockH - 2;
  return { logoX, logoY, textX, textY };
}

/**
 * 表示用キャンバス（正方形）を 1024 作業面に合成し、額縁外寸でトリミングして PNG data URL を返す。
 */
export async function composeTapColoringExport(
  artSource: CanvasImageSource,
  options: TapColoringExportOptions,
): Promise<string> {
  const W = EXPORT_WORK_SIZE;
  const H = EXPORT_WORK_SIZE;
  const work = document.createElement("canvas");
  work.width = W;
  work.height = H;
  const ctx = work.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const cfg = FRAME_CONFIG[options.frameVariant];
  const crop = options.includeFrame
    ? cfg.cropArea
    : ({ x: 0, y: 0, width: W, height: H } satisfies TapColoringExportRect);
  const inner = options.includeFrame
    ? cfg.innerMatRect
    : { x: 80, y: 80, width: W - 160, height: H - 160 };

  const bgHex = options.exportBackgroundColor;
  const bgRgb = parseHexRgb(bgHex);

  // STEP 1
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, W, H);

  // STEP 2
  const side =
    cfg.artBase * cfg.overlapScale * Math.max(0.5, Math.min(1.5, options.pictureScale));
  const ax = cfg.centerX - side / 2;
  const ay = cfg.centerY - side / 2;
  ctx.drawImage(artSource, ax, ay, side, side);

  const logo = await loadImageCached(LOGO_SRC);
  const logoMaxW = 118;
  const lw = Math.min(logoMaxW, logo.naturalWidth);
  const lh = (logo.naturalHeight / logo.naturalWidth) * lw;
  const dateStr = formatExportDate(new Date());
  ctx.font = "300 20px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
  const dateW = options.includeDate ? ctx.measureText(dateStr).width : 0;
  const dateH = 22;
  const gap = 12;
  const blockW = (options.includeDate ? dateW + gap : 0) + lw;
  const blockH = Math.max(lh, options.includeDate ? dateH : lh);
  const pad = cfg.logoAvoidPadding;

  // 額縁の前（背景＋塗りのみ）で被りを判定
  const anchors: AnchorId[] = ["BR", "TR", "RM"];
  let best: AnchorId = "BR";
  let bestScore = Infinity;
  for (const a of anchors) {
    const s = scoreAnchor(ctx, W, H, inner, pad, blockW, blockH, a, bgRgb);
    if (s < bestScore) {
      bestScore = s;
      best = a;
    }
  }

  // STEP 3
  if (options.includeFrame) {
    const frame = await loadImageCached(cfg.file);
    ctx.drawImage(frame, 0, 0, W, H);
  }

  const labelStyle = pickExportLabelStyle(bgHex);
  const { logoX, logoY, textX, textY } = layoutOverlayBlock(
    inner,
    pad,
    best,
    lw,
    lh,
    dateW,
    dateH,
    gap,
    options.includeDate,
  );

  ctx.globalAlpha = 0.93;
  ctx.drawImage(logo, logoX, logoY, lw, lh);
  ctx.globalAlpha = 1;

  if (options.includeDate) {
    ctx.save();
    ctx.font = "300 20px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.fillStyle = labelStyle.fill;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(dateStr, textX, textY);
    ctx.restore();
  }

  // トリミング（額縁外寸）
  const out = document.createElement("canvas");
  out.width = crop.width;
  out.height = crop.height;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("no out ctx");
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(work, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

  return out.toDataURL("image/png");
}
