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
      <details className="group overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] backdrop-blur">
        <summary className="cursor-pointer list-none px-6 py-4 text-sm text-[var(--color-muted)] transition-colors select-none hover:text-[var(--color-text)]">
          <span className="font-medium">{summaryLabel}</span>
        </summary>
        <div className="space-y-4 px-6 pb-6 pt-0 text-sm leading-relaxed text-[var(--color-muted)]">
          <p className="rounded-lg border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)] px-3 py-2 text-xs leading-relaxed">
            上部のクイック・インフォが「結論」なら、ここでは背景理論を扱います。モンテッソーリ教育、ワーキングメモリ、非認知能力の観点から、各ゲームの設計意図を具体的に整理しています。
          </p>
          <div className="space-y-4 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[var(--color-text)] [&_h3]:first:mt-0 [&_p]:text-justify">
            {children}
          </div>
          <p className="border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] pt-4 text-left">
            <Link
              href={columnHref}
              className="text-[var(--color-accent)] underline-offset-2 transition-colors hover:text-[var(--color-muted)] hover:underline"
            >
              {t("educational.sectionLink")}
            </Link>
          </p>
        </div>
      </details>
    </section>
  );
}
