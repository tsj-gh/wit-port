type ParentGuideNoteProps = {
  gameTitle: string;
  text: string;
};

export function ParentGuideNote({ gameTitle, text }: ParentGuideNoteProps) {
  return (
    <section
      className="mx-auto mt-4 w-full max-w-[1080px] rounded-xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)] px-4 py-3"
      aria-label={`${gameTitle} の保護者向け使い方`}
    >
      <h2 className="m-0 text-sm font-bold text-[var(--color-text)]">保護者向け使い方（{gameTitle}）</h2>
      <p className="mt-1.5 m-0 text-xs leading-relaxed text-[var(--color-muted)]">{text}</p>
    </section>
  );
}
