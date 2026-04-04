"use client";

import { DevLink } from "@/components/DevLink";
import { LanguageToggle } from "@/components/LanguageToggle";

/** 各ゲームの GamePageHeader 左列と同型（トップ左詰め）＋言語切替 */
export function EducationalColumnWispoHeader() {
  return (
    <header className="mb-8 flex w-full flex-wrap items-center justify-between gap-3 gap-y-2">
      <DevLink
        href="/"
        className="flex min-w-0 shrink-0 items-center gap-3 text-xl font-black leading-tight tracking-wider text-wit-text no-underline hover:opacity-90 sm:text-2xl"
      >
        <span className="block h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-wit-emerald to-teal-600" />
        Wispo
      </DevLink>
      <LanguageToggle />
    </header>
  );
}
