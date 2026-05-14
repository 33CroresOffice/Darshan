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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, MessageSquare, Shield, User, Search, ListFilter as Filter } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { COLORS, SHADOWS, SPACING, RADIUS } from "@/constants/config";

interface FeedbackItem {
  id: string;
  user_id: string;
  role: "supervisor" | "sebayat";
  message: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    phone_number: string | null;
  };
}

type FilterRole = "all" | "supervisor" | "sebayat";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function FeedbackScreen() {
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterRole>("all");
  const [search, setSearch] = useState("");

  const fetchFeedback = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("*, profile:profiles!feedback_user_id_profiles_fkey(full_name, phone_number)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFeedbacks((data as FeedbackItem[]) || []);
    } catch (err) {
      console.error("Failed to fetch feedback:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFeedback();
    setRefreshing(false);
  };

  const filtered = feedbacks.filter((f) => {
    const matchesRole = filter === "all" || f.role === filter;
    const name = f.profile?.full_name?.toLowerCase() || "";
    const msg = f.message.toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch = !q || name.includes(q) || msg.includes(q);
    return matchesRole && matchesSearch;
  });

  const supervisorCount = feedbacks.filter((f) => f.role === "supervisor").length;
  const sebayatCount = feedbacks.filter((f) => f.role === "sebayat").length;

  const FilterChip = ({ label, value, count }: { label: string; value: FilterRole; count?: number }) => (
    <TouchableOpacity
      style={[styles.chip, filter === value && styles.chipActive]}
      onPress={() => setFilter(value)}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, filter === value && styles.chipTextActive]}>
        {label}
      </Text>
      {count !== undefined && (
        <View style={[styles.chipBadge, filter === value && styles.chipBadgeActive]}>
          <Text style={[styles.chipBadgeText, filter === value && styles.chipBadgeTextActive]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Feedback</Text>
          <Text style={styles.headerSubtitle}>{feedbacks.length} submissions total</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Search size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or message..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filters}>
        <Filter size={14} color={COLORS.textMuted} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          <FilterChip label="All" value="all" count={feedbacks.length} />
          <FilterChip label="Supervisors" value="supervisor" count={supervisorCount} />
          <FilterChip label="Sebayat" value="sebayat" count={sebayatCount} />
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading feedback...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <MessageSquare size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No feedback yet</Text>
            <Text style={styles.emptyText}>
              {search || filter !== "all"
                ? "No feedback matches your filters."
                : "Feedback from supervisors and sebayat will appear here."}
            </Text>
          </View>
        ) : (
          filtered.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.roleIcon, item.role === "supervisor" ? styles.roleIconSupervisor : styles.roleIconSebayat]}>
                  {item.role === "supervisor" ? (
                    <Shield size={14} color={item.role === "supervisor" ? "#2563EB" : COLORS.primary} />
                  ) : (
                    <User size={14} color={COLORS.primary} />
                  )}
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardName}>
                    {item.profile?.full_name || "Unknown User"}
                  </Text>
                  <View style={[styles.roleBadge, item.role === "supervisor" ? styles.roleBadgeSupervisor : styles.roleBadgeSebayat]}>
                    <Text style={[styles.roleBadgeText, item.role === "supervisor" ? styles.roleBadgeTextSupervisor : styles.roleBadgeTextSebayat]}>
                      {item.role === "supervisor" ? "Supervisor" : "Sebayat"}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardDateBlock}>
                  <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                  <Text style={styles.cardTime}>{formatTime(item.created_at)}</Text>
                </View>
              </View>
              <Text style={styles.cardMessage}>{item.message}</Text>
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  filters: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  filtersScroll: {
    flex: 1,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSecondary,
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: "#fff",
  },
  chipBadge: {
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  chipBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  chipBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  chipBadgeTextActive: {
    color: "#fff",
  },
  list: {
    padding: SPACING.md,
    gap: 12,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
    gap: SPACING.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  roleIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    justifyContent: "center",
    alignItems: "center",
  },
  roleIconSupervisor: {
    backgroundColor: "#DBEAFE",
  },
  roleIconSebayat: {
    backgroundColor: COLORS.primaryLight,
  },
  cardMeta: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  roleBadgeSupervisor: {
    backgroundColor: "#DBEAFE",
  },
  roleBadgeSebayat: {
    backgroundColor: COLORS.primaryLight,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  roleBadgeTextSupervisor: {
    color: "#2563EB",
  },
  roleBadgeTextSebayat: {
    color: COLORS.primary,
  },
  cardDateBlock: {
    alignItems: "flex-end",
  },
  cardDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  cardTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  cardMessage: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 21,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
});
