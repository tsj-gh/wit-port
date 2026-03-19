/**
 * AdSense 動的リフレッシュロジック
 * ゲームサイクルに連動した googletag.pubads().refresh() の実行
 */

const AD_REFRESH_COOLDOWN_MS = 30 * 1000;
let lastRefreshAt = 0;
let refreshCount = 0;

/** リフレッシュ時のカスタムイベント名（デバッグ用プレースホルダーフラッシュ等） */
export const AD_REFRESH_EVENT = "pairlink:ad-refresh";

export type AdsRefreshState = {
  lastRefreshAt: number;
  refreshCount: number;
};

/**
 * 広告リフレッシュ状態を取得（デバッグパネル用）
 */
export function getAdsRefreshState(): AdsRefreshState {
  return { lastRefreshAt, refreshCount };
}

/**
 * GPT (Google Publisher Tag) を用いて広告をリフレッシュする共通関数。
 * - 30秒以上のインターバルを強制（Cooldown）
 * - requestIdleCallback / setTimeout で非同期実行しメインスレッドをブロックしない
 * - AdBlock 等で googletag が存在しない場合は静かに何もしない
 */
export function refreshAds(): void {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastRefreshAt < AD_REFRESH_COOLDOWN_MS) return;

  const googletag = window.googletag;
  if (!googletag?.pubads) return;

  lastRefreshAt = now;
  refreshCount += 1;

  const doRefresh = () => {
    try {
      googletag.pubads().refresh();
      window.dispatchEvent(new CustomEvent(AD_REFRESH_EVENT));
    } catch {
      // AdBlock 等でタグが読み込まれない場合: ゲームの進行を妨げない
    }
  };

  const runAsync = () => {
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(doRefresh, { timeout: 100 });
    } else {
      setTimeout(doRefresh, 0);
    }
  };

  runAsync();
}
