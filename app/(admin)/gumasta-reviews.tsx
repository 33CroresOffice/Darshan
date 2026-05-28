import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Clock, CircleCheck as CheckCircle, Circle as XCircle, User, Phone, ChevronRight } from "lucide-react-native";
import { getGumastasByApprovalStatus } from "@/services/gumastaService";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";
import type { Gumasta } from "@/types/database";

type TabType = "pending" | "approved" | "rejected";

const TABS: { key: TabType; label: string; icon: typeof Clock; color: string; bgColor: string }[] = [
  { key: "pending", label: "Pending", icon: Clock, color: COLORS.warning, bgColor: COLORS.warningLight },
  { key: "approved", label: "Approved", icon: CheckCircle, color: COLORS.success, bgColor: COLORS.successLight },
  { key: "rejected", label: "Rejected", icon: XCircle, color: COLORS.error, bgColor: COLORS.errorLight },
];

export default function GumastaReviewsScreen() {
  const router = useRouter();
  const tabBarHeight = 0;
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [gumastas, setGumastas] = useState<Gumasta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGumastas = useCallback(async () => {
    try {
      const data = await getGumastasByApprovalStatus(activeTab);
      setGumastas(data);
    } catch (err) {
      console.error("Failed to fetch gumastas:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setLoading(true);
    fetchGumastas();
  }, [fetchGumastas]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGumastas();
    setRefreshing(false);
  };

  const activeTabMeta = TABS.find((t) => t.key === activeTab)!;

  const renderItem = ({ item }: { item: Gumasta }) => {
    const sebayat = (item as any).sebayat;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(admin)/gumasta-review/${item.id}`)}
        activeOpacity={0.75}
      >
        <View style={styles.cardRow}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={22} color={COLORS.textMuted} />
            </View>
          )}
          <View style={styles.cardContent}>
            <Text style={styles.gumastaName}>{item.name}</Text>
            <View style={styles.metaRow}>
              <Phone size={12} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{item.contact_number}</Text>
            </View>
            {sebayat && (
              <Text style={styles.sebayatName} numberOfLines={1}>
                Sebayat: {sebayat.full_name}
                {sebayat.allotment_number ? ` · ${sebayat.allotment_number}` : ""}
              </Text>
            )}
            {activeTab === "rejected" && item.rejection_reason && (
              <Text style={styles.rejectionReason} numberOfLines={1}>
                Reason: {item.rejection_reason}
              </Text>
            )}
            <Text style={styles.dateText}>
              {new Date(item.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: activeTabMeta.color }]} />
          <ChevronRight size={16} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && { borderBottomColor: tab.color, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Icon size={16} color={active ? tab.color : COLORS.textMuted} />
              <Text style={[styles.tabLabel, active && { color: tab.color }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={gumastas}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 16 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <activeTabMeta.icon size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>
                {activeTab === "pending"
                  ? "No pending gumastas"
                  : activeTab === "approved"
                  ? "No approved gumastas"
                  : "No rejected gumastas"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === "pending"
                  ? "New gumasta registrations will appear here"
                  : activeTab === "approved"
                  ? "Approved gumastas will appear here"
                  : "Rejected gumastas will appear here"}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  list: {
    padding: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceSecondary,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    marginLeft: SPACING.sm,
    gap: 2,
  },
  gumastaName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  sebayatName: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  rejectionReason: {
    fontSize: 11,
    color: COLORS.error,
    marginTop: 2,
    fontStyle: "italic",
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: SPACING.sm,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: "center",
  },
});
