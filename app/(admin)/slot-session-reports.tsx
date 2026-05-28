import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Play,
  Square,
  ClipboardList,
  Search,
  X,
  CalendarDays,
  Clock,
  User,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { COLORS, SHADOWS, SPACING, RADIUS } from "@/constants/config";
import type { SlotSession } from "@/types/database";

interface SessionWithDetails extends SlotSession {
  slot?: { name: string; start_time: string; end_time: string };
  starter?: { full_name: string | null; role: string; phone_number?: string };
  ender?: { full_name: string | null; role: string; phone_number?: string };
}

interface GroupedSessions {
  date: string;
  sessions: SessionWithDetails[];
}

function formatTime(isoString: string | null) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getDuration(start: string, end: string | null) {
  if (!end) return "Ongoing";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getRoleLabel(role: string) {
  switch (role) {
    case "superadmin": return "Super Admin";
    case "admin": return "Admin";
    case "supervisor": return "Supervisor";
    default: return role;
  }
}

function SessionCard({ session }: { session: SessionWithDetails }) {
  const [expanded, setExpanded] = useState(false);
  const isActive = session.status === "active";

  return (
    <View style={[styles.sessionCard, isActive && styles.sessionCardActive]}>
      <TouchableOpacity
        style={styles.sessionCardHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.sessionCardLeft}>
          <View style={[styles.statusDot, isActive ? styles.statusDotActive : styles.statusDotEnded]} />
          <View style={styles.sessionCardInfo}>
            <Text style={styles.sessionSlotName}>{session.slot?.name || "Unknown Slot"}</Text>
            <Text style={styles.sessionTime}>
              {formatTime(session.started_at)}
              {session.ended_at ? ` → ${formatTime(session.ended_at)}` : " → Ongoing"}
            </Text>
          </View>
        </View>
        <View style={styles.sessionCardRight}>
          <View style={[styles.statusBadge, isActive ? styles.statusBadgeActive : styles.statusBadgeEnded]}>
            <Text style={[styles.statusBadgeText, isActive ? styles.statusBadgeTextActive : styles.statusBadgeTextEnded]}>
              {isActive ? "Active" : "Ended"}
            </Text>
          </View>
          {expanded ? (
            <ChevronUp size={16} color={COLORS.textMuted} />
          ) : (
            <ChevronDown size={16} color={COLORS.textMuted} />
          )}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.sessionCardBody}>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Clock size={14} color={COLORS.textMuted} />
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>{getDuration(session.started_at, session.ended_at)}</Text>
          </View>

          {session.slot && (
            <View style={styles.detailRow}>
              <CalendarDays size={14} color={COLORS.textMuted} />
              <Text style={styles.detailLabel}>Slot Time</Text>
              <Text style={styles.detailValue}>
                {session.slot.start_time} – {session.slot.end_time}
              </Text>
            </View>
          )}

          <View style={styles.sectionLabel}>
            <Play size={12} color={COLORS.success} />
            <Text style={styles.sectionLabelText}>Started By</Text>
          </View>
          <View style={styles.personCard}>
            <View style={[styles.personAvatar, styles.personAvatarStart]}>
              <User size={14} color={COLORS.success} />
            </View>
            <View style={styles.personInfo}>
              <Text style={styles.personName}>{session.starter?.full_name || "Unknown"}</Text>
              <View style={styles.personMeta}>
                <Shield size={11} color={COLORS.textMuted} />
                <Text style={styles.personRole}>{getRoleLabel(session.starter?.role || "")}</Text>
              </View>
            </View>
            <View style={styles.personTime}>
              <Text style={styles.personTimeText}>{formatTime(session.started_at)}</Text>
            </View>
          </View>

          {session.ended_at && session.ender && (
            <>
              <View style={styles.sectionLabel}>
                <Square size={12} color={COLORS.error} />
                <Text style={styles.sectionLabelText}>Ended By</Text>
              </View>
              <View style={styles.personCard}>
                <View style={[styles.personAvatar, styles.personAvatarEnd]}>
                  <User size={14} color={COLORS.error} />
                </View>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{session.ender?.full_name || "Unknown"}</Text>
                  <View style={styles.personMeta}>
                    <Shield size={11} color={COLORS.textMuted} />
                    <Text style={styles.personRole}>{getRoleLabel(session.ender?.role || "")}</Text>
                  </View>
                </View>
                <View style={styles.personTime}>
                  <Text style={styles.personTimeText}>{formatTime(session.ended_at)}</Text>
                </View>
              </View>
            </>
          )}

          {session.ended_at && !session.ender && (
            <>
              <View style={styles.sectionLabel}>
                <Square size={12} color={COLORS.error} />
                <Text style={styles.sectionLabelText}>Ended</Text>
              </View>
              <View style={styles.personCard}>
                <View style={styles.personInfo}>
                  <Text style={styles.personTimeText}>{formatTime(session.ended_at)}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

export default function SlotSessionReportsScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchDate, setSearchDate] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const isAdminOrSuperAdmin =
    profile?.role === "admin" || profile?.role === "superadmin";

  const fetchSessions = useCallback(async () => {
    let query = supabase
      .from("slot_sessions")
      .select(
        "*, slot:darshan_slots(name, start_time, end_time), starter:started_by(full_name, role), ender:ended_by(full_name, role)"
      )
      .order("started_at", { ascending: false })
      .limit(300);

    if (fromDate) {
      query = query.gte("date", fromDate);
    }
    if (toDate) {
      query = query.lte("date", toDate);
    }
    if (searchDate) {
      query = query.eq("date", searchDate);
    }

    const { data, error } = await query;
    if (!error && data) {
      setSessions(data as SessionWithDetails[]);
    }
    setLoading(false);
  }, [fromDate, toDate, searchDate]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  };

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setSearchDate("");
  };

  const grouped: GroupedSessions[] = Object.values(
    sessions.reduce<Record<string, GroupedSessions>>((acc, session) => {
      const date = session.date;
      if (!acc[date]) acc[date] = { date, sessions: [] };
      acc[date].sessions.push(session);
      return acc;
    }, {})
  ).sort((a, b) => b.date.localeCompare(a.date));

  const totalSessions = sessions.length;
  const activeSessions = sessions.filter((s) => s.status === "active").length;
  const endedSessions = sessions.filter((s) => s.status === "ended").length;
  const hasFilters = fromDate || toDate || searchDate;

  if (!isAdminOrSuperAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Slot Session Reports</Text>
        </View>
        <View style={styles.accessDenied}>
          <Shield size={48} color={COLORS.textMuted} />
          <Text style={styles.accessDeniedText}>Access Restricted</Text>
          <Text style={styles.accessDeniedSub}>
            Only admins and super admins can view this report.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Slot Session Reports</Text>
          <Text style={styles.topBarSub}>Detailed start & end history</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, styles.statCardActive]}>
            <Text style={[styles.statValue, { color: COLORS.success }]}>{activeSessions}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statCard, styles.statCardEnded]}>
            <Text style={[styles.statValue, { color: COLORS.textSecondary }]}>{endedSessions}</Text>
            <Text style={styles.statLabel}>Ended</Text>
          </View>
        </View>

        <View style={styles.filterBox}>
          <Text style={styles.filterTitle}>Filter by Date</Text>
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.filterFieldLabel}>Specific Date</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                value={searchDate}
                onChangeText={(t) => {
                  setSearchDate(t);
                  setFromDate("");
                  setToDate("");
                }}
              />
            </View>
          </View>
          <View style={styles.filterRow}>
            <View style={[styles.filterField, { flex: 1 }]}>
              <Text style={styles.filterFieldLabel}>From</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                value={fromDate}
                onChangeText={(t) => {
                  setFromDate(t);
                  setSearchDate("");
                }}
              />
            </View>
            <View style={[styles.filterField, { flex: 1 }]}>
              <Text style={styles.filterFieldLabel}>To</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                value={toDate}
                onChangeText={(t) => {
                  setToDate(t);
                  setSearchDate("");
                }}
              />
            </View>
          </View>
          {hasFilters && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
              <X size={14} color={COLORS.error} />
              <Text style={styles.clearBtnText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Loading sessions...</Text>
          </View>
        ) : grouped.length === 0 ? (
          <View style={styles.emptyState}>
            <ClipboardList size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyStateText}>No sessions found</Text>
            <Text style={styles.emptyStateSub}>
              {hasFilters ? "Try adjusting your filters" : "Slot sessions will appear here"}
            </Text>
          </View>
        ) : (
          grouped.map((group) => (
            <View key={group.date} style={styles.dateGroup}>
              <View style={styles.dateLabelRow}>
                <CalendarDays size={14} color={COLORS.primary} />
                <Text style={styles.dateLabel}>{formatDate(group.date)}</Text>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{group.sessions.length} session{group.sessions.length !== 1 ? "s" : ""}</Text>
                </View>
              </View>
              <View style={styles.sessionsList}>
                {group.sessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  topBarCenter: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
  },
  topBarSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  statCardActive: {
    borderColor: COLORS.successLight,
    backgroundColor: "#F0FDF4",
  },
  statCardEnded: {
    borderColor: COLORS.borderLight,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: "500",
  },
  filterBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOWS.small,
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
  },
  filterField: {
    gap: 4,
  },
  filterFieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  filterInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.sm,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.error,
  },
  dateGroup: {
    gap: 10,
  },
  dateLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    flex: 1,
  },
  dateBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.primary,
  },
  sessionsList: {
    gap: 8,
  },
  sessionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOWS.small,
  },
  sessionCardActive: {
    borderColor: "#6EE7B7",
  },
  sessionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    gap: 10,
  },
  sessionCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: COLORS.success,
  },
  statusDotEnded: {
    backgroundColor: COLORS.textMuted,
  },
  sessionCardInfo: {
    flex: 1,
  },
  sessionSlotName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  sessionTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sessionCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusBadgeActive: {
    backgroundColor: COLORS.successLight,
  },
  statusBadgeEnded: {
    backgroundColor: COLORS.surfaceSecondary,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusBadgeTextActive: {
    color: COLORS.success,
  },
  statusBadgeTextEnded: {
    color: COLORS.textSecondary,
  },
  sessionCardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  sectionLabelText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  personCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    padding: 10,
  },
  personAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  personAvatarStart: {
    backgroundColor: COLORS.successLight,
  },
  personAvatarEnd: {
    backgroundColor: COLORS.errorLight,
  },
  personInfo: {
    flex: 1,
    gap: 2,
  },
  personName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  personMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  personRole: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  personTime: {
    alignItems: "flex-end",
  },
  personTimeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  emptyStateSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  accessDenied: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 32,
  },
  accessDeniedText: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  accessDeniedSub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
});
