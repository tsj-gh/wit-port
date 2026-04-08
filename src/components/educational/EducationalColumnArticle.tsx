"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n-context";

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-12 scroll-mt-24 border-b border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] pb-2 text-xl font-bold text-[var(--color-text)] first:mt-0"
    >
      {children}
    </h2>
  );
}

function PlayLink({ href, labelKey }: { href: string; labelKey: string }) {
  const { t } = useI18n();
  return (
    <p className="mt-6">
      <Link
        href={href}
        className="inline-flex min-h-[44px] max-w-full flex-wrap items-center rounded-lg border border-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-bg))] px-4 py-2 text-sm font-semibold leading-snug text-[var(--color-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-primary)_20%,var(--color-bg))]"
      >
        {t(labelKey)}
      </Link>
    </p>
  );
}

export function EducationalColumnArticle() {
  const { t } = useI18n();
  const c = "column";

  return (
    <article className="text-sm leading-relaxed text-[var(--color-muted)] md:text-base">
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">{t(`${c}.kicker`)}</p>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-[var(--color-text)] md:text-3xl">{t(`${c}.title`)}</h1>

      <section className="space-y-4 rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] p-6 backdrop-blur">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{t(`${c}.introHeading`)}</h2>
        <p>{t(`${c}.introP1`)}</p>
        <p>{t(`${c}.introP2`)}</p>
        <p>{t(`${c}.introP3`)}</p>
      </section>

      <nav
        className="mt-10 rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_35%,var(--color-bg))] p-4 text-[var(--color-text)]"
        aria-label="Table of contents"
      >
        <p className="mb-2 text-xs font-semibold text-[var(--color-muted)]">{t(`${c}.tocLabel`)}</p>
        <ul className="list-inside list-disc space-y-1 text-sm">
          <li>
            <a href="#pair-link" className="text-[var(--color-accent)] hover:underline">
              {t(`${c}.tocPair`)}
            </a>
          </li>
          <li>
            <a href="#reflec-shot" className="text-[var(--color-accent)] hover:underline">
              {t(`${c}.tocReflec`)}
            </a>
          </li>
          <li>
            <a href="#skyscraper" className="text-[var(--color-accent)] hover:underline">
              {t(`${c}.tocSky`)}
            </a>
          </li>
          <li>
            <a href="#pres-sure" className="text-[var(--color-accent)] hover:underline">
              {t(`${c}.tocPres`)}
            </a>
          </li>
        </ul>
      </nav>

      <SectionTitle id="pair-link">{t(`${c}.s1Title`)}</SectionTitle>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s1hDev`)}</h3>
      <p>{t(`${c}.s1pDev`)}</p>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s1hNeuro`)}</h3>
      <p>{t(`${c}.s1pNeuro`)}</p>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s1hMont`)}</h3>
      <p>{t(`${c}.s1pMont`)}</p>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s1hStep`)}</h3>
      <p>{t(`${c}.s1pStep`)}</p>
      <PlayLink href="/lab/pair-link" labelKey={`${c}.playPair`} />

      <SectionTitle id="reflec-shot">{t(`${c}.s2Title`)}</SectionTitle>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s2hDev`)}</h3>
      <p>{t(`${c}.s2pDev`)}</p>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s2hNeuro`)}</h3>
      <p>{t(`${c}.s2pNeuro`)}</p>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s2hMont`)}</h3>
      <p>{t(`${c}.s2pMont`)}</p>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s2hStep`)}</h3>
      <p>{t(`${c}.s2pStep`)}</p>
      <PlayLink href="/lab/reflec-shot" labelKey={`${c}.playReflec`} />

      <SectionTitle id="skyscraper">{t(`${c}.s3Title`)}</SectionTitle>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s3hDev`)}</h3>
      <p>{t(`${c}.s3pDev`)}</p>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s3hNeuro`)}</h3>
      <p>{t(`${c}.s3pNeuro`)}</p>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s3hMont`)}</h3>
      <p>{t(`${c}.s3pMont`)}</p>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s3hStep`)}</h3>
      <p>{t(`${c}.s3pStep`)}</p>
      <PlayLink href="/lab/skyscraper" labelKey={`${c}.playSky`} />

      <SectionTitle id="pres-sure">{t(`${c}.s4Title`)}</SectionTitle>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s4hDev`)}</h3>
      <p>{t(`${c}.s4pDev`)}</p>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s4hNeuro`)}</h3>
      <p>{t(`${c}.s4pNeuro`)}</p>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s4hMont`)}</h3>
      <p>{t(`${c}.s4pMont`)}</p>
      <h3 className="mt-4 font-semibold text-[var(--color-text)]">{t(`${c}.s4hStep`)}</h3>
      <p>{t(`${c}.s4pStep`)}</p>
      <PlayLink href="/lab/pres-sure-judge" labelKey={`${c}.playPres`} />

      <p className="mt-12 border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] pt-8 text-center text-xs text-[var(--color-muted)]">
        <Link href="/" className="text-[var(--color-accent)] hover:underline">
          {t(`${c}.backTop`)}
        </Link>
      </p>
    </article>
  );
}
