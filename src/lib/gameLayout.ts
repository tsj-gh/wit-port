/**
 * ゲーム本編（ヘッダー・広告・盤面・操作UI）の共通最大幅。
 * Tailwind のクラス文字列としてそのまま使用する（JIT 検出用に分割しない）。
 */
export const GAME_COLUMN_CLASS = "mx-auto w-full max-w-[520px]";

/** Pres-Sure Judge 用（640px 列） */
export const GAME_COLUMN_CLASS_WIDE = "mx-auto w-full max-w-[640px]";

/** 広告#1 の下〜盤面セクションまでの縦余白（誤タップ防止の最低 24px を満たす） */
export const GAME_AD_GAP_AFTER_SLOT_1_PX = 24;

/** 操作UI〜広告#2 までの縦余白（誤タップ防止の最低 24px を満たす） */
export const GAME_AD_GAP_BEFORE_SLOT_2_PX = 32;

/** 広告スロットの最小高さ（プレースホルダー・CLS 対策） */
export const GAME_AD_SLOT_MIN_HEIGHT_PX = 100;

/** 「スポンサーリンク」行（font-size 10px + margin-bottom 4px の概算） */
export const GAME_AD_SPONSOR_LABEL_BLOCK_PX = 14;

/** 広告枠ラッパーの上下パディング（各辺・空枠でもレイアウト安定） */
export const GAME_AD_SLOT_FRAME_PADDING_Y_PX = 8;

/**
 * ヘッダー直下に広告#1 を置いたとき、ヘッダー下縁からメイン操作域までに見積もる縦幅
 */
export const GAME_TOP_AD_RESERVED_PX =
  GAME_AD_SLOT_FRAME_PADDING_Y_PX * 2 +
  GAME_AD_SPONSOR_LABEL_BLOCK_PX +
  GAME_AD_SLOT_MIN_HEIGHT_PX +
  GAME_AD_GAP_AFTER_SLOT_1_PX +
  32;
