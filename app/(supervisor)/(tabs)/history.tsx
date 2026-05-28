import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  Clock,
  Check,
  Flag,
  X as XCircle,
  ChevronRight,
  Users,
  Calendar,
  WifiOff,
} from "lucide-react-native";

import { getTodayEntries } from "@/services/entryService";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { supabase } from "@/lib/supabase";
import { cacheGateEntries, loadCachedGateEntries, connectivity } from "@/lib/offline";
import { COLORS, SHADOWS, SPACING } from "@/constants/config";

const CACHE_SCOPE_TODAY = "supervisor:today";
import type { GateEntry, EntryStatus } from "@/types/database";
import { useTranslation } from "react-i18next";

const STATUS_STYLE: Record<EntryStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  pending: { color: "#8B5CF6", bg: "#EDE9FE", icon: <Clock size={16} color="#8B5CF6" /> },
  registered: { color: "#F59E0B", bg: "#FEF3C7", icon: <Clock size={16} color="#F59E0B" /> },
  verified: { color: "#10B981", bg: "#D1FAE5", icon: <Check size={16} color="#10B981" /> },
  discrepancy_flagged: { color: "#EF4444", bg: "#FEE2E2", icon: <Flag size={16} color="#EF4444" /> },
  cancelled: { color: "#6B7280", bg: "#F3F4F6", icon: <XCircle size={16} color="#6B7280" /> },
};

type FilterStatus = "all" | EntryStatus;

