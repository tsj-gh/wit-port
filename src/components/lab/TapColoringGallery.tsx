"use client";

import { type RefObject } from "react";
import type { ColoringCanvasHandle } from "@/components/lab/ColoringCanvas";
import type { TapColoringHistoryEntry } from "@/lib/tapColoringHistory";

type TapColoringGalleryProps = {
  entries: TapColoringHistoryEntry[];
  coloringRef: RefObject<ColoringCanvasHandle | null>;
  className?: string;
  onToast?: (message: string) => void;
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

function IconSave({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v12M8 11l4 4 4-4M5 21h14a2 2 0 0 0 2-2v-7l-5-5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 完成作品のローカル履歴（最大5件）。PC はサイドバー、モバイルは Canvas 下に配置する想定。
 */
export function TapColoringGallery({ entries, coloringRef, className = "", onToast }: TapColoringGalleryProps) {
  const showToast = (message: string) => {
    onToast?.(message);
  };

  const onSaveCurrent = () => {
    const ok = coloringRef.current?.saveCurrentWorkToHistory() ?? false;
    if (!ok) showToast("まだ保存できません（読み込み中など）");
  };

  const onResume = (entry: TapColoringHistoryEntry) => {
    const ok = coloringRef.current?.loadHistoryEntry(entry) ?? false;
    if (!ok) showToast("再開できませんでした");
  };

  const onDownload = (entry: TapColoringHistoryEntry) => {
    const safe = entry.pictureId.replace(/[^\w-]+/g, "_");
    downloadDataUrlPng(entry.previewDataUrl, `tap-coloring-${safe}-${entry.createdAt}.png`);
  };

  const onSns = () => {
    showToast("画像を生成中...");
  };

  return (
    <div className={`relative ${className}`}>
      <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] p-3 text-[var(--color-text)]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">作品履歴</h3>
          <button
            type="button"
            onClick={onSaveCurrent}
            className="shrink-0 rounded-lg border border-[color-mix(in_srgb,var(--color-text)_14%,transparent)] bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] px-2 py-1 text-[10px] font-semibold text-[var(--color-muted)] transition hover:text-[var(--color-text)] sm:text-xs"
          >
            いまの塗りを保存
          </button>
        </div>
        <p className="mb-3 text-[10px] leading-relaxed text-[var(--color-muted)] sm:text-xs">最大5件（この端末のみ）</p>

        {entries.length === 0 ? (
          <div className="min-h-[2.5rem] rounded-lg border border-dashed border-[color-mix(in_srgb,var(--color-text)_12%,transparent)] bg-[color-mix(in_srgb,var(--color-bg)_40%,transparent)]" />
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
              <li key={entry.id} className="min-w-0">
                <div className="overflow-hidden rounded-xl bg-[var(--color-bg)] shadow-md ring-1 ring-[color-mix(in_srgb,var(--color-text)_8%,transparent)]">
                  <button
                    type="button"
                    onClick={() => onResume(entry)}
                    className="relative block w-full cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                    aria-label="この作品をキャンバスに読み込んで続きから塗る"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.previewDataUrl}
                      alt=""
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                    <span className="sr-only">再開</span>
                  </button>
                  <div className="flex flex-wrap items-center justify-end gap-1 border-t border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)] px-1.5 py-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload(entry);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-[color-mix(in_srgb,var(--color-text)_8%,transparent)] hover:text-[var(--color-text)]"
                      aria-label="PNGで保存"
                      title="PNGで保存"
                    >
                      <IconSave className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSns();
                      }}
                      className="rounded-lg px-2 py-1 text-[10px] font-medium text-[var(--color-muted)] transition hover:bg-[color-mix(in_srgb,var(--color-text)_8%,transparent)] hover:text-[var(--color-text)] sm:text-xs"
                    >
                      SNSに送る
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
