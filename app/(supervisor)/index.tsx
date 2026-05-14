import { useEffect, useState, useCallback } from "react";
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
import {
  Users,
  DoorOpen,
  ScanLine,
  TrendingUp,
  Clock,
  Ticket,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { getEntryStats, getPendingVerifications } from "@/services/entryService";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { SlotControlCard } from "@/components/slots/SlotControlCard";
import { supabase } from "@/lib/supabase";
import { COLORS, SHADOWS, SPACING } from "@/constants/config";
import type { EntryStats } from "@/types";
import type { GateEntry } from "@/types/database";
import { useTranslation } from "react-i18next";
import { useLocalizedNumber } from "@/hooks/useLocalizedNumber";

export default function SupervisorDashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const ln = useLocalizedNumber();
  const [stats, setStats] = useState<EntryStats | null>(null);
  const [pendingEntries, setPendingEntries] = useState<GateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsData, pending] = await Promise.all([
        getEntryStats(),
        getPendingVerifications(),
      ]);
      setStats(statsData);
      setPendingEntries(pending.slice(0, 5));
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("supervisor-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "gate_entries" }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const StatCard = ({
    title,
    value,
    icon,
    color,
    bgColor,
  }: {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
  }) => (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <View style={[styles.statIconContainer, { backgroundColor: color }]}>
        {icon}
      </View>
      <Text style={[styles.statValue, { color }]}>{ln(value)}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  const QuickAction = ({
    title,
    subtitle,
    icon,
    onPress,
    color,
  }: {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    onPress: () => void;
    color: string;
  }) => (
    <TouchableOpacity
      style={styles.quickAction}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: color + "20" }]}>
        {icon}
      </View>
      <View style={styles.quickActionText}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >


        <SlotControlCard profile={profile} onSessionChange={fetchData} />

        <View style={styles.statsGrid}>
          <StatCard
            title={t('supervisor.dashboard.entries')}
            value={stats?.todayEntries || 0}
            icon={<DoorOpen size={24} color="#fff" />}
            color="#3B82F6"
            bgColor="#DBEAFE"
          />
          <StatCard
            title={t('supervisor.dashboard.devotees')}
            value={stats?.todayDevotees || 0}
            icon={<Users size={24} color="#fff" />}
            color="#10B981"
            bgColor="#D1FAE5"
          />
          <StatCard
            title={t('supervisor.dashboard.pending')}
            value={stats?.pendingVerifications || 0}
            icon={<Clock size={24} color="#fff" />}
            color="#F59E0B"
            bgColor="#FEF3C7"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('supervisor.dashboard.quickActions')}</Text>
          <View style={styles.quickActions}>
            <QuickAction
              title={t('supervisor.dashboard.westGateEntry')}
              subtitle={t('supervisor.dashboard.westGateSubtitle')}
              icon={<DoorOpen size={24} color="#3B82F6" />}
              onPress={() => router.push("/(supervisor)/west-gate")}
              color="#3B82F6"
            />
            <QuickAction
              title={t('supervisor.dashboard.innerGateVerify')}
              subtitle={t('supervisor.dashboard.innerGateSubtitle')}
              icon={<ScanLine size={24} color="#10B981" />}
              onPress={() => router.push("/(supervisor)/inner-gate")}
              color="#10B981"
            />
            <QuickAction
              title={t('supervisor.dashboard.createTicket')}
              subtitle={t('supervisor.dashboard.createTicketSubtitle')}
              icon={<Ticket size={24} color={COLORS.primary} />}
              onPress={() => router.push("/(supervisor)/sebayat-tickets")}
              color={COLORS.primary}
            />
          </View>
        </View>

        {pendingEntries.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('supervisor.dashboard.pendingVerifications')}</Text>
              <TouchableOpacity onPress={() => router.push("/(supervisor)/inner-gate")}>
                <Text style={styles.viewAllText}>{t('common.viewAll')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pendingList}>
              {pendingEntries.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.pendingItem}
                  onPress={() => router.push(`/(supervisor)/entry/${entry.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.pendingCode}>
                    <Text style={styles.pendingCodeText}>{entry.entry_code}</Text>
                  </View>
                  <View style={styles.pendingInfo}>
                    <Text style={styles.pendingName}>
                      {(entry.sebayat as any)?.full_name || "Unknown"}
                    </Text>
                    <Text style={styles.pendingCount}>
                      {t('supervisor.innerGate.devoteeCount', { count: entry.declared_devotee_count })}
                    </Text>
                  </View>
                  <Text style={styles.pendingTime}>
                    {new Date(entry.west_gate_entry_time).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
    paddingBottom: 100,
  },
  overviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  overviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  overviewIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  overviewLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  overviewDate: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    ...SHADOWS.small,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
  },
  statTitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "600",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "600",
  },
  quickActions: {
    gap: 12,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
    ...SHADOWS.small,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionText: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pendingList: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOWS.small,
  },
  pendingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 14,
  },
  pendingCode: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pendingCodeText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 1,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  pendingCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pendingTime: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
});
