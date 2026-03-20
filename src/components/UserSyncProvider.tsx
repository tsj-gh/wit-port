"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { collectUserData, getOrCreateAnonId, syncToApi } from "@/lib/user-sync";

type UserSyncContextValue = {
  anonId: string | null;
  syncNow: () => Promise<boolean>;
  saveProgressAndSync: (updateLocalStorage: () => void) => Promise<void>;
};

const UserSyncContext = createContext<UserSyncContextValue | null>(null);

export function useUserSyncContext(): UserSyncContextValue | null {
  return useContext(UserSyncContext);
}

export function UserSyncProvider({ children }: { children: React.ReactNode }) {
  const [anonId, setAnonId] = useState<string | null>(null);

  useEffect(() => {
    const id = getOrCreateAnonId();
    setAnonId(id);
    syncToApi(id, collectUserData()).catch(() => {});
  }, []);

  const syncNow = useCallback(async (): Promise<boolean> => {
    const id = getOrCreateAnonId();
    const userData = collectUserData();
    return syncToApi(id, userData);
  }, []);

  const saveProgressAndSync = useCallback(
    async (updateLocalStorage: () => void): Promise<void> => {
      updateLocalStorage();
      const id = getOrCreateAnonId();
      const userData = collectUserData();
      await syncToApi(id, userData);
    },
    []
  );

  const value: UserSyncContextValue = {
    anonId,
    syncNow,
    saveProgressAndSync,
  };

  return (
    <UserSyncContext.Provider value={value}>
      {children}
    </UserSyncContext.Provider>
  );
}
