"use client";

import { useState, useEffect } from "react";
import { getOrInitWispoUserData, resetAllUserData } from "@/lib/wispo-user-data";
import { useUserSyncContext } from "@/components/UserSyncProvider";

const USER_DATA_UPDATED_EVENT = "wispo:userDataUpdated";

/**
 * デバッグパネル用: 累計クリア数・活動日数・全データリセット
 */
export function DevDebugUserStats() {
  const userSync = useUserSyncContext();
  const [refreshKey, setRefreshKey] = useState(0);
  const data = getOrInitWispoUserData();

  useEffect(() => {
    const onUpdated = () => setRefreshKey((k) => k + 1);
    window.addEventListener(USER_DATA_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(USER_DATA_UPDATED_EVENT, onUpdated);
  }, []);
  const totalClears =
    data.achievements.pairLink + data.achievements.skyscraper + data.achievements.pressureJudge;

  const handleReset = async () => {
    resetAllUserData();
    if (userSync?.saveProgressAndSync) {
      await userSync.saveProgressAndSync(() => {});
    }
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="mt-1 pt-1 border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] space-y-1">
      <div className="font-semibold text-[var(--color-muted)]">学習記録</div>
      <div>
        累計クリア数: <span className="tabular-nums text-[color-mix(in_srgb,var(--color-text)_88%,var(--color-bg))]">{totalClears}</span>
        <span className="text-[color-mix(in_srgb,var(--color-muted)_85%,var(--color-bg))] text-[9px] ml-1">
          (PL:{data.achievements.pairLink} SS:{data.achievements.skyscraper} PJ:{data.achievements.pressureJudge})
        </span>
      </div>
      <div>
        活動日数: <span className="tabular-nums text-[color-mix(in_srgb,var(--color-text)_88%,var(--color-bg))]">{data.totalActiveDays}</span>
      </div>
      <button
        onClick={handleReset}
        className="px-1 py-0.5 rounded text-[9px] border border-[color-mix(in_srgb,var(--color-accent)_45%,transparent)] bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30"
      >
        今日の進捗をリセット
      </button>
    </div>
  );
}
