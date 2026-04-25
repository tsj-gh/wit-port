type TroubleshootingItem = {
  issue: string;
  action: string;
};

type GameTroubleshootingSectionProps = {
  gameTitle: string;
  items: TroubleshootingItem[];
};

export function GameTroubleshootingSection({ gameTitle, items }: GameTroubleshootingSectionProps) {
  return (
    <section
      className="mx-auto mt-6 w-full max-w-[1080px] rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)] px-4 py-4 sm:px-5"
      aria-label={`${gameTitle} のつまずき対処`}
    >
      <h2 className="mb-2 text-base font-bold text-[var(--color-text)]">つまずき対処（{gameTitle}）</h2>
      <p className="mb-3 text-xs leading-relaxed text-[var(--color-muted)]">
        途中で止まりやすいポイントを、家庭ですぐ試せる対処とセットでまとめています。
      </p>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <article
            key={`${item.issue}-${idx}`}
            className="rounded-xl border border-[color-mix(in_srgb,var(--color-text)_9%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_88%,var(--color-bg))] px-3 py-2"
          >
            <p className="m-0 text-sm font-semibold text-[var(--color-text)]">つまずき: {item.issue}</p>
            <p className="mt-1 m-0 text-xs leading-relaxed text-[var(--color-muted)]">対処: {item.action}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
