"use client";

import { getOrInitWispoUserData, resetDailyTraverse } from "@/lib/wispo-user-data";
import { useUserSyncContext } from "@/components/UserSyncProvider";

/**
 * デバッグパネル用: 累計クリア数・活動日数・今日の進捗リセット
 */
export function DevDebugUserStats() {
  const userSync = useUserSyncContext();
  const data = getOrInitWispoUserData();
  const totalClears =
    data.achievements.pairLink + data.achievements.skyscraper + data.achievements.pressureJudge;

  const handleReset = () => {
    resetDailyTraverse();
    if (userSync?.saveProgressAndSync) {
      userSync.saveProgressAndSync(() => {}).catch(() => {});
    }
  };

  return (
    <div className="mt-1 pt-1 border-t border-white/10 space-y-1">
      <div className="font-semibold text-slate-300">学習記録</div>
      <div>
        累計クリア数: <span className="tabular-nums text-slate-200">{totalClears}</span>
        <span className="text-slate-500 text-[9px] ml-1">
          (PL:{data.achievements.pairLink} SS:{data.achievements.skyscraper} PJ:{data.achievements.pressureJudge})
        </span>
      </div>
      <div>
        活動日数: <span className="tabular-nums text-slate-200">{data.totalActiveDays}</span>
      </div>
      <button
        onClick={handleReset}
        className="px-1 py-0.5 rounded text-[9px] border border-amber-500/50 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
      >
        今日の進捗をリセット
      </button>
    </div>
  );
}
