import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Clock,
  CircleCheck as CheckCircle,
  Circle as XCircle,
  ChevronRight,
  TrendingUp,
  Users,
  DoorOpen,
  Ticket,
  UserCheck,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { getAdminStats } from "@/services/adminService";
import { getEntryStats } from "@/services/entryService";
import { StatusBadge } from "@/components/display/StatusBadge";
import { SlotControlCard } from "@/components/slots/SlotControlCard";
import { supabase } from "@/lib/supabase";
import { COLORS, SHADOWS } from "@/constants/config";
import type { AdminStats, SebayatRegistration, EntryStats } from "@/types";

const { width } = Dimensions.get("window");

export default function DashboardScreen() {
  const router = useRouter();
  const { profile, registration } = useAuth();
  const channelId = useRef(`admin-dashboard-${Math.random().toString(36).slice(2)}`);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [entryStats, setEntryStats] = useState<EntryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const [adminData, entryData] = await Promise.all([
        getAdminStats(),
        getEntryStats(),
      ]);
      setStats(adminData);
      setEntryStats(entryData);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const channel = supabase
      .channel(channelId.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "sebayat_registrations" }, () => {
        fetchStats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "gate_entries" }, () => {
        fetchStats();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  const totalRegistrations =
    (stats?.totalPending || 0) +
    (stats?.totalApproved || 0) +
    (stats?.totalRejected || 0);

  const StatCard = ({
    title,
    value,
    icon,
    color,
    bgColor,
    onPress,
  }: {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.statCard, { backgroundColor: bgColor }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <View style={[styles.statIconContainer, { backgroundColor: color }]}>{icon}</View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </TouchableOpacity>
  );

  const Card = ({ children, style }: { children: React.ReactNode; style?: any }) => (
    <View style={[styles.card, style]}>{children}</View>
  );

  const RegistrationItem = ({ item }: { item: SebayatRegistration }) => (
    <TouchableOpacity
      style={styles.registrationItem}
      onPress={() => router.push(`/(admin)/review/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.registrationAvatar}>
        <Text style={styles.avatarText}>
          {item.full_name?.charAt(0)?.toUpperCase() || "?"}
        </Text>
      </View>
      <View style={styles.registrationInfo}>
        <Text style={styles.registrationName}>{item.full_name}</Text>
        <Text style={styles.registrationDate}>
          {new Date(item.created_at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Text>
      </View>
      <StatusBadge status={item.approval_status} size="small" />
      <View style={styles.chevronContainer}>
        <ChevronRight size={18} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
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
        <SlotControlCard profile={profile} onSessionChange={fetchStats} logsRoute="/(admin)/slot-logs" />

        {entryStats && (entryStats.todayEntries > 0 || entryStats.todayDevotees > 0) && (
          <Card style={styles.entryOverviewCard}>
            <View style={styles.entryOverviewHeader}>
              <Text style={styles.entryOverviewTitle}>Today's Entry Activity</Text>
            </View>
            <View style={styles.entryStatsRow}>
              <View style={styles.entryStatItem}>
                <View style={[styles.entryStatIcon, { backgroundColor: "#DBEAFE" }]}>
                  <DoorOpen size={20} color="#3B82F6" />
                </View>
                <Text style={styles.entryStatValue}>{entryStats.todayEntries}</Text>
                <Text style={styles.entryStatLabel}>Entries</Text>
              </View>
              <View style={styles.entryStatItem}>
                <View style={[styles.entryStatIcon, { backgroundColor: "#D1FAE5" }]}>
                  <Users size={20} color="#10B981" />
                </View>
                <Text style={styles.entryStatValue}>{entryStats.todayDevotees}</Text>
                <Text style={styles.entryStatLabel}>Devotees</Text>
              </View>
              <View style={styles.entryStatItem}>
                <View style={[styles.entryStatIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Clock size={20} color="#F59E0B" />
                </View>
                <Text style={styles.entryStatValue}>{entryStats.pendingVerifications}</Text>
                <Text style={styles.entryStatLabel}>Pending</Text>
              </View>
            </View>
          </Card>
        )}

        <Card style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <View style={styles.overviewIconContainer}>
              <TrendingUp size={24} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.overviewLabel}>Total Registrations</Text>
              <Text style={styles.overviewValue}>{totalRegistrations}</Text>
            </View>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewStats}>
            <View style={styles.overviewStatItem}>
              <View style={[styles.overviewDot, { backgroundColor: COLORS.warning }]} />
              <Text style={styles.overviewStatLabel}>Pending</Text>
              <Text style={styles.overviewStatValue}>{stats?.totalPending || 0}</Text>
            </View>
            <View style={styles.overviewStatItem}>
              <View style={[styles.overviewDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.overviewStatLabel}>Approved</Text>
              <Text style={styles.overviewStatValue}>{stats?.totalApproved || 0}</Text>
            </View>
            <View style={styles.overviewStatItem}>
              <View style={[styles.overviewDot, { backgroundColor: COLORS.error }]} />
              <Text style={styles.overviewStatLabel}>Rejected</Text>
              <Text style={styles.overviewStatValue}>{stats?.totalRejected || 0}</Text>
            </View>
          </View>
        </Card>

        <View style={styles.statsGrid}>
          <StatCard
            title="PENDING"
            value={stats?.totalPending || 0}
            icon={<Clock size={24} color="#fff" />}
            color="#F59E0B"
            bgColor="#FEF3C7"
            onPress={() => router.push("/(admin)/pending")}
          />
          <StatCard
            title="APPROVED"
            value={stats?.totalApproved || 0}
            icon={<CheckCircle size={24} color="#fff" />}
            color="#10B981"
            bgColor="#D1FAE5"
            onPress={() => router.push("/(admin)/approved")}
          />
          <StatCard
            title="REJECTED"
            value={stats?.totalRejected || 0}
            icon={<XCircle size={24} color="#fff" />}
            color="#EF4444"
            bgColor="#FEE2E2"
            onPress={() => router.push("/(admin)/rejected")}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push("/(admin)/sebayat-tickets")}
            activeOpacity={0.8}
          >
            <View style={styles.quickActionIcon}>
              <Ticket size={22} color={COLORS.primary} />
            </View>
            <View style={styles.quickActionText}>
              <Text style={styles.quickActionTitle}>Create Darshan Ticket</Text>
              <Text style={styles.quickActionSubtitle}>Create a ticket on behalf of a sebayat</Text>
            </View>
            <ChevronRight size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionCard, { marginTop: 10 }]}
            onPress={() => router.push("/(admin)/gumasta-reviews")}
            activeOpacity={0.8}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: "#FEF3C7" }]}>
              <UserCheck size={22} color="#F59E0B" />
            </View>
            <View style={styles.quickActionText}>
              <Text style={styles.quickActionTitle}>Gumasta Reviews</Text>
              <Text style={styles.quickActionSubtitle}>Approve or reject pending gumastas</Text>
            </View>
            <ChevronRight size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Registrations</Text>
            <TouchableOpacity
              onPress={() => router.push("/(admin)/pending")}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>View all</Text>
              <ChevronRight size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <Card>
            {stats?.recentRegistrations && stats.recentRegistrations.length > 0 ? (
              stats.recentRegistrations.map((item, index) => (
                <View key={item.id}>
                  <RegistrationItem item={item} />
                  {index < stats.recentRegistrations.length - 1 && (
                    <View style={styles.itemDivider} />
                  )}
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Clock size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>No registrations yet</Text>
                <Text style={styles.emptySubtext}>
                  New registrations will appear here
                </Text>
              </View>
            )}
          </Card>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  quickActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOWS.small,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionText: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  entryOverviewCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
  },
  entryOverviewHeader: {
    marginBottom: 16,
  },
  entryOverviewTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  entryStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  entryStatItem: {
    alignItems: "center",
    flex: 1,
  },
  entryStatIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  entryStatValue: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
  },
  entryStatLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  overviewCard: {
    marginBottom: 24,
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
  overviewValue: {
    fontSize: 36,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 2,
  },
  overviewDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 20,
  },
  overviewStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  overviewStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  overviewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  overviewStatLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  overviewStatValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
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
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "600",
  },
  registrationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
  },
  registrationAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
  },
  registrationInfo: {
    flex: 1,
  },
  registrationName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  registrationDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  itemDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
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
});
