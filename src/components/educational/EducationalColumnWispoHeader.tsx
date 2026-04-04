"use client";

import { DevLink } from "@/components/DevLink";
import { LanguageToggle } from "@/components/LanguageToggle";

/** 各ゲームの GamePageHeader 1行目と同型（■Wispo + JP/EN を同じ高さで横並び） */
export function EducationalColumnWispoHeader() {
  return (
    <header className="mb-8 w-full min-w-0">
      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
        <DevLink
          href="/"
          className="flex min-h-8 min-w-0 shrink-0 items-center gap-3 text-xl font-black leading-none tracking-wider text-wit-text no-underline hover:opacity-90 sm:text-2xl"
        >
          <span className="block h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-wit-emerald to-teal-600" />
          <span className="truncate">Wispo</span>
        </DevLink>
        <div className="shrink-0 self-center">
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
