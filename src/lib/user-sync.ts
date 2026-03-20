/**
 * 匿名進捗保存システム
 * LocalStorage を主軸、Vercel KV をバックアップ
 */

const ANON_ID_KEY = "wispo_anon_id";
const PAIR_LINK_KEY = "pair-link_completed";
const SKYSCRAPER_KEY = "skyscraper_completed";

export type UserData = {
  pairLink: { gridSize: number; timeSeconds: number; completedAt: string }[];
  skyscraper: { n: number; difficulty: string; timeSeconds: number; completedAt: string }[];
  updatedAt: string;
};

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** localStorage から anon_id を取得。なければ生成・保存して返す */
export function getOrCreateAnonId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(ANON_ID_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(ANON_ID_KEY, id);
  }
  return id;
}

/** localStorage から進捗を集約して UserData を構築 */
export function collectUserData(): UserData {
  if (typeof window === "undefined") {
    return { pairLink: [], skyscraper: [], updatedAt: new Date().toISOString() };
  }
  const pairLink = (() => {
    try {
      const raw = localStorage.getItem(PAIR_LINK_KEY);
      return raw ? (JSON.parse(raw) as UserData["pairLink"]) : [];
    } catch {
      return [];
    }
  })();
  const skyscraper = (() => {
    try {
      const raw = localStorage.getItem(SKYSCRAPER_KEY);
      return raw ? (JSON.parse(raw) as UserData["skyscraper"]) : [];
    } catch {
      return [];
    }
  })();
  return {
    pairLink,
    skyscraper,
    updatedAt: new Date().toISOString(),
  };
}

/** API に同期（ネットワークエラー時は localStorage のみで継続） */
export async function syncToApi(anonId: string, userData: UserData): Promise<boolean> {
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anon_id: anonId, userData }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
