/**
 * GPT (Google Publisher Tag) 型定義
 * AdSense / AdMob の googletag グローバル用
 */
interface Googletag {
  cmd: Array<() => void>;
  pubads: () => {
    refresh: (slots?: unknown) => void;
    isInitialLoadDone: boolean;
  };
  defineSlot: (path: string, size: number[] | number[][], divId: string) => unknown;
  enableServices: () => void;
  display: (divId: string) => void;
}

declare global {
  interface Window {
    googletag?: Googletag;
  }
}

export {};
