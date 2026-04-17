/**
 * Tap Coloring 用の 1024×1024 高解像度エクスポート合成。
 * 額縁ごとの内枠差は FRAME_CONFIG で微調整する。
 */

export const EXPORT_CANVAS_SIZE = 1024;

export type TapColoringFrameVariant = "01" | "02" | "03";

export type TapColoringExportOptions = {
  frameVariant: TapColoringFrameVariant;
  /** 額縁 PNG を重ねるか（オフ時は STEP3 をスキップ） */
  includeFrame: boolean;
  /** 日付テキストを描くか */
  includeDate: boolean;
  /** 塗り絵の一辺スケール（中心固定、1.0 = 設定ベース） */
  pictureScale: number;
};

const FRAME_PUBLIC = "/assets/tap-coloring/Frame";
const LOGO_SRC = "/assets/logo/logo_wispo.png";

/** 額縁ごとの内側アート配置（1024 座標系）。必要に応じて数ピクセル単位で調整 */
export const FRAME_CONFIG: Record<
  TapColoringFrameVariant,
  {
    file: string;
    /** アート正方形の中心 X */
    centerX: number;
    /** アート正方形の中心 Y（額縁の視覚重心に合わせる） */
    centerY: number;
    /** pictureScale=1 のときの基準一辺（額縁の開口に対しわずかに大きめ＝重なり防止） */
    artBase: number;
    /** 隙間埋めのための追加倍率（内枠との重なり用） */
    overlapScale: number;
  }
> = {
  "01": { file: `${FRAME_PUBLIC}/frame_01.png`, centerX: 512, centerY: 508, artBase: 548, overlapScale: 1.022 },
  "02": { file: `${FRAME_PUBLIC}/frame_02.png`, centerX: 512, centerY: 510, artBase: 544, overlapScale: 1.026 },
  "03": { file: `${FRAME_PUBLIC}/frame_03.png`, centerX: 512, centerY: 506, artBase: 550, overlapScale: 1.02 },
};

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

/**
 * 表示用キャンバス（正方形）と同じ内容を、1024 出力用に合成する。
 * ロゴは常に描画。日付・額縁は options に従う。
 */
export async function composeTapColoringExport(
  artSource: CanvasImageSource,
  sceneBgColor: string,
  options: TapColoringExportOptions,
): Promise<string> {
  const W = EXPORT_CANVAS_SIZE;
  const H = EXPORT_CANVAS_SIZE;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // STEP 1 — 背景
  ctx.fillStyle = sceneBgColor;
  ctx.fillRect(0, 0, W, H);

  const cfg = FRAME_CONFIG[options.frameVariant];
  const side =
    cfg.artBase * cfg.overlapScale * Math.max(0.5, Math.min(1.35, options.pictureScale));
  const ax = cfg.centerX - side / 2;
  const ay = cfg.centerY - side / 2;

  // STEP 2 — 塗り絵（中央・わずかに額縁内側へ食い込ませる）
  ctx.drawImage(artSource, ax, ay, side, side);

  // STEP 3 — 額縁
  if (options.includeFrame) {
    const frame = await loadImageCached(cfg.file);
    ctx.drawImage(frame, 0, 0, W, H);
  }

  // STEP 4 — ロゴ（常時）
  const logo = await loadImageCached(LOGO_SRC);
  const logoMaxW = 128;
  const lw = Math.min(logoMaxW, logo.naturalWidth);
  const lh = (logo.naturalHeight / logo.naturalWidth) * lw;
  const pad = 28;
  const lx = W - lw - pad;
  const ly = H - lh - pad;
  ctx.globalAlpha = 0.92;
  ctx.drawImage(logo, lx, ly, lw, lh);
  ctx.globalAlpha = 1;

  // STEP 5 — 日付（ロゴ左寄り）
  if (options.includeDate) {
    const text = formatExportDate(new Date());
    ctx.save();
    ctx.font = "300 22px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(40, 40, 40, 0.78)";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(text, lx - 16, ly + lh - 4);
    ctx.restore();
  }

  return out.toDataURL("image/png");
}
