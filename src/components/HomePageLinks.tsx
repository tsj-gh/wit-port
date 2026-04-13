"use client";

import { DevLink } from "./DevLink";
import { HOME_GAME_CARDS, HOME_GAME_SECTIONS, type HomeGameCardId } from "@/lib/homeGameCatalog";
import { useI18n } from "@/lib/i18n-context";

const cardShellClassName =
  "group relative flex flex-col rounded-2xl p-8 overflow-hidden no-underline text-[var(--color-text)] border border-[var(--wit-border)] bg-[var(--wit-card-bg)] backdrop-blur-[10px] transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-2 hover:shadow-[0_20px_40px_color-mix(in_srgb,var(--color-text)_16%,transparent),0_0_20px_color-mix(in_srgb,var(--color-primary)_32%,transparent)] hover:border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] after:absolute after:inset-0 after:content-[''] after:bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--color-primary)_22%,transparent),transparent_50%)] after:opacity-0 after:transition-opacity after:duration-300 group-hover:after:opacity-100";

function HomeGameCard({ cardId }: { cardId: HomeGameCardId }) {
  const { t } = useI18n();
  const def = HOME_GAME_CARDS[cardId];
  const playLabel = t(def.playLabelKey);

  return (
    <DevLink href={def.href} className={cardShellClassName}>
      <span className="mb-6 inline-block animate-float text-5xl">{def.emoji}</span>
      <h3 className="mb-3 text-2xl font-bold">{t(def.titleKey)}</h3>
      <p className="mb-6 flex-grow text-[15px] leading-relaxed text-[var(--color-muted)]">{t(def.descKey)}</p>
      <div className="flex min-h-[52px] w-full flex-wrap items-center justify-center gap-2 whitespace-normal rounded-xl bg-[var(--color-primary)] px-4 py-3 text-center text-base font-bold text-[var(--color-on-primary)] transition-colors group-hover:brightness-95 sm:px-6">
        {playLabel}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </DevLink>
  );
}

/**
 * トップページのゲーム一覧（devtj 維持の DevLink）。性質別セクション＋グリッド。
 */
export function HomePageLinks() {
  const { t } = useI18n();

  return (
    <div className="space-y-14 pb-10 animate-fade-in-up-delay-more">
      {HOME_GAME_SECTIONS.map((section, idx) => (
        <section key={section.id} className={idx > 0 ? "border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] pt-14" : ""}>
          <div className="mb-6 rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
            <h2 className="text-lg font-bold text-[var(--color-text)]">{t(section.titleKey)}</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">{t(section.catchphraseKey)}</p>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {section.cardIds.map((cardId) => (
              <HomeGameCard key={cardId} cardId={cardId} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
