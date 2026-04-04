"use client";

import type { ReactNode } from "react";
import { DevLink } from "@/components/DevLink";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n-context";

export type GamePageHeaderProps = {
  /** 英語表記（例: Pair-Link） */
  titleEn: string;
  /** 日本語表記（括弧内に表示） */
  titleJa: string;
  homeHref?: string;
  trailing?: ReactNode;
  /** 既定: w-full（親の GAME_COLUMN_CLASS 等で幅を与える） */
  maxWidthClassName?: string;
  /** 追加クラス（例: px-4 border-b） */
  className?: string;
};

export function GamePageHeader({
  titleEn,
  titleJa,
  homeHref = "/",
  trailing,
  maxWidthClassName = "w-full",
  className = "",
}: GamePageHeaderProps) {
  const { locale } = useI18n();

  return (
    <header
      className={`mb-4 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-3 ${maxWidthClassName} ${className}`.trim()}
    >
      {/* 左: ロゴ + ゲームタイトル（同一グループ・折り返し可） */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:flex-1 sm:min-w-[12rem]">
        <DevLink
          href={homeHref}
          className="flex shrink-0 items-center gap-2 text-xl font-black leading-tight tracking-wider text-wit-text no-underline hover:opacity-90 sm:gap-3 sm:text-2xl"
        >
          <span className="block h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-wit-emerald to-teal-600" />
          Wispo
        </DevLink>
        <h1 className="min-w-0 max-w-full break-words text-left text-xl font-black leading-tight tracking-tight text-wit-text sm:text-2xl">
          <span className="text-wit-text">{titleEn}</span>
          {locale === "ja" ? <span className="text-wit-muted">（{titleJa}）</span> : null}
        </h1>
      </div>

      {/* 右: 言語切替 + タイマー等（モバイルは下段・右寄せ） */}
      <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:justify-end">
        <LanguageToggle />
        {trailing != null ? (
          <div className="flex shrink-0 items-center gap-2 text-sm leading-none text-wit-muted">{trailing}</div>
        ) : null}
      </div>
    </header>
  );
}
