import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  TextInput,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Search, ChevronRight, User, Clock, CircleCheck as CheckCircle, Circle as XCircle, Calendar, ListFilter as Filter, X } from "lucide-react-native";
import { getRegistrationsByStatus, DateFilter } from "@/services/adminService";
import { useAuth } from "@/context/AuthContext";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";
import type { SebayatRegistration } from "@/types";

type TabType = "pending" | "approved" | "rejected";

const TABS: { key: TabType; label: string; icon: typeof Clock; color: string; bgColor: string }[] = [
  { key: "pending", label: "Pending", icon: Clock, color: COLORS.warning, bgColor: COLORS.warningLight },
  { key: "approved", label: "Approved", icon: CheckCircle, color: COLORS.success, bgColor: COLORS.successLight },
  { key: "rejected", label: "Rejected", icon: XCircle, color: COLORS.error, bgColor: COLORS.errorLight },
];

export default function ReviewsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [registrations, setRegistrations] = useState<SebayatRegistration[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
    const today = new Date().toISOString().split("T")[0];
    return { startDate: today, endDate: today };
  });
  const [showAllDates, setShowAllDates] = useState(false);

  const filteredRegistrations = useMemo(() => {
    if (!searchQuery.trim()) return registrations;
    const query = searchQuery.toLowerCase().trim();
    return registrations.filter(
      (reg) =>
        reg.full_name?.toLowerCase().includes(query) ||
        reg.profile?.phone_number?.toLowerCase().includes(query) ||
        reg.category?.name?.toLowerCase().includes(query) ||
        reg.temple_health_card_id?.toLowerCase().includes(query)
    );
  }, [registrations, searchQuery]);

  const fetchRegistrations = useCallback(async () => {
    try {
      const data = await getRegistrationsByStatus(
        activeTab,
        undefined,
        showAllDates ? undefined : dateFilter,
        user?.id
      );
      setRegistrations(data);
    } catch (err) {
      console.error("Failed to fetch registrations:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFilter, showAllDates, user?.id]);

  useEffect(() => {
    setLoading(true);
    fetchRegistrations();
  }, [fetchRegistrations]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRegistrations();
    setRefreshing(false);
  };

  const handleDateChange = (days: number) => {
    if (days === -1) {
      setShowAllDates(true);
    } else {
      setShowAllDates(false);
      const today = new Date().toISOString().split("T")[0];
      if (days === 0) {
        setDateFilter({ startDate: today, endDate: today });
      } else {
        const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        setDateFilter({ startDate: start, endDate: today });
      }
    }
  };

  const getDatePresetLabel = () => {
    if (showAllDates) return "All Time";
    const today = new Date().toISOString().split("T")[0];
    if (dateFilter.startDate === today && dateFilter.endDate === today) return "Today";
    const daysDiff = Math.round(
      (new Date(today).getTime() - new Date(dateFilter.startDate).getTime()) /
        (24 * 60 * 60 * 1000)
    );
    if (daysDiff === 7) return "Last 7 Days";
    if (daysDiff === 30) return "Last 30 Days";
    return `${new Date(dateFilter.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${new Date(dateFilter.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
  };

  const isDateActive = (days: number) => {
    if (days === -1) return showAllDates;
    if (showAllDates) return false;
    const today = new Date().toISOString().split("T")[0];
    if (days === 0) return dateFilter.startDate === today && dateFilter.endDate === today;
    const daysDiff = Math.round(
      (new Date(today).getTime() - new Date(dateFilter.startDate).getTime()) /
        (24 * 60 * 60 * 1000)
    );
    return daysDiff === days;
  };

  const renderItem = ({ item }: { item: SebayatRegistration }) => {
    const tabConfig = TABS.find((t) => t.key === activeTab)!;
    const IconComponent = tabConfig.icon;

    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => router.push(`/(admin)/review/${item.id}`)}
        activeOpacity={0.7}
      >
        {activeTab === "approved" && item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.avatar} />
        ) : activeTab === "approved" ? (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <User size={24} color={COLORS.surface} />
          </View>
        ) : (
          <View style={[styles.iconContainer, { backgroundColor: tabConfig.bgColor }]}>
            <IconComponent size={24} color={tabConfig.color} />
          </View>
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.full_name}</Text>
          {activeTab === "rejected" ? (
            <>
              <Text style={styles.itemReason} numberOfLines={1}>
                {item.rejection_reason || "No reason provided"}
              </Text>
              <Text style={styles.itemDate}>
                Rejected:{" "}
                {item.approved_at
                  ? new Date(item.approved_at).toLocaleDateString("en-IN")
                  : "-"}
              </Text>
            </>
          ) : (
            <>
              {activeTab === "approved" && (
                <Text style={styles.itemPhone}>{item.profile?.phone_number || "-"}</Text>
              )}
              <Text style={styles.itemCategory}>
                {item.category?.name || "No Nijog"}
              </Text>
              {activeTab === "pending" && (
                <>
                  <Text style={styles.itemDetails}>
                    {item.city}, {item.state}
                  </Text>
                  <Text style={styles.itemDate}>
                    Submitted: {new Date(item.created_at).toLocaleDateString("en-IN")}
                  </Text>
                </>
              )}
            </>
          )}
        </View>
        <ChevronRight size={20} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  };

  const getEmptyMessage = () => {
    switch (activeTab) {
      case "pending":
        return "No pending applications";
      case "approved":
        return "No approved sebayats";
      case "rejected":
        return "No rejected applications";
    }
  };

  const EmptyIcon = TABS.find((t) => t.key === activeTab)!.icon;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reviews</Text>
        <Text style={styles.count}>{filteredRegistrations.length} applications</Text>
      </View>

      <View style={styles.tabsContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.8}
          >
            <tab.icon
              size={18}
              color={activeTab === tab.key ? COLORS.surface : tab.color}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.filterToggle}
        onPress={() => setShowFilters(!showFilters)}
        activeOpacity={0.7}
      >
        <View style={styles.filterToggleLeft}>
          <Filter size={18} color={COLORS.primary} />
          <Text style={styles.filterToggleText}>
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Text>
        </View>
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{getDatePresetLabel()}</Text>
        </View>
      </TouchableOpacity>

      {showFilters && (
        <View style={styles.filtersSection}>
          <View style={styles.dateFilterContainer}>
            <View style={styles.dateFilterHeader}>
              <Calendar size={16} color={COLORS.primary} />
              <Text style={styles.dateFilterLabel}>Filter by Date</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.datePresets}
            >
              <TouchableOpacity
                style={[
                  styles.datePresetButton,
                  isDateActive(0) && styles.datePresetButtonActive,
                ]}
                onPress={() => handleDateChange(0)}
              >
                <Text
                  style={[
                    styles.datePresetText,
                    isDateActive(0) && styles.datePresetTextActive,
                  ]}
                >
                  Today
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.datePresetButton,
                  isDateActive(7) && styles.datePresetButtonActive,
                ]}
                onPress={() => handleDateChange(7)}
              >
                <Text
                  style={[
                    styles.datePresetText,
                    isDateActive(7) && styles.datePresetTextActive,
                  ]}
                >
                  Last 7 Days
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.datePresetButton,
                  isDateActive(30) && styles.datePresetButtonActive,
                ]}
                onPress={() => handleDateChange(30)}
              >
                <Text
                  style={[
                    styles.datePresetText,
                    isDateActive(30) && styles.datePresetTextActive,
                  ]}
                >
                  Last 30 Days
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.datePresetButton,
                  isDateActive(-1) && styles.datePresetButtonActive,
                ]}
                onPress={() => handleDateChange(-1)}
              >
                <Text
                  style={[
                    styles.datePresetText,
                    isDateActive(-1) && styles.datePresetTextActive,
                  ]}
                >
                  All Time
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={styles.searchContainer}>
            <Search size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, phone, health card..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <X size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <FlatList
        data={filteredRegistrations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
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
              <EmptyIcon size={48} color={COLORS.textMuted} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyText}>{getEmptyMessage()}</Text>
            <Text style={styles.emptySubtext}>for {getDatePresetLabel()}</Text>
          </View>
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
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  count: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: SPACING.xs,
    fontWeight: "500",
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  tabTextActive: {
    color: COLORS.surface,
  },
  filterToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
  },
  filterBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
  },
  filtersSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  dateFilterContainer: {
    marginBottom: SPACING.sm,
  },
  dateFilterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  dateFilterLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  datePresets: {
    gap: SPACING.sm,
  },
  datePresetButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  datePresetButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  datePresetText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  datePresetTextActive: {
    color: COLORS.surface,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 44,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    height: "100%",
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.lg,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.border,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  itemPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemCategory: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "500",
    marginTop: 2,
  },
  itemDetails: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  itemReason: {
    fontSize: 13,
    color: COLORS.error,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
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
    fontWeight: "500",
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});
