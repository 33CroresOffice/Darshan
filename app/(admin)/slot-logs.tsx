import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Play, Square, ClipboardList } from "lucide-react-native";
import { getAllSessionLogs } from "@/services/slotSessionService";
import { COLORS, SHADOWS } from "@/constants/config";
import type { SlotSessionLog } from "@/types/database";

export default function AdminSlotLogsScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const [logs, setLogs] = useState<SlotSessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    const data = await getAllSessionLogs(undefined, undefined, 200);
    setLogs(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  const grouped = logs.reduce<Record<string, SlotSessionLog[]>>((acc, log) => {
    const date = log.performed_at.split("T")[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (dateStr === today) return "Today";
    if (dateStr === yesterday) return "Yesterday";
    return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Slot Session Logs</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ClipboardList size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No session logs yet</Text>
            <Text style={styles.emptySubtext}>Slot start/end events will appear here</Text>
          </View>
        ) : (
          sortedDates.map((date) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateLabel}>{formatDate(date)}</Text>
              <View style={styles.logList}>
                {grouped[date].map((log, index) => (
                  <View
                    key={log.id}
                    style={[
                      styles.logRow,
                      index < grouped[date].length - 1 && styles.logRowBorder,
                    ]}
                  >
                    <View style={[styles.actionBadge, log.action === "started" ? styles.startBadge : styles.endBadge]}>
                      {log.action === "started" ? (
                        <Play size={12} color={COLORS.success} />
                      ) : (
                        <Square size={12} color={COLORS.error} />
                      )}
                      <Text style={[styles.actionText, log.action === "started" ? styles.startText : styles.endText]}>
                        {log.action === "started" ? "Started" : "Ended"}
                      </Text>
                    </View>
                    <View style={styles.logMeta}>
                      <Text style={styles.slotName}>{log.slot_name}</Text>
                      <Text style={styles.performerText}>
                        {log.performed_by_name}
                        <Text style={styles.roleText}> · {log.performed_by_role}</Text>
                      </Text>
                    </View>
                    <Text style={styles.timeText}>
                      {new Date(log.performed_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  content: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  logList: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOWS.small,
  },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  logRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 72,
    justifyContent: "center",
  },
  startBadge: {
    backgroundColor: COLORS.successLight,
  },
  endBadge: {
    backgroundColor: COLORS.errorLight,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  startText: {
    color: COLORS.success,
  },
  endText: {
    color: COLORS.error,
  },
  logMeta: {
    flex: 1,
  },
  slotName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  performerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  roleText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
});
