import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { CloudOff, RefreshCw, Cloud } from "lucide-react-native";
import { connectivity, flushOutbox, getOutbox, probeConnectivity, subscribeOutbox } from "@/lib/offline";
import { reconcileQuotaLedgersAfterSync, syncSupervisorDataLocally } from "@/services/backgroundSyncService";
import { COLORS, SPACING, RADIUS } from "@/constants/config";

export function OfflineBanner() {
  const [online, setOnline] = useState(connectivity.isOnline());
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const refreshPending = async () => setPending((await getOutbox()).length);
    refreshPending();

    const unsubConn = connectivity.subscribe(() => setOnline(connectivity.isOnline()));
    const unsubOutbox = subscribeOutbox(refreshPending);

    // initial probe + interval
    probeConnectivity();
    const probe = setInterval(() => probeConnectivity(), 30000);

    return () => {
      unsubConn();
      unsubOutbox();
      clearInterval(probe);
    };
  }, []);

  // Auto-flush when online and pending > 0
  useEffect(() => {
    if (online && pending > 0 && !syncing) {
      handleSync();
    }
  }, [online, pending]);

  const handleSync = async () => {
    setSyncing(true);
    const ok = await probeConnectivity();
    if (!ok) {
      setSyncing(false);
      return;
    }
    // Collect sebayat IDs from outbox before flushing for quota reconciliation
    const outboxItems = await getOutbox();
    const sebayatIds = outboxItems
      .map((item) => item.payload?.sebayatId as string | undefined)
      .filter((id): id is string => !!id);

    const result = await flushOutbox();
    setPending(result.remaining);
    setSyncing(false);
    if (result.processed > 0 && result.remaining === 0) {
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 2500);
      // Reconcile quota ledgers and refresh supervisor caches
      if (sebayatIds.length > 0) {
        reconcileQuotaLedgersAfterSync(sebayatIds).catch(() => {});
      }
      syncSupervisorDataLocally().catch(() => {});
    }
  };

  if (online && pending === 0 && !justSynced) return null;

  const offline = !online;
  const bg = offline ? COLORS.error + "15" : pending > 0 ? COLORS.warning + "15" : COLORS.success + "15";
  const fg = offline ? COLORS.error : pending > 0 ? COLORS.warning : COLORS.success;
  const Icon = offline ? CloudOff : pending > 0 ? RefreshCw : Cloud;
  const text = offline
    ? `Offline${pending > 0 ? ` — ${pending} pending` : ""}`
    : pending > 0
    ? `Syncing ${pending} item${pending === 1 ? "" : "s"}…`
    : "All synced";

  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: fg + "40" }]}>
      <Icon size={14} color={fg} />
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {text}
      </Text>
      {!offline && pending > 0 && (
        <TouchableOpacity onPress={handleSync} disabled={syncing} style={styles.action}>
          {syncing ? (
            <ActivityIndicator size="small" color={fg} />
          ) : (
            <Text style={[styles.actionText, { color: fg }]}>Sync now</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  action: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
