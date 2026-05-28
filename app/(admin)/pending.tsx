import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Clock, ChevronRight } from "lucide-react-native";
import { getRegistrationsByStatus, getAdminVoteCounts } from "@/services/adminService";
import { getCategories } from "@/services/categoryService";
import { getApprovalRule, type ApprovalRule } from "@/services/settingsService";
import { supabase } from "@/lib/supabase";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";
import type { SebayatRegistration, Category } from "@/types";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

export default function PendingScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const channelId = useRef(`admin-pending-${Math.random().toString(36).slice(2)}`);
  const [registrations, setRegistrations] = useState<SebayatRegistration[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [voteCounts, setVoteCounts] = useState<Record<string, { approvedCount: number; rejectedCount: number; totalAdmins: number }>>({});
  const [approvalRule, setApprovalRule] = useState<ApprovalRule>("all_admins");

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  }, []);

  const fetchRegistrations = useCallback(async () => {
    try {
      const data = await getRegistrationsByStatus(
        "pending",
        selectedCategory || undefined
      );
      setRegistrations(data);
      if (data.length > 0) {
        const counts = await getAdminVoteCounts(data.map((r) => r.id));
        setVoteCounts(counts);
      } else {
        setVoteCounts({});
      }
    } catch (err) {
      console.error("Failed to fetch registrations:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchCategories();
    getApprovalRule().then(setApprovalRule);
  }, [fetchCategories]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  useEffect(() => {
    const channel = supabase
      .channel(channelId.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "sebayat_registrations" }, () => {
        fetchRegistrations();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "registration_approvals" }, () => {
        fetchRegistrations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRegistrations]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRegistrations();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: SebayatRegistration }) => {
    const votes = voteCounts[item.id];
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => router.push(`/(admin)/review/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Clock size={24} color={COLORS.warning} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.full_name}</Text>
          <Text style={styles.itemCategory}>
            {item.category?.name || "No Nijog"}
          </Text>
          <Text style={styles.itemDetails}>
            {item.city}, {item.state}
          </Text>
          <Text style={styles.itemDate}>
            Submitted: {new Date(item.created_at).toLocaleDateString("en-IN")}
          </Text>
          {votes && (
            <View style={styles.voteProgress}>
              {votes.rejectedCount > 0 ? (
                <Text style={styles.voteRejected}>
                  {votes.rejectedCount} rejected
                </Text>
              ) : approvalRule === "superadmin_only" ? (
                <Text style={styles.voteNeutral}>
                  Awaiting Super Admin — {votes.approvedCount} admin vote{votes.approvedCount !== 1 ? "s" : ""} recorded
                </Text>
              ) : approvalRule === "any_admin" ? (
                <Text style={votes.approvedCount > 0 ? styles.voteApproved : styles.voteNeutral}>
                  {votes.approvedCount > 0 ? "Approved by an admin" : "No votes yet — any admin can approve"}
                </Text>
              ) : approvalRule === "majority" ? (
                <Text style={styles.voteApproved}>
                  {votes.approvedCount}/{votes.totalAdmins} — majority needed
                </Text>
              ) : (
                <Text style={styles.voteApproved}>
                  {votes.approvedCount}/{votes.totalAdmins} approved
                </Text>
              )}
            </View>
          )}
        </View>
        <ChevronRight size={20} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  };

  const renderCategoryFilter = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterContainer}
    >
      <TouchableOpacity
        style={[styles.filterTab, !selectedCategory && styles.filterTabActive]}
        onPress={() => setSelectedCategory(null)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.filterTabText,
            !selectedCategory && styles.filterTabTextActive,
          ]}
        >
          All
        </Text>
      </TouchableOpacity>
      {categories.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          style={[
            styles.filterTab,
            selectedCategory === cat.id && styles.filterTabActive,
          ]}
          onPress={() => setSelectedCategory(cat.id)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterTabText,
              selectedCategory === cat.id && styles.filterTabTextActive,
            ]}
          >
            {cat.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Pending Reviews</Text>
        <Text style={styles.count}>{registrations.length} applications</Text>
      </View>

      {renderCategoryFilter()}

      <FlatList
        data={registrations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 16 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Clock size={48} color={COLORS.textMuted} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyText}>No pending applications</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
  },
  count: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: SPACING.xs,
    fontWeight: "500",
  },
  filterContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  filterTab: {
    height: 100,
    width: 80,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "600",
    textAlign: "center",
  },
  filterTabTextActive: {
    color: COLORS.surface,
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  item: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.warningLight,
    justifyContent: "center",
    alignItems: "center",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  itemCategory: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "500",
    marginTop: 2,
  },
  itemDetails: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemDate: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  voteProgress: {
    marginTop: 6,
  },
  voteApproved: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.success,
  },
  voteNeutral: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  voteRejected: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.error,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
