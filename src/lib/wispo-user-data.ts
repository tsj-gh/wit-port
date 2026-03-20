/**
 * wispo_user_data: 学習記録ベースのユーザーデータ構造
 * localStorage および Vercel KV に保存
 */

export type WispoUserData = {
  firstLaunchDate: string; // YYYY-MM-DD
  lastActivityDate: string; // YYYY-MM-DD
  totalActiveDays: number;
  achievements: {
    pairLink: number;
    skyscraper: number;
    pressureJudge: number;
  };
  dailyTraverse: {
    date: string; // YYYY-MM-DD
    completedIds: string[]; // 例: ["skyscraper", "pairLink"]
  };
};

const STORAGE_KEY = "wispo_user_data";

function todayYYYYMMDD(): string {
  return new Date().toISOString().slice(0, 10);
}

function createInitialData(): WispoUserData {
  const today = todayYYYYMMDD();
  return {
    firstLaunchDate: today,
    lastActivityDate: today,
    totalActiveDays: 0,
    achievements: { pairLink: 0, skyscraper: 0, pressureJudge: 0 },
    dailyTraverse: { date: today, completedIds: [] },
  };
}

/** localStorage から wispo_user_data を取得。なければ null */
export function getWispoUserData(): WispoUserData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WispoUserData;
    if (
      typeof parsed.firstLaunchDate !== "string" ||
      typeof parsed.lastActivityDate !== "string" ||
      typeof parsed.totalActiveDays !== "number" ||
      !parsed.achievements ||
      !parsed.dailyTraverse
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** 取得。なければ初期化して返す */
export function getOrInitWispoUserData(): WispoUserData {
  const existing = getWispoUserData();
  if (existing) return existing;
  const initial = createInitialData();
  saveWispoUserData(initial);
  return initial;
}

/** localStorage に保存 */
export function saveWispoUserData(data: WispoUserData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export type PuzzleGameId = "pairLink" | "skyscraper" | "pressureJudge";

/**
 * パズルクリア時に呼び出す。
 * - achievements を +1
 * - lastActivityDate が今日でなければ totalActiveDays を +1 し日付更新
 * - 今日の dailyTraverse.completedIds に ID を追加
 */
export function recordPuzzleClear(gameId: PuzzleGameId): WispoUserData {
  const data = getOrInitWispoUserData();
  const today = todayYYYYMMDD();

  const nextAchievements = { ...data.achievements };
  if (gameId in nextAchievements) {
    nextAchievements[gameId as keyof typeof nextAchievements]++;
  }

  let nextTotalActiveDays = data.totalActiveDays;
  let nextLastActivityDate = data.lastActivityDate;
  // 初回クリア時（totalActiveDays=0）は 1 にする。それ以外は lastActivityDate が今日でなければ +1
  if (data.totalActiveDays === 0) {
    nextTotalActiveDays = 1;
    nextLastActivityDate = today;
  } else if (data.lastActivityDate !== today) {
    nextTotalActiveDays++;
    nextLastActivityDate = today;
  }

  let nextDailyTraverse = data.dailyTraverse;
  if (nextDailyTraverse.date !== today) {
    nextDailyTraverse = { date: today, completedIds: [] };
  }
  const completedIds = [...nextDailyTraverse.completedIds];
  if (!completedIds.includes(gameId)) {
    completedIds.push(gameId);
  }
  nextDailyTraverse = { ...nextDailyTraverse, completedIds };

  const next: WispoUserData = {
    ...data,
    achievements: nextAchievements,
    totalActiveDays: nextTotalActiveDays,
    lastActivityDate: nextLastActivityDate,
    dailyTraverse: nextDailyTraverse,
  };

  saveWispoUserData(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("wispo:userDataUpdated"));
  }
  return next;
}

/** 今日の進捗をリセット（デバッグ用） */
export function resetDailyTraverse(): WispoUserData {
  const data = getOrInitWispoUserData();
  const today = todayYYYYMMDD();
  const next: WispoUserData = {
    ...data,
    dailyTraverse: { date: today, completedIds: [] },
  };
  saveWispoUserData(next);
  return next;
}

/** 全データを初期化（デバッグ用：累計・活動日数・今日の進捗を 0 にリセットし KV にも反映） */
export function resetAllUserData(): WispoUserData {
  const initial = createInitialData();
  saveWispoUserData(initial);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("wispo:userDataUpdated"));
  }
  return initial;
}
