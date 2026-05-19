import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Play, Square, ChevronRight, ChevronDown, Radio, TriangleAlert as AlertTriangle, X, RotateCcw, WifiOff } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import {
  getActiveSession,
  getTodayAllSessions,
  startSlotSession,
  endSlotSession,
  resetSlotSession,
} from "@/services/slotSessionService";
import { getActiveSlots as fetchActiveSlots } from "@/services/slotService";
import { getDarshanSlotsEnabled } from "@/services/settingsService";
import { connectivity, loadActiveSlotSession } from "@/lib/offline";
import { COLORS, SHADOWS } from "@/constants/config";
import { useTranslation } from "react-i18next";
import { useSlotName } from "@/hooks/useSlotName";
import type { SlotSession, DarshanSlot, Profile } from "@/types/database";

interface SlotControlCardProps {
  profile: Profile | null;
  onSessionChange?: () => void;
  logsRoute?: string;
}

type ConfirmState =
  | { type: "start"; slot: DarshanSlot }
  | { type: "end" }
  | { type: "reset"; session: SlotSession }
  | null;

export function SlotControlCard({ profile, onSessionChange, logsRoute }: SlotControlCardProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const slotName = useSlotName();
  const [activeSession, setActiveSession] = useState<SlotSession | null>(null);
  const [endedSessions, setEndedSessions] = useState<SlotSession[]>([]);
  const [availableSlots, setAvailableSlots] = useState<DarshanSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const channelId = useRef(`slot-control-card-${Math.random().toString(36).slice(2)}`);
  const isAdmin = profile?.role === "superadmin" || profile?.role === "admin";
  const [collapsed, setCollapsed] = useState(true);
  const [isOffline, setIsOffline] = useState(!connectivity.isOnline());

  const [slotsFeatureEnabled, setSlotsFeatureEnabled] = useState(true);

  const fetchData = useCallback(async () => {
    const offline = !connectivity.isOnline();
    setIsOffline(offline);

    if (offline) {
      // Show cached session info when offline — actions are disabled
      const cached = await loadActiveSlotSession();
      if (cached) {
        setActiveSession({ id: cached.id, slot_id: cached.slot_id, status: cached.status, started_at: cached.started_at } as SlotSession);
      }
      setLoading(false);
      return;
    }

    const [enabled, session, slots, allSessions] = await Promise.all([
      getDarshanSlotsEnabled(),
      getActiveSession(),
      fetchActiveSlots(),
      getTodayAllSessions(),
    ]);
    setSlotsFeatureEnabled(enabled);
    if (!enabled) {
      setActiveSession(null);
      setEndedSessions([]);
      setAvailableSlots([]);
      setLoading(false);
      return;
    }
    const endedSlotIds = allSessions
      .filter((s) => s.status === "ended")
      .map((s) => s.slot_id);
    setActiveSession(session);
    setEndedSessions(allSessions.filter((s) => s.status === "ended"));
    setAvailableSlots(slots.filter((s) => !endedSlotIds.includes(s.id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    return connectivity.subscribe(() => {
      setIsOffline(!connectivity.isOnline());
      fetchData();
    });
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel(channelId.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "slot_sessions" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "slot_session_logs" }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleConfirm = async () => {
    if (!profile?.id || !confirmState) return;
    setActionLoading(true);
    setErrorMsg(null);

    let result: { success: boolean; message: string };

    if (confirmState.type === "start") {
      result = await startSlotSession(confirmState.slot.id, profile.id);
    } else if (confirmState.type === "reset") {
      result = await resetSlotSession(confirmState.session.id);
    } else {
      if (!activeSession) { setActionLoading(false); return; }
      result = await endSlotSession(activeSession.id, profile.id);
    }

    setActionLoading(false);

    if (result.success) {
      setConfirmState(null);
      await fetchData();
      onSessionChange?.();
    } else {
      setErrorMsg(result.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Radio size={18} color={COLORS.primary} />
          <Text style={styles.cardTitle}>{t("supervisor.slotControl.title")}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  if (confirmState) {
    const isEnd = confirmState.type === "end";
    const isReset = confirmState.type === "reset";
    const confirmSlotLabel = isEnd
      ? (activeSession?.slot ? slotName(activeSession.slot as DarshanSlot) : "this slot")
      : isReset
      ? ((confirmState.session.slot ? slotName(confirmState.session.slot as DarshanSlot) : "this slot"))
      : slotName((confirmState as { type: "start"; slot: DarshanSlot }).slot);

    return (
      <View style={styles.card}>
        <View style={styles.confirmContainer}>
          <View style={[styles.confirmIcon, isEnd || isReset ? styles.confirmIconEnd : styles.confirmIconStart]}>
            <AlertTriangle size={22} color={isEnd || isReset ? COLORS.error : COLORS.success} />
          </View>
          <Text style={styles.confirmTitle}>
            {isReset ? t("supervisor.slotControl.confirmResetTitle") : isEnd ? t("supervisor.slotControl.confirmEndTitle") : t("supervisor.slotControl.confirmStartTitle")}
          </Text>
          <Text style={styles.confirmMessage}>
            {isReset
              ? t("supervisor.slotControl.confirmResetMsg", { slot: confirmSlotLabel })
              : isEnd
              ? t("supervisor.slotControl.confirmEndMsg", { slot: confirmSlotLabel })
              : t("supervisor.slotControl.confirmStartMsg", { slot: confirmSlotLabel })}
          </Text>

          {errorMsg && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errorMsg}</Text>
            </View>
          )}

          <View style={styles.confirmActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => { setConfirmState(null); setErrorMsg(null); }}
              disabled={actionLoading}
            >
              <X size={16} color={COLORS.textSecondary} />
              <Text style={styles.cancelButtonText}>{t("supervisor.slotControl.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                isEnd || isReset ? styles.confirmButtonEnd : styles.confirmButtonStart,
                actionLoading && styles.buttonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  {isReset ? (
                    <RotateCcw size={15} color="#fff" />
                  ) : isEnd ? (
                    <Square size={15} color="#fff" />
                  ) : (
                    <Play size={15} color="#fff" />
                  )}
                  <Text style={styles.confirmButtonText}>
                    {isReset ? t("supervisor.slotControl.resetSessions") : isEnd ? t("supervisor.slotControl.endSession") : t("supervisor.slotControl.startSession")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (!loading && !slotsFeatureEnabled) return null;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={[styles.cardHeader, !collapsed && { marginBottom: isOffline ? 8 : 16 }]}
        onPress={() => setCollapsed((c) => !c)}
        activeOpacity={0.7}
      >
        <Radio size={18} color={activeSession ? COLORS.success : COLORS.primary} />
        <Text style={styles.cardTitle}>{t("supervisor.slotControl.title")}</Text>
        {activeSession && (
          <View style={styles.activePill}>
            <View style={styles.activePillDot} />
            <Text style={styles.activePillText}>
              {collapsed ? (activeSession.slot ? slotName(activeSession.slot as DarshanSlot) : t("supervisor.slotControl.active")) : t("supervisor.slotControl.active")}
            </Text>
          </View>
        )}
        {!collapsed && (
          <TouchableOpacity
            style={styles.viewLogsButton}
            onPress={(e) => { e.stopPropagation?.(); router.push((logsRoute || "/(supervisor)/slot-logs") as any); }}
          >
            <Text style={styles.viewLogsText}>{t("supervisor.slotControl.viewLogs")}</Text>
            <ChevronRight size={14} color={COLORS.primary} />
          </TouchableOpacity>
        )}
        <ChevronDown
          size={16}
          color={COLORS.textSecondary}
          style={{ transform: [{ rotate: collapsed ? "0deg" : "180deg" }] }}
        />
      </TouchableOpacity>

      {!collapsed && isOffline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={14} color="#92400E" />
          <Text style={styles.offlineBannerText}>{t("supervisor.slotControl.offlineNote")}</Text>
        </View>
      )}

      {!collapsed && activeSession ? (
        <View style={styles.activeSessionContainer}>
          <View style={styles.activeBanner}>
            <View style={styles.activeDot} />
            <Text style={styles.activeBannerText}>{t("supervisor.slotControl.active")}</Text>
          </View>
          <Text style={styles.activeSlotName}>
            {activeSession.slot ? slotName(activeSession.slot as DarshanSlot) : t("supervisor.slotControl.unknownSlot")}
          </Text>
          <Text style={styles.activeMetaText}>
            {t("supervisor.slotControl.startedBy", {
              name: (activeSession.starter as any)?.full_name || t("supervisor.slotControl.unknown"),
              time: new Date(activeSession.started_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
            })}
          </Text>
          <TouchableOpacity
            style={[styles.endButton, isOffline && styles.buttonOfflineDisabled]}
            onPress={() => !isOffline && setConfirmState({ type: "end" })}
            activeOpacity={isOffline ? 1 : 0.8}
          >
            <Square size={16} color={isOffline ? COLORS.textMuted : "#fff"} />
            <Text style={[styles.endButtonText, isOffline && { color: COLORS.textMuted }]}>{t("supervisor.slotControl.endSlot")}</Text>
          </TouchableOpacity>
        </View>
      ) : !collapsed ? (
        <View style={styles.noSessionContainer}>
          {availableSlots.length === 0 && endedSessions.length === 0 && !isOffline ? (
            <Text style={styles.noSlotsText}>{t("supervisor.slotControl.noSlotsConfigured")}</Text>
          ) : isOffline ? (
            <Text style={styles.noSlotsText}>{t("supervisor.slotControl.offlineNoActions")}</Text>
          ) : (
            <>
              {availableSlots.length > 0 && (
                <>
                  <Text style={styles.noSessionLabel}>{t("supervisor.slotControl.selectSlotToStart")}</Text>
                  <View style={styles.slotList}>
                    {availableSlots.map((slot) => (
                      <View key={slot.id} style={styles.slotRow}>
                        <View style={styles.slotInfo}>
                          <Text style={styles.slotName}>{slotName(slot)}</Text>
                          <Text style={styles.slotTime}>
                            {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.startButton}
                          onPress={() => setConfirmState({ type: "start", slot })}
                          activeOpacity={0.8}
                        >
                          <Play size={13} color="#fff" />
                          <Text style={styles.startButtonText}>{t("supervisor.slotControl.start")}</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </>
              )}
              {isAdmin && endedSessions.length > 0 && (
                <>
                  <Text style={styles.endedSectionLabel}>{t("supervisor.slotControl.endedToday")}</Text>
                  <View style={styles.slotList}>
                    {endedSessions.map((session) => (
                      <View key={session.id} style={[styles.slotRow, styles.slotRowEnded]}>
                        <View style={styles.slotInfo}>
                          <Text style={styles.slotName}>{session.slot ? slotName(session.slot as DarshanSlot) : "Unknown"}</Text>
                          <Text style={styles.slotTimeEnded}>{t("supervisor.slotControl.sessionEnded")}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.resetSlotButton}
                          onPress={() => setConfirmState({ type: "reset", session })}
                          activeOpacity={0.8}
                        >
                          <RotateCcw size={13} color={COLORS.error} />
                          <Text style={styles.resetSlotButtonText}>{t("supervisor.slotControl.reset")}</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </View>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  offlineBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
  },
  buttonOfflineDisabled: {
    backgroundColor: COLORS.border,
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 0,
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  activePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.success,
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    flex: 1,
  },
  viewLogsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewLogsText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  confirmContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  confirmIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmIconStart: {
    backgroundColor: COLORS.successLight,
  },
  confirmIconEnd: {
    backgroundColor: COLORS.errorLight,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
  },
  confirmMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  errorBanner: {
    backgroundColor: COLORS.errorLight,
    borderRadius: 10,
    padding: 12,
    width: "100%",
  },
  errorBannerText: {
    fontSize: 13,
    color: COLORS.error,
    textAlign: "center",
    fontWeight: "500",
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  confirmButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  confirmButtonStart: {
    backgroundColor: COLORS.success,
  },
  confirmButtonEnd: {
    backgroundColor: COLORS.error,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  activeSessionContainer: {
    gap: 8,
  },
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  activeBannerText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.success,
    letterSpacing: 0.8,
  },
  activeSlotName: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 4,
  },
  activeMetaText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  endButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.error,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
  },
  endButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  noSessionContainer: {
    gap: 12,
  },
  noSessionLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  noSlotsText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontStyle: "italic",
  },
  slotList: {
    gap: 8,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  slotInfo: {
    flex: 1,
  },
  slotName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  slotTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.success,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  endedSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  slotRowEnded: {
    opacity: 0.85,
  },
  slotTimeEnded: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 2,
    fontWeight: "500",
  },
  resetSlotButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  resetSlotButtonText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: "700",
  },
});