export default function HistoryScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { t } = useTranslation();
  const channelId = useRef(`supervisor-history-${Math.random().toString(36).slice(2)}`);
  const [entries, setEntries] = useState<GateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  const STATUS_CONFIG: Record<EntryStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    pending: { label: t('supervisor.history.awaiting'), ...STATUS_STYLE.pending },
    registered: { label: t('supervisor.history.atInnerGate'), ...STATUS_STYLE.registered },
    verified: { label: t('supervisor.history.verified'), ...STATUS_STYLE.verified },
    discrepancy_flagged: { label: t('supervisor.history.flagged'), ...STATUS_STYLE.discrepancy_flagged },
    cancelled: { label: t('supervisor.history.cancelled'), ...STATUS_STYLE.cancelled },
  };

  const fetchEntries = useCallback(async () => {
    // Paint cached data immediately
    const cached = await loadCachedGateEntries(CACHE_SCOPE_TODAY);
    if (cached.length > 0) setEntries(cached);

    if (!connectivity.isOnline()) {
      setShowOfflineBanner(cached.length > 0);
      setLoading(false);
      return;
    }

    setShowOfflineBanner(false);

    try {
      const data = await getTodayEntries();
      setEntries(data);
      await cacheGateEntries(CACHE_SCOPE_TODAY, data);
    } catch (err) {
      console.error("Failed to fetch entries:", err);
      setShowOfflineBanner(cached.length > 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    const channel = supabase
      .channel(channelId.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "gate_entries" }, () => {
        fetchEntries();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEntries]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEntries();
    setRefreshing(false);
  };

  const filteredEntries =
    filter === "all" ? entries : entries.filter((e) => e.status === filter);

  const renderFilterButton = (status: FilterStatus, label: string, count: number) => (
    <TouchableOpacity
      key={status}
      style={[styles.filterButton, filter === status && styles.filterButtonActive]}
      onPress={() => setFilter(status)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.filterButtonText,
          filter === status && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.filterCount,
          filter === status && styles.filterCountActive,
        ]}
      >
        <Text
          style={[
            styles.filterCountText,
            filter === status && styles.filterCountTextActive,
          ]}
        >
          {count}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEntryItem = (entry: GateEntry) => {
    const config = STATUS_CONFIG[entry.status] || {
      label: entry.status,
      color: "#6B7280",
      bg: "#F3F4F6",
      icon: <Clock size={16} color="#6B7280" />,
    };
    const sebayat = entry.sebayat as any;
    const entryTime = entry.west_gate_entry_time || entry.created_at;

    return (
      <TouchableOpacity
        key={entry.id}
        style={styles.entryItem}
        onPress={() => router.push(`/(supervisor)/entry/${entry.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.entryLeft}>
          <View style={styles.entryCodeContainer}>
            <Text style={styles.entryCode}>{entry.entry_code}</Text>
          </View>
          <View style={styles.entryInfo}>
            <Text style={styles.entryName}>{sebayat?.full_name || "Unknown"}</Text>
            <View style={styles.entryMeta}>
              <Users size={14} color={COLORS.textSecondary} />
              <Text style={styles.entryCount}>
                {t('supervisor.history.devoteeCount', { count: entry.verified_devotee_count ?? entry.declared_devotee_count })}
              </Text>
              {entry.verified_devotee_count !== null &&
                entry.verified_devotee_count !== entry.declared_devotee_count && (
                  <Text style={styles.entryCountChange}>
                    {t('supervisor.history.declaredCount', { count: entry.declared_devotee_count })}
                  </Text>
                )}
            </View>
          </View>
        </View>
        <View style={styles.entryRight}>
          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            {config.icon}
            <Text style={[styles.statusText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
          <Text style={styles.entryTime}>
            {entryTime ? new Date(entryTime).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            }) : "-"}
          </Text>
        </View>
        <ChevronRight size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  };

  const statusCounts = {
    all: entries.length,
    pending: entries.filter((e) => e.status === "pending").length,
    registered: entries.filter((e) => e.status === "registered").length,
    verified: entries.filter((e) => e.status === "verified").length,
    discrepancy_flagged: entries.filter((e) => e.status === "discrepancy_flagged")
      .length,
    cancelled: entries.filter((e) => e.status === "cancelled").length,
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('supervisor.history.title')}</Text>
          <View style={styles.dateContainer}>
            <Calendar size={16} color={COLORS.textSecondary} />
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </Text>
          </View>
        </View>

        {showOfflineBanner && (
          <View style={styles.offlineBanner}>
            <WifiOff size={14} color="#92400E" />
            <Text style={styles.offlineBannerText}>{t('common.offlineCachedData')}</Text>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {renderFilterButton("all", t('supervisor.history.all'), statusCounts.all)}
          {renderFilterButton("pending", t('supervisor.history.awaiting'), statusCounts.pending)}
          {renderFilterButton("registered", t('supervisor.history.atInnerGate'), statusCounts.registered)}
          {renderFilterButton("verified", t('supervisor.history.verified'), statusCounts.verified)}
          {renderFilterButton("discrepancy_flagged", t('supervisor.history.flagged'), statusCounts.discrepancy_flagged)}
        </ScrollView>

        {filteredEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Clock size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('supervisor.history.noEntries')}</Text>
            <Text style={styles.emptySubtext}>
              {filter === "all"
                ? t('supervisor.history.noEntriesToday')
                : t('supervisor.history.noEntriesStatus', { status: STATUS_CONFIG[filter as EntryStatus]?.label.toLowerCase() })}
            </Text>
          </View>
        ) : (
          <View style={styles.entriesList}>
            {filteredEntries.map((entry) => renderEntryItem(entry))}
          </View>
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
  headerWrapper: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  content: {
    padding: 20,
    paddingTop: 8,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  dateText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  filterScroll: {
    marginBottom: 20,
  },
  filterContainer: {
    flexDirection: "row",
    gap: 10,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  filterButtonTextActive: {
    color: "#fff",
  },
  filterCount: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  filterCountActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  filterCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
  },
  filterCountTextActive: {
    color: "#fff",
  },
  entriesList: {
    gap: 12,
  },
  entryItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOWS.small,
  },
  entryLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  entryCodeContainer: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  entryCode: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 1,
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  entryMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  entryCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  entryCountChange: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  entryRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  entryTime: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  offlineBannerText: {
    fontSize: 13,
    color: "#92400E",
    fontWeight: "500",
    flex: 1,
  },
});
