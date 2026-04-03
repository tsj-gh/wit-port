"use client";

import type { ReactNode } from "react";
import { DevLink } from "@/components/DevLink";

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
  return (
    <header
      className={`mb-4 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-2 sm:gap-x-3 ${maxWidthClassName} ${className}`.trim()}
    >
      <div className="flex min-w-0 justify-start">
        <DevLink
          href={homeHref}
          className="flex shrink-0 items-center gap-3 text-xl font-black leading-none tracking-wider text-wit-text no-underline hover:opacity-90 sm:text-2xl"
        >
          <span className="block h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-wit-emerald to-teal-600" />
          Wispo
        </DevLink>
      </div>
      <h1 className="max-w-[min(100vw-6rem,22rem)] min-w-0 text-center text-xl font-black leading-none tracking-tight text-wit-text sm:max-w-none sm:text-2xl">
        <span className="text-wit-text">{titleEn}</span>
        <span className="text-wit-muted">（{titleJa}）</span>
      </h1>
      <div className="flex min-w-0 justify-end">
        {trailing != null ? (
          <div className="flex shrink-0 items-center gap-2 text-sm leading-none text-wit-muted">{trailing}</div>
        ) : (
          <span className="invisible h-6 w-px select-none" aria-hidden />
        )}
      </div>
    </header>
  );
}
