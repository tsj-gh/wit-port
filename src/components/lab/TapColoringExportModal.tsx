"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { RefObject } from "react";
import type { ColoringCanvasHandle } from "@/components/lab/ColoringCanvas";
import {
  composeTapColoringExport,
  EXPORT_SURFACE_PRESETS,
  type TapColoringExportOptions,
  type TapColoringFrameVariant,
} from "@/lib/tapColoringExport";
import type { TapColoringHistoryEntry } from "@/lib/tapColoringHistory";

export type TapColoringExportModalMode = "current" | "history" | null;

type TapColoringExportModalProps = {
  open: boolean;
  mode: TapColoringExportModalMode;
  historyEntry: TapColoringHistoryEntry | null;
  coloringRef: RefObject<ColoringCanvasHandle | null>;
  onClose: () => void;
  onToast?: (message: string) => void;
  onHistorySaved?: () => void;
  isLocked?: boolean;
};

function downloadDataUrlPng(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function defaultShareMessageBody(): string {
  if (typeof window === "undefined") return "タップぬりえ\n#Wispo\n#タップぬりえ";
  const url = `${window.location.origin}/lab/tap-coloring`;
  return `タップぬりえ\n${url}\n#Wispo\n#タップぬりえ`;
}

export function TapColoringExportModal({
  open,
  mode,
  historyEntry,
  coloringRef,
  onClose,
  onToast,
  onHistorySaved,
  isLocked = false,
}: TapColoringExportModalProps) {
  const titleId = useId();
  const [includeFrame, setIncludeFrame] = useState(true);
  const [includeDate, setIncludeDate] = useState(true);
  const [pictureScale, setPictureScale] = useState(1);
  const [frameVariant, setFrameVariant] = useState<TapColoringFrameVariant>("01");
  const [exportBackgroundColor, setExportBackgroundColor] = useState("#FFFFFF");
  const [overlayMarginPct, setOverlayMarginPct] = useState(0.04);
  const [shareMessage, setShareMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [historyArt, setHistoryArt] = useState<HTMLImageElement | null>(null);

  const exportOptions: TapColoringExportOptions = useMemo(
    () => ({
      frameVariant,
      includeFrame,
      includeDate,
      pictureScale,
      exportBackgroundColor,
      overlayMarginPct,
    }),
    [frameVariant, includeFrame, includeDate, pictureScale, exportBackgroundColor, overlayMarginPct],
  );

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setHistoryArt(null);
      return;
    }
    setIncludeFrame(true);
    setIncludeDate(true);
    setPictureScale(1);
    setFrameVariant("01");
    setExportBackgroundColor("#FFFFFF");
    setOverlayMarginPct(0.04);
    setShareMessage(defaultShareMessageBody());
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "history" || !historyEntry) {
      setHistoryArt(null);
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.onload = () => setHistoryArt(img);
    img.onerror = () => {
      setHistoryArt(null);
      onToast?.("プレビュー画像の読み込みに失敗しました");
    };
    img.src = historyEntry.previewDataUrl;
  }, [open, mode, historyEntry, onToast]);

  useEffect(() => {
    if (!open || !mode) return;
    let cancelled = false;
    setBusy(true);
    (async () => {
      try {
        if (mode === "current") {
          const dataUrl = await coloringRef.current?.composeHighResExport(exportOptions);
          if (!cancelled) setPreview(dataUrl ?? null);
        } else if (mode === "history" && historyArt) {
          const dataUrl = await composeTapColoringExport(historyArt, exportOptions);
          if (!cancelled) setPreview(dataUrl);
        } else if (mode === "history") {
          if (!cancelled) setPreview(null);
        }
      } catch {
        if (!cancelled) {
          setPreview(null);
          onToast?.("画像の合成に失敗しました");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, historyArt, exportOptions, coloringRef, onToast]);

  const onSaveFinal = useCallback(() => {
    if (isLocked) {
      onToast?.("ロック中は保存できません");
      return;
    }
    if (!preview) {
      onToast?.("プレビューがありません");
      return;
    }
    if (mode === "current") {
      const ok = coloringRef.current?.saveCurrentWorkToHistoryWithPreview(preview) ?? false;
      if (!ok) {
        onToast?.("保存できませんでした（ロック中・読み込み中等）");
        return;
      }
      onHistorySaved?.();
      onToast?.("作品履歴に保存しました");
      onClose();
      return;
    }
    if (mode === "history" && historyEntry) {
      const safe = historyEntry.pictureId.replace(/[^\w-]+/g, "_");
      downloadDataUrlPng(preview, `tap-coloring-${safe}-${historyEntry.createdAt}.png`);
      onToast?.("PNGを保存しました");
      onClose();
    }
  }, [preview, mode, historyEntry, coloringRef, onHistorySaved, onToast, onClose, isLocked]);

  const onShareFinal = useCallback(async () => {
    if (isLocked) {
      onToast?.("ロック中は共有できません");
      return;
    }
    if (!preview) {
      onToast?.("プレビューがありません");
      return;
    }
    try {
      const res = await fetch(preview);
      const blob = await res.blob();
      const file = new File([blob], "tap-coloring-wispo.png", { type: "image/png" });
      const text = shareMessage.trim() || defaultShareMessageBody();
      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "タップぬりえ",
          text,
        });
        onClose();
        return;
      }
      onToast?.("この端末では共有ダイアログを開けません。保存してからアプリから共有してください。");
    } catch {
      onToast?.("共有をキャンセルしたか、利用できませんでした");
    }
  }, [preview, onToast, onClose, isLocked, shareMessage]);

  if (!open || !mode) return null;

  const portal = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(92dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_14%,transparent)] bg-[var(--color-bg)] text-[var(--color-text)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold sm:text-base">
            {mode === "current" ? "作品を保存" : "作品を保存・共有"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--color-muted)] hover:bg-[color-mix(in_srgb,var(--color-text)_8%,transparent)] hover:text-[var(--color-text)]"
          >
            閉じる
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mx-auto mb-3 flex max-h-[min(48vh,360px)] items-center justify-center overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_6%,transparent)] p-2">
            {busy || !preview ? (
              <p className="py-16 text-center text-xs text-[var(--color-muted)]">プレビューを生成中…</p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="max-h-full w-full max-w-[min(92vw,400px)] object-contain" />
            )}
          </div>

          <div className="space-y-3 text-xs sm:text-sm">
            <div>
              <div className="mb-1 flex justify-between font-medium">
                <span>絵のサイズ</span>
                <span className="tabular-nums text-[var(--color-muted)]">{pictureScale.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.01}
                value={pictureScale}
                onChange={(e) => setPictureScale(Number(e.target.value))}
                className="w-full accent-amber-600"
              />
            </div>

            <div>
              <div className="mb-1.5 font-medium text-[var(--color-text)]">内枠の背景</div>
              <div className="grid w-full grid-cols-8 justify-items-center gap-1 sm:gap-1.5">
                {EXPORT_SURFACE_PRESETS.map((p) => {
                  const active = exportBackgroundColor.toLowerCase() === p.color.toLowerCase();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      title={p.label}
                      aria-label={`背景 ${p.label}`}
                      aria-pressed={active}
                      onClick={() => setExportBackgroundColor(p.color)}
                      className={`h-5 w-5 shrink-0 rounded-full border-2 shadow-sm transition ring-offset-1 ring-offset-[var(--color-bg)] sm:h-6 sm:w-6 sm:ring-offset-2 ${
                        active ? "border-amber-500 ring-2 ring-amber-400" : "border-[color-mix(in_srgb,var(--color-text)_18%,transparent)]"
                      }`}
                      style={{ backgroundColor: p.color }}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1 font-medium text-[var(--color-text)]">額縁の種類</div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "01" as const, label: "ゴールド" },
                    { id: "02" as const, label: "木目" },
                    { id: "03" as const, label: "ドット" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFrameVariant(f.id)}
                    className={`rounded-lg border px-2 py-1 text-[11px] font-semibold sm:text-xs ${
                      frameVariant === f.id
                        ? "border-amber-500 bg-amber-500/15 text-[var(--color-text)]"
                        : "border-[color-mix(in_srgb,var(--color-text)_14%,transparent)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] px-3 py-2">
              <label className="inline-flex cursor-pointer items-center gap-2 font-medium">
                <span>額縁</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-amber-600"
                  checked={includeFrame}
                  onChange={(e) => setIncludeFrame(e.target.checked)}
                />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 font-medium">
                <span>日付</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-amber-600"
                  checked={includeDate}
                  onChange={(e) => setIncludeDate(e.target.checked)}
                />
              </label>
            </div>

            <details className="rounded-lg border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] px-3 py-2">
              <summary className="cursor-pointer select-none text-[11px] font-medium text-[var(--color-muted)]">
                デバッグ調整
              </summary>
              <div className="mt-2">
                <div className="mb-1 flex justify-between font-medium">
                  <span className="text-[11px]">ロゴ余白%</span>
                  <span className="tabular-nums text-[11px] text-[var(--color-muted)]">
                    {(overlayMarginPct * 100).toFixed(1)}%
                  </span>
                </div>
                <input
                  id="logo-margin-debug"
                  type="range"
                  min={0.02}
                  max={0.08}
                  step={0.001}
                  value={overlayMarginPct}
                  onChange={(e) => setOverlayMarginPct(Number(e.target.value))}
                  className="w-full accent-amber-600"
                />
              </div>
            </details>

            <div>
              <label htmlFor="tap-export-share-msg" className="mb-1 block font-medium text-[var(--color-text)]">
                メッセージ
              </label>
              <textarea
                id="tap-export-share-msg"
                rows={4}
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                className="w-full resize-y rounded-lg border border-[color-mix(in_srgb,var(--color-text)_14%,transparent)] bg-[color-mix(in_srgb,var(--color-bg)_92%,transparent)] px-2 py-1.5 text-xs leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-muted)] sm:text-sm"
                placeholder={defaultShareMessageBody()}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] px-4 py-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isLocked || !preview || busy}
            onClick={onSaveFinal}
            className="rounded-xl border border-[color-mix(in_srgb,var(--color-text)_16%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_8%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] disabled:opacity-40"
          >
            {mode === "current" ? "この内容で保存" : "この内容で保存（PNG）"}
          </button>
          <button
            type="button"
            disabled={isLocked || !preview || busy}
            onClick={() => void onShareFinal()}
            className="rounded-xl border border-amber-600/50 bg-amber-500/90 px-4 py-2 text-sm font-semibold text-stone-900 disabled:opacity-40"
          >
            送信・共有
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(portal, document.body);
}
