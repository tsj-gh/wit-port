"use client";

import { Suspense } from "react";
import { PageHeaderWithDevLinks } from "@/components/PageHeaderWithDevLinks";
import { ContactLink } from "@/components/ContactLink";
import { useI18n } from "@/lib/i18n-context";

export function PrivacyPageContent() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-[720px] w-full px-6">
      <Suspense
        fallback={
          <header className="flex justify-between items-center py-8">
            <a href="/" className="text-wit-text font-black">
              Wispo
            </a>
            <a href="/" className="text-wit-muted text-sm">
              ←
            </a>
          </header>
        }
      >
        <PageHeaderWithDevLinks />
      </Suspense>

      <main className="pb-20">
        <h1 className="text-2xl sm:text-3xl font-bold mb-8 text-wit-text">{t("privacy.title")}</h1>
        <p className="text-wit-muted text-sm mb-6">{t("privacy.updated")}</p>

        <article className="rounded-2xl p-6 sm:p-8 border border-white/10 bg-white/5 backdrop-blur">
          <p className="text-wit-muted leading-relaxed mb-6">{t("privacy.intro")}</p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">{t("privacy.s1Title")}</h2>
          <p className="text-wit-muted leading-relaxed mb-4">{t("privacy.s1Body")}</p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">{t("privacy.s2Title")}</h2>
          <p className="text-wit-muted leading-relaxed mb-4">{t("privacy.s2Body")}</p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">{t("privacy.s3Title")}</h2>
          <p className="text-wit-muted leading-relaxed mb-2">{t("privacy.s3Intro")}</p>
          <ul className="list-disc list-inside text-wit-muted space-y-2 mb-4">
            <li>{t("privacy.purpose1")}</li>
            <li>{t("privacy.purpose2")}</li>
            <li>{t("privacy.purpose3")}</li>
            <li>{t("privacy.purpose4")}</li>
            <li>{t("privacy.purpose5")}</li>
          </ul>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">{t("privacy.s4Title")}</h2>
          <p className="text-wit-muted leading-relaxed mb-4">{t("privacy.adsP1")}</p>
          <p className="text-wit-muted leading-relaxed mb-4">{t("privacy.adsP2")}</p>
          <p className="text-wit-muted leading-relaxed mb-4">{t("privacy.adsP3")}</p>
          <p className="text-wit-muted leading-relaxed mb-4">
            {t("privacy.adsP4Prefix")}
            <a
              href="https://www.aboutads.info"
              target="_blank"
              rel="noopener noreferrer"
              className="text-wit-accent hover:underline"
            >
              www.aboutads.info
            </a>
            {t("privacy.adsP4Suffix")}
          </p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">{t("privacy.s5Title")}</h2>
          <p className="text-wit-muted leading-relaxed mb-4">{t("privacy.s5Body")}</p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">{t("privacy.s6Title")}</h2>
          <p className="text-wit-muted leading-relaxed mb-4">{t("privacy.s6b1")}</p>
          <p className="text-wit-muted leading-relaxed mb-4">{t("privacy.s6b2")}</p>
          <p className="text-wit-muted leading-relaxed mb-4">{t("privacy.s6b3")}</p>
          <p className="text-wit-muted leading-relaxed mb-4">{t("privacy.s6b4")}</p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">{t("privacy.s7Title")}</h2>
          <p className="text-wit-muted leading-relaxed mb-4">{t("privacy.s7Body")}</p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">{t("privacy.s8Title")}</h2>
          <p className="text-wit-muted leading-relaxed mb-2">{t("privacy.s8Intro")}</p>
          <p className="text-wit-muted leading-relaxed mb-2">{t("privacy.s8Operator")}</p>
          <p className="text-wit-muted leading-relaxed">
            <Suspense
              fallback={
                <a href="/contact" className="text-wit-accent hover:underline">
                  {t("contact.urlDisplay")}
                </a>
              }
            >
              <ContactLink className="text-wit-accent hover:underline">{t("contact.urlDisplay")}</ContactLink>
            </Suspense>
          </p>
        </article>
      </main>
    </div>
  );
}
