"use client";

import { DevLink } from "./DevLink";
import { useI18n } from "@/lib/i18n-context";

/**
 * トップページのゲームカードグリッド（devtj パラメータ維持）
 */
export function HomePageLinks() {
  const { t } = useI18n();

  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 animate-fade-in-up-delay-more">
        <DevLink
          href="/lab/pair-link"
          className="group relative flex flex-col rounded-2xl p-8 overflow-hidden no-underline text-[var(--color-text)] border border-[var(--wit-border)] bg-[var(--wit-card-bg)] backdrop-blur-[10px] transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-2 hover:shadow-[0_20px_40px_color-mix(in_srgb,var(--color-text)_16%,transparent),0_0_20px_color-mix(in_srgb,var(--color-primary)_32%,transparent)] hover:border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] after:absolute after:inset-0 after:content-[''] after:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_50%)] after:opacity-0 after:transition-opacity after:duration-300 group-hover:after:opacity-100"
        >
          <span className="text-5xl mb-6 inline-block animate-float">✨</span>
          <h2 className="text-2xl font-bold mb-3">{t("home.cardPairLinkTitle")}</h2>
          <p className="text-[var(--color-muted)] text-[15px] leading-relaxed flex-grow mb-6">
            {t("home.cardPairLinkDesc")}
          </p>
          <div className="flex min-h-[52px] w-full flex-wrap items-center justify-center gap-2 whitespace-normal rounded-xl bg-[var(--color-primary)] px-4 py-3 text-center text-base font-bold text-[var(--color-on-primary)] transition-colors group-hover:brightness-95 sm:px-6">
            {t("home.playDepart")}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </DevLink>

        <DevLink
          href="/lab/reflec-shot"
          className="group relative flex flex-col rounded-2xl p-8 overflow-hidden no-underline text-[var(--color-text)] border border-[var(--wit-border)] bg-[var(--wit-card-bg)] backdrop-blur-[10px] transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-2 hover:shadow-[0_20px_40px_color-mix(in_srgb,var(--color-text)_16%,transparent),0_0_20px_color-mix(in_srgb,var(--color-primary)_32%,transparent)] hover:border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] after:absolute after:inset-0 after:content-[''] after:bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.12),transparent_50%)] after:opacity-0 after:transition-opacity after:duration-300 group-hover:after:opacity-100"
        >
          <span className="text-5xl mb-6 inline-block animate-float">🪞</span>
          <h2 className="text-2xl font-bold mb-3">{t("home.cardReflecTitle")}</h2>
          <p className="text-[var(--color-muted)] text-[15px] leading-relaxed flex-grow mb-6">
            {t("home.cardReflecDesc")}
          </p>
          <div className="flex min-h-[52px] w-full flex-wrap items-center justify-center gap-2 whitespace-normal rounded-xl bg-[var(--color-primary)] px-4 py-3 text-center text-base font-bold text-[var(--color-on-primary)] transition-colors group-hover:brightness-95 sm:px-6">
            {t("home.playDepart")}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </DevLink>

        <DevLink
          href="/lab/skyscraper"
          className="group relative flex flex-col rounded-2xl p-8 overflow-hidden no-underline text-[var(--color-text)] border border-[var(--wit-border)] bg-[var(--wit-card-bg)] backdrop-blur-[10px] transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-2 hover:shadow-[0_20px_40px_color-mix(in_srgb,var(--color-text)_16%,transparent),0_0_20px_color-mix(in_srgb,var(--color-primary)_28%,transparent)] hover:border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] after:absolute after:inset-0 after:content-[''] after:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_50%)] after:opacity-0 after:transition-opacity after:duration-300 group-hover:after:opacity-100"
        >
          <span className="text-5xl mb-6 inline-block animate-float">🏢</span>
          <h2 className="text-2xl font-bold mb-3">{t("home.cardSkyTitle")}</h2>
          <p className="text-[var(--color-muted)] text-[15px] leading-relaxed flex-grow mb-6">
            {t("home.cardSkyDesc")}
          </p>
          <div className="flex min-h-[52px] w-full flex-wrap items-center justify-center gap-2 whitespace-normal rounded-xl bg-[var(--color-primary)] px-4 py-3 text-center text-base font-bold text-[var(--color-on-primary)] transition-colors group-hover:brightness-95 sm:px-6">
            {t("home.playDepart")}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </DevLink>

        <DevLink
          href="/lab/pres-sure-judge"
          className="group relative flex flex-col rounded-2xl p-8 overflow-hidden no-underline text-[var(--color-text)] border border-[var(--wit-border)] bg-[var(--wit-card-bg)] backdrop-blur-[10px] transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-2 hover:shadow-[0_20px_40px_color-mix(in_srgb,var(--color-text)_16%,transparent),0_0_20px_color-mix(in_srgb,var(--color-primary)_32%,transparent)] hover:border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] after:absolute after:inset-0 after:content-[''] after:bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.15),transparent_50%)] after:opacity-0 after:transition-opacity after:duration-300 group-hover:after:opacity-100"
        >
          <span className="text-5xl mb-6 inline-block animate-float">⚖️</span>
          <h2 className="text-2xl font-bold mb-3">{t("home.cardPresTitle")}</h2>
          <p className="text-[var(--color-muted)] text-[15px] leading-relaxed flex-grow mb-6">
            {t("home.cardPresDesc")}
          </p>
          <div className="flex min-h-[52px] w-full flex-wrap items-center justify-center gap-2 whitespace-normal rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-center text-base font-bold text-[var(--color-text)] transition-colors group-hover:brightness-95 sm:px-6">
            {t("home.playChallenge")}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </DevLink>
      </section>

      <div className="mb-10 flex flex-col items-center gap-3 px-0 animate-fade-in-up-delay-more">
        <DevLink
          href="/columns/educational-value"
          className="inline-flex w-full max-w-xl min-h-[52px] items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-bg))] px-4 py-3 text-center text-base font-semibold leading-snug text-[var(--color-muted)] no-underline transition-colors hover:bg-[color-mix(in_srgb,var(--color-primary)_20%,var(--color-bg))] sm:w-auto sm:min-w-[280px] sm:px-6 sm:py-3.5"
        >
          {t("home.columnCta")}
        </DevLink>
      </div>
    </>
  );
}
