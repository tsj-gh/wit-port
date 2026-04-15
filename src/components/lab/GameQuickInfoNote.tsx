type GameQuickInfoNoteProps = {
  goal: string;
  target: string;
  operation: string;
};

/**
 * プレイ領域直下の補助テキスト。
 * 視覚的には控えめ、検索クローラーには主目的を明示する。
 */
export function GameQuickInfoNote({ goal, target, operation }: GameQuickInfoNoteProps) {
  return (
    <section
      className="mt-3 rounded-xl border border-[color-mix(in_srgb,var(--color-text)_9%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-muted)]"
      aria-label="この知育ゲームのクイックインフォ"
    >
      <p className="m-0">【ねらい】{goal}</p>
      <p className="m-0">【対象】{target}</p>
      <p className="m-0">【操作】{operation}</p>
    </section>
  );
}
