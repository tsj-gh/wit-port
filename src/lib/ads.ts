/**
 * AdSense 動的リフレッシュロジック
 * ゲームサイクルに連動した googletag.pubads().refresh() の実行
 */

const AD_REFRESH_COOLDOWN_MS = 30 * 1000;
let lastRefreshAt = 0;
let lastTryTime = 0;
let refreshCount = 0;
let lastAttemptSkipped = false;

/** リフレッシュ成功時のカスタムイベント（プレースホルダーフラッシュ等） */
export const AD_REFRESH_EVENT = "pairlink:ad-refresh";
/** リフレッシュ試行後（成功/スキップ両方）の状態変更イベント（デバッグパネル用） */
export const AD_REFRESH_STATE_CHANGED = "pairlink:ad-refresh-state-changed";

export type AdsRefreshState = {
  lastRefreshAt: number;
  lastTryTime: number;
  refreshCount: number;
  lastAttemptSkipped: boolean;
};

/**
 * 広告リフレッシュ状態を取得（デバッグパネル用）
 */
export function getAdsRefreshState(): AdsRefreshState {
  return { lastRefreshAt, lastTryTime, refreshCount, lastAttemptSkipped };
}

function dispatchStateChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AD_REFRESH_STATE_CHANGED));
  }
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
  lastTryTime = now;

  if (now - lastRefreshAt < AD_REFRESH_COOLDOWN_MS) {
    lastAttemptSkipped = true;
    dispatchStateChanged();
    // eslint-disable-next-line no-console
    console.log("Refresh skipped: Cool-down active");
    return;
  }

  const googletag = window.googletag;
  if (!googletag?.pubads) {
    dispatchStateChanged();
    return;
  }

  lastRefreshAt = now;
  lastAttemptSkipped = false;
  refreshCount += 1;

  const doRefresh = () => {
    try {
      googletag.pubads().refresh();
      window.dispatchEvent(new CustomEvent(AD_REFRESH_EVENT));
      dispatchStateChanged();
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
