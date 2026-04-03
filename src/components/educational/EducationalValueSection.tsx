"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n-context";

const COLUMN_PATH = "/columns/educational-value";

type EducationalValueSectionProps = {
  /** `<summary>` に表示する見出し */
  summaryLabel: string;
  children: ReactNode;
  /** 知育コラムへのパス（既定: /columns/educational-value） */
  columnHref?: string;
};

/**
 * ゲームページ下部の「知育効果」折りたたみブロック。
 * ゲーム本体レイアウトには触れず、page.tsx のみから利用する。
 */
export function EducationalValueSection({
  summaryLabel,
  children,
  columnHref = COLUMN_PATH,
}: EducationalValueSectionProps) {
  const { t } = useI18n();

  return (
    <section
      className="mx-auto w-full max-w-[1080px] px-4 py-6 pb-12"
      aria-label="このパズルの知育効果"
    >
      <details className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
        <summary className="cursor-pointer list-none px-6 py-4 text-sm text-wit-muted transition-colors select-none hover:text-wit-text">
          <span className="font-medium">{summaryLabel}</span>
        </summary>
        <div className="space-y-4 px-6 pb-6 pt-0 text-sm leading-relaxed text-wit-muted">
          <div className="space-y-4 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-wit-text [&_h3]:first:mt-0 [&_p]:text-justify">
            {children}
          </div>
          <p className="border-t border-white/10 pt-4 text-left">
            <Link
              href={columnHref}
              className="text-sky-300 underline-offset-2 transition-colors hover:text-sky-200 hover:underline"
            >
              {t("educational.sectionLink")}
            </Link>
          </p>
        </div>
      </details>
    </section>
  );
}
