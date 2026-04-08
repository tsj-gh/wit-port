"use client";

import Link from "next/link";
import { DevLink } from "@/components/DevLink";
import { HomePageLinks } from "@/components/HomePageLinks";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n-context";

export function HomePageClient() {
  const { t } = useI18n();

  return (
    <>
      <header className="flex w-full items-center justify-between gap-3 py-6 animate-fade-in-up">
        <DevLink
          href="/"
          className="flex min-w-0 items-center gap-3 text-xl font-black leading-none tracking-wider text-[var(--color-text)] no-underline hover:opacity-90 sm:text-2xl"
        >
          <span className="block h-8 w-8 shrink-0 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[color-mix(in_srgb,var(--color-accent)_70%,var(--color-primary))]" />
          Wispo
        </DevLink>
        <LanguageToggle />
      </header>

      <section className="pb-16 pt-4 text-center animate-fade-in-up-delay sm:pt-2">
        <h1 className="mb-6 text-[clamp(32px,5vw,56px)] font-extrabold leading-tight bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent">
          {t("home.heroTitle")}
        </h1>
        <p className="mx-auto max-w-[600px] text-[clamp(16px,2vw,20px)] leading-relaxed text-[var(--color-muted)]">
          {t("home.heroLine1")}
          <br />
          {t("home.heroLine2")}
        </p>
      </section>

      <HomePageLinks />

      <section className="animate-fade-in-up-delay-more border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] pb-8 pt-12">
        <h2 className="mb-4 text-xl font-bold text-[var(--color-text)]">{t("home.sectionColumnTitle")}</h2>
        <p className="mb-4 leading-relaxed text-[var(--color-muted)]">{t("home.sectionColumnBody")}</p>
        <p className="mb-6">
          <Link
            href="/columns/educational-value"
            className="inline-flex items-center font-medium text-[var(--color-accent)] underline-offset-2 hover:text-[var(--color-muted)] hover:underline"
          >
            {t("home.sectionColumnLink")}
          </Link>
        </p>
        <h2 className="mb-4 text-xl font-bold text-[var(--color-text)]">{t("home.sectionAboutTitle")}</h2>
        <p className="mb-4 leading-relaxed text-[var(--color-muted)]">{t("home.sectionAboutBody")}</p>
        <h2 className="mb-3 mt-6 text-lg font-bold text-[var(--color-text)]">{t("home.sectionUsageTitle")}</h2>
        <p className="mb-4 leading-relaxed text-[var(--color-muted)]">
          {t("home.sectionUsageBeforeContact")}
          <a href="/contact" className="text-[var(--color-accent)] hover:underline">
            {t("home.sectionUsageContact")}
          </a>
          {t("home.sectionUsageMid")}
          <a href="/privacy" className="text-[var(--color-accent)] hover:underline">
            {t("home.sectionUsagePrivacy")}
          </a>
          {t("home.sectionUsageAfter")}
        </p>
      </section>
    </>
  );
}
