import { useEffect, useRef, useState, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { connectivity, loadSebayatListCache, loadLastSyncTime, probeConnectivity } from "@/lib/offline";
import { syncSupervisorDataLocally } from "@/services/backgroundSyncService";
import { flushOutbox } from "@/lib/offline";

export interface SupervisorSyncStatus {
  syncing: boolean;
  lastSyncedAt: string | null;
  sebayatCount: number;
  triggerSync: () => Promise<void>;
}

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useSupervisorSync(): SupervisorSyncStatus {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [sebayatCount, setSebayatCount] = useState(0);
  const syncingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshStatus = useCallback(async () => {
    const [lastSync, list] = await Promise.all([
      loadLastSyncTime(),
      loadSebayatListCache(),
    ]);
    setLastSyncedAt(lastSync);
    setSebayatCount(list.length);
  }, []);

  const runSync = useCallback(async () => {
    if (syncingRef.current) return;
    const online = await probeConnectivity();
    if (!online) return;

    syncingRef.current = true;
    setSyncing(true);
    try {
      // Flush any pending outbox ops first, then sync fresh data down
      await flushOutbox();
      await syncSupervisorDataLocally();
      await refreshStatus();
    } catch {
      // Silently fail — cached data remains usable
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshStatus]);

  useEffect(() => {
    // Load cached status immediately so UI shows something on mount
    refreshStatus();

    // Sync immediately on mount if online
    runSync();

    // Periodic sync every 5 minutes
    intervalRef.current = setInterval(() => {
      if (connectivity.isOnline()) runSync();
    }, SYNC_INTERVAL_MS);

    // Re-sync whenever connectivity comes back
    const unsubConn = connectivity.subscribe(() => {
      if (connectivity.isOnline()) runSync();
    });

    // Re-sync when app comes to foreground
    const handleAppState = (state: AppStateStatus) => {
      if (state === "active" && connectivity.isOnline()) runSync();
    };
    const appStateSub = AppState.addEventListener("change", handleAppState);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      unsubConn();
      appStateSub.remove();
    };
  }, [runSync, refreshStatus]);

  return { syncing, lastSyncedAt, sebayatCount, triggerSync: runSync };
}
