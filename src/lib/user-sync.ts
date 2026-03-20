/**
 * 匿名進捗保存システム
 * LocalStorage (wispo_user_data) を主軸、Vercel KV をバックアップ
 */

import type { WispoUserData } from "./wispo-user-data";
import { getOrInitWispoUserData } from "./wispo-user-data";

const ANON_ID_KEY = "wispo_anon_id";

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

/** localStorage から wispo_user_data を取得して返す */
export function collectUserData(): WispoUserData {
  if (typeof window === "undefined") {
    return {
      firstLaunchDate: new Date().toISOString().slice(0, 10),
      lastActivityDate: new Date().toISOString().slice(0, 10),
      totalActiveDays: 0,
      achievements: { pairLink: 0, skyscraper: 0, pressureJudge: 0 },
      dailyTraverse: { date: new Date().toISOString().slice(0, 10), completedIds: [] },
    };
  }
  return getOrInitWispoUserData();
}

/** API に同期（ネットワークエラー時は localStorage のみで継続） */
export async function syncToApi(anonId: string, userData: WispoUserData): Promise<boolean> {
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
