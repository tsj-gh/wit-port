"use client";

import { useEffect, useRef, useState } from "react";
import { DevLink } from "./DevLink";
import { HOME_GAME_CARDS, HOME_GAME_SECTIONS, type HomeGameCardId } from "@/lib/homeGameCatalog";
import { useI18n } from "@/lib/i18n-context";

const cardWrapClassName =
  "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--wit-border)] bg-[var(--wit-card-bg)] backdrop-blur-[10px] transition-all duration-200 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] hover:shadow-[0_12px_28px_color-mix(in_srgb,var(--color-text)_12%,transparent),0_0_16px_color-mix(in_srgb,var(--color-primary)_22%,transparent)] after:pointer-events-none after:absolute after:inset-0 after:z-0 after:content-[''] after:bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--color-primary)_18%,transparent),transparent_55%)] after:opacity-0 after:transition-opacity after:duration-200 group-hover:after:opacity-100";

const gameLinkClassName =
  "relative z-[1] flex min-h-0 flex-1 flex-col p-3 pr-9 text-[var(--color-text)] no-underline md:p-3.5 md:pr-10";

function HomeGameCard({ cardId }: { cardId: HomeGameCardId }) {
  const { t } = useI18n();
  const def = HOME_GAME_CARDS[cardId];
  const [isTooltipPinned, setIsTooltipPinned] = useState(false);
  const tooltipRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isTooltipPinned) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!tooltipRootRef.current) return;
      if (!tooltipRootRef.current.contains(event.target as Node)) {
        setIsTooltipPinned(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsTooltipPinned(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTooltipPinned]);

  const tooltipPanelClassName = isTooltipPinned
    ? "pointer-events-auto translate-y-0 opacity-100"
    : "pointer-events-none translate-y-1 opacity-0 group-hover/tooltip:pointer-events-auto group-hover/tooltip:translate-y-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:pointer-events-auto group-focus-within/tooltip:translate-y-0 group-focus-within/tooltip:opacity-100";

  return (
    <div className={cardWrapClassName}>
      <DevLink href={def.href} className={gameLinkClassName}>
        <span className="mb-1 inline-block shrink-0 animate-float text-5xl leading-none">{def.emoji}</span>
        <h3 className="mb-1.5 line-clamp-2 text-base font-bold leading-tight tracking-tight">{t(def.titleKey)}</h3>
        <div className="mt-auto flex min-h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-2.5 py-1.5 text-center text-sm font-bold text-[var(--color-on-primary)] transition-colors group-hover:brightness-95">
          {t("home.play")}
          <svg className="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </DevLink>
      <div ref={tooltipRootRef} className="group/tooltip absolute right-1.5 top-1.5 z-[5]">
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-full border border-[color-mix(in_srgb,var(--color-text)_14%,transparent)] bg-[color-mix(in_srgb,var(--wit-card-bg)_88%,transparent)] text-xs font-bold text-[var(--color-muted)] shadow-sm backdrop-blur-sm transition-colors hover:border-[color-mix(in_srgb,var(--color-accent)_40%,transparent)] hover:text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          aria-label={t("home.educationColumnAria")}
          title={t("home.educationColumnAria")}
          aria-expanded={isTooltipPinned}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsTooltipPinned((current) => !current);
          }}
        >
          ?
        </button>
        <div
          className={`absolute right-0 top-8 w-56 rounded-xl border border-[color-mix(in_srgb,#ffffff_16%,transparent)] bg-[#333333] px-3 py-2 text-xs leading-snug text-white shadow-[0_12px_24px_rgba(0,0,0,0.35)] transition-all duration-150 ease-out ${tooltipPanelClassName}`}
        >
          <p>{t(def.tooltipKey)}</p>
          <DevLink
            href="/columns/educational-value"
            className="mt-1 inline-block text-[11px] font-semibold text-[color-mix(in_srgb,#ffffff_88%,#9be7ff_12%)] underline-offset-2 hover:underline"
            onClick={() => setIsTooltipPinned(false)}
          >
            {t("home.tooltipMoreLink")}
          </DevLink>
        </div>
      </div>
    </div>
  );
}

/**
 * トップページのゲーム一覧（devtj 維持の DevLink）。性質別セクション＋グリッド。
 */
export function HomePageLinks() {
  const { t } = useI18n();

  return (
    <div className="space-y-3 pb-6 animate-fade-in-up-delay-more md:space-y-4">
      {HOME_GAME_SECTIONS.map((section, idx) => (
        <section key={section.id} className={idx > 0 ? "border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] pt-3 md:pt-4" : ""}>
          <header className="mb-1 md:mb-1">
            <h2 className="text-sm font-bold leading-tight text-[var(--color-text)] md:text-base">{t(section.titleKey)}</h2>
          </header>
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 min-[360px]:gap-2.5 md:grid-cols-3 md:gap-3">
            {section.cardIds.map((cardId) => (
              <HomeGameCard key={cardId} cardId={cardId} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
