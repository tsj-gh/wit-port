const STORAGE_KEY = "wispo:tap-coloring:gallery:v1";
const MAX_ENTRIES = 5;
const PREVIEW_MAX_SIDE = 512;

export type TapColoringHistoryEntry = {
  id: string;
  createdAt: number;
  pictureId: string;
  /** 復元用（保存時のビットマップ一辺。`paintDataUrl` の解像度と一致） */
  savedBitmapSize: number;
  /** ペイント層のみ（アルファ付き PNG data URL） */
  paintDataUrl: string;
  /** 一覧・ダウンロード用の合成プレビュー（長辺 PREVIEW_MAX_SIDE 程度） */
  previewDataUrl: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseEntry(raw: unknown): TapColoringHistoryEntry | null {
  if (!isRecord(raw)) return null;
  const id = raw.id;
  const createdAt = raw.createdAt;
  const pictureId = raw.pictureId;
  const savedBitmapSize = raw.savedBitmapSize;
  const paintDataUrl = raw.paintDataUrl;
  const previewDataUrl = raw.previewDataUrl;
  if (
    typeof id !== "string" ||
    typeof createdAt !== "number" ||
    typeof pictureId !== "string" ||
    typeof savedBitmapSize !== "number" ||
    typeof paintDataUrl !== "string" ||
    typeof previewDataUrl !== "string" ||
    !paintDataUrl.startsWith("data:") ||
    !previewDataUrl.startsWith("data:")
  ) {
    return null;
  }
  return { id, createdAt, pictureId, savedBitmapSize, paintDataUrl, previewDataUrl };
}

export function readTapColoringHistory(): TapColoringHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: TapColoringHistoryEntry[] = [];
    for (const item of parsed) {
      const e = parseEntry(item);
      if (e) out.push(e);
    }
    return out;
  } catch {
    return [];
  }
}

function writeAll(entries: TapColoringHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // 容量超過などは握りつぶす
  }
}

export function buildPreviewDataUrlFromDisplay(display: HTMLCanvasElement): string {
  const w = display.width;
  const h = display.height;
  if (w < 1 || h < 1) return display.toDataURL("image/png");
  const scale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const c = document.createElement("canvas");
  c.width = tw;
  c.height = th;
  const ctx = c.getContext("2d");
  if (!ctx) return display.toDataURL("image/png");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(display, 0, 0, tw, th);
  return c.toDataURL("image/png");
}

export function prependTapColoringHistory(entry: Omit<TapColoringHistoryEntry, "id" | "createdAt">): TapColoringHistoryEntry[] {
  const full: TapColoringHistoryEntry = {
    ...entry,
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `tc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
  };
  const next = [full, ...readTapColoringHistory()].slice(0, MAX_ENTRIES);
  writeAll(next);
  return next;
}
