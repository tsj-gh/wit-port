"use client";

import { DevLink } from "@/components/DevLink";

/** 各ゲームの GamePageHeader 左列と同型（トップ左詰め） */
export function EducationalColumnWispoHeader() {
  return (
    <header className="mb-8 flex w-full justify-start">
      <DevLink
        href="/"
        className="flex shrink-0 items-center gap-3 text-xl font-black leading-none tracking-wider text-wit-text no-underline hover:opacity-90 sm:text-2xl"
      >
        <span className="block h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-wit-emerald to-teal-600" />
        Wispo
      </DevLink>
    </header>
  );
}
