"use client";

import { motion } from "framer-motion";
import { useCallback, useState, type CSSProperties, type MouseEvent, type RefObject } from "react";
import type { ColoringCanvasHandle } from "@/components/lab/ColoringCanvas";
import { TapColoringExportModal, type TapColoringExportModalMode } from "@/components/lab/TapColoringExportModal";
import { TAP_COLORING_VIVID_YELLOW_HEX } from "@/lib/tapColoringPalette";
import { toggleTapColoringHistoryPinned, type TapColoringHistoryEntry } from "@/lib/tapColoringHistory";

type TapColoringGalleryProps = {
  entries: TapColoringHistoryEntry[];
  coloringRef: RefObject<ColoringCanvasHandle | null>;
  className?: string;
  onToast?: (message: string) => void;
  /** 直近に差し替えた履歴 ID（サムネ揺れ） */
  shakeEntryId?: string | null;
  /**
   * 履歴演出・編集中など。true の間は保存・シェア・再開など作品履歴まわりを無効化し、
   * 保存・シェア系ボタンは disabled。
   */
  isLocked: boolean;
  onHistorySaved?: () => void;
};

function IconSave({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
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
export function TapColoringGallery({
  entries,
  coloringRef,
  className = "",
  onToast,
  shakeEntryId,
  isLocked,
  onHistorySaved,
}: TapColoringGalleryProps) {
  const showToast = (message: string) => {
    onToast?.(message);
  };

  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState<TapColoringExportModalMode>(null);
  const [exportEntry, setExportEntry] = useState<TapColoringHistoryEntry | null>(null);

  const closeExport = useCallback(() => {
    setExportOpen(false);
    setExportMode(null);
    setExportEntry(null);
  }, []);

  const openExportCurrent = useCallback(() => {
    if (isLocked) {
      showToast("ロック中は保存できません");
      return;
    }
    setExportMode("current");
    setExportEntry(null);
    setExportOpen(true);
  }, [isLocked]);

  const openExportHistory = useCallback(
    (entry: TapColoringHistoryEntry) => {
      if (isLocked) {
        showToast("ロック中は保存・共有できません");
        return;
      }
      setExportMode("history");
      setExportEntry(entry);
      setExportOpen(true);
    },
    [isLocked],
  );

  const onResume = (entry: TapColoringHistoryEntry) => {
    if (isLocked) {
      showToast("ロック中は再開できません");
      return;
    }
    const ok = coloringRef.current?.loadHistoryEntry(entry) ?? false;
    if (!ok) showToast("再開できませんでした");
  };

  const onTogglePin = (e: MouseEvent, entryId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLocked) {
      showToast("ロック中はピン留めできません");
      return;
    }
    const next = toggleTapColoringHistoryPinned(entryId);
    if (!next) showToast("ピン留めを更新できませんでした");
    else onHistorySaved?.();
  };

  const btnDisabled = isLocked;

  return (
    <div className={`relative ${className}`} aria-busy={isLocked || undefined}>
      <TapColoringExportModal
        open={exportOpen}
        mode={exportMode}
        historyEntry={exportEntry}
        coloringRef={coloringRef}
        onClose={closeExport}
        onToast={onToast}
        onHistorySaved={onHistorySaved}
        isLocked={isLocked}
      />
      <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] p-3 text-[var(--color-text)]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">作品履歴（最大5件）</h3>
          <button
            type="button"
            disabled={btnDisabled}
            onClick={openExportCurrent}
            className="shrink-0 rounded-lg border border-[color-mix(in_srgb,var(--color-text)_14%,transparent)] bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] px-2 py-1 text-[10px] font-semibold text-[var(--color-muted)] transition hover:text-[var(--color-text)] enabled:hover:bg-[color-mix(in_srgb,var(--color-text)_6%,transparent)] disabled:cursor-not-allowed disabled:opacity-45 sm:text-xs"
          >
            いまの塗りを保存
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="min-h-[2.5rem] rounded-lg border border-dashed border-[color-mix(in_srgb,var(--color-text)_12%,transparent)] bg-[color-mix(in_srgb,var(--color-bg)_40%,transparent)]" />
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
              <li key={entry.id} className="min-w-0">
                <motion.div
                  className={`group relative overflow-hidden rounded-xl bg-[var(--color-bg)] shadow-md ring-1 ring-[color-mix(in_srgb,var(--color-text)_8%,transparent)] ${
                    entry.isPinned ? "ring-4 ring-offset-2 ring-offset-[var(--color-bg)]" : ""
                  }`}
                  style={
                    entry.isPinned
                      ? ({
                          ["--tw-ring-color" as string]: TAP_COLORING_VIVID_YELLOW_HEX,
                        } as CSSProperties)
                      : undefined
                  }
                  animate={
                    shakeEntryId === entry.id
                      ? { x: [0, -5, 5, -4, 4, -2, 2, 0], rotate: [0, -0.8, 0.8, -0.5, 0.5, 0] }
                      : { x: 0, rotate: 0 }
                  }
                  transition={{ duration: 0.48, ease: "easeInOut" }}
                >
                  <button
                    type="button"
                    disabled={btnDisabled}
                    onClick={(e) => onTogglePin(e, entry.id)}
                    className={`absolute left-1 top-1 z-20 flex h-[22px] w-[22px] min-h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 bg-[color-mix(in_srgb,var(--color-bg)_92%,transparent)] shadow-sm backdrop-blur-sm transition enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${
                      entry.isPinned ? "" : "border-stone-300 text-stone-400 hover:border-stone-400 hover:text-stone-500"
                    }`}
                    style={
                      entry.isPinned
                        ? ({
                            borderColor: TAP_COLORING_VIVID_YELLOW_HEX,
                            color: TAP_COLORING_VIVID_YELLOW_HEX,
                          } as CSSProperties)
                        : undefined
                    }
                    aria-label={entry.isPinned ? "ピン留めを解除" : "ピン留めする"}
                    title={entry.isPinned ? "ピン留めを解除" : "ピン留めする"}
                  >
                    <span className="select-none text-[15px] font-bold leading-none" aria-hidden>
                      ★
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={btnDisabled}
                    onClick={() => onResume(entry)}
                    className="relative block w-full cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-45"
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
                  <div className="flex items-center justify-center border-t border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)] px-1 py-1">
                    <button
                      type="button"
                      disabled={btnDisabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        openExportHistory(entry);
                      }}
                      className="inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-[10px] font-medium text-[var(--color-muted)] transition enabled:hover:bg-[color-mix(in_srgb,var(--color-text)_8%,transparent)] enabled:hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-45"
                      aria-label="絵を保存・共有"
                      title="絵を保存・共有"
                    >
                      <IconSave className="h-3.5 w-3.5" />
                      <span className="whitespace-nowrap">絵を保存・共有</span>
                    </button>
                  </div>
                </motion.div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
