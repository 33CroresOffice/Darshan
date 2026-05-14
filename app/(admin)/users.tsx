import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  Users,
  Shield,
  ShieldCheck,
  User,
  ChevronRight,
  Search,
  Eye,
  X,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { getUsersPaginated, getUserStats, UserWithDetails } from "@/services/userService";
import { supabase } from "@/lib/supabase";
import { COLORS, SHADOWS } from "@/constants/config";
import type { UserRole } from "@/types";

const PAGE_SIZE = 5;

export default function UsersScreen() {
  const router = useRouter();
  const { profile: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalSuperadmins: 0,
    totalSupervisors: 0,
    totalSebayats: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | UserRole>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSearch = useRef("");
  const currentFilter = useRef<"all" | UserRole>("all");

  const isSuperAdmin = currentUser?.role === "superadmin";
  const isAdmin = currentUser?.role === "admin";
  const canManageUsers = isSuperAdmin || isAdmin;

  const fetchPage = useCallback(async (pageNum: number, roleFilter: "all" | UserRole, searchQuery: string, append: boolean) => {
    try {
      const { users: newUsers, hasMore: more } = await getUsersPaginated({
        page: pageNum,
        role: roleFilter,
        search: searchQuery,
      });
      setUsers((prev) => append ? [...prev, ...newUsers] : newUsers);
      setHasMore(more);
      setPage(pageNum);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const statsData = await getUserStats();
      setStats(statsData);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchPage(0, currentFilter.current, currentSearch.current, false),
      fetchStats(),
    ]);
    setLoading(false);
  }, [fetchPage, fetchStats]);

  useFocusEffect(
    useCallback(() => {
      initialLoad();
    }, [initialLoad])
  );

  useEffect(() => {
    const channel = supabase
      .channel("users-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        fetchPage(0, currentFilter.current, currentSearch.current, false);
        fetchStats();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPage, fetchStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchPage(0, currentFilter.current, currentSearch.current, false),
      fetchStats(),
    ]);
    setRefreshing(false);
  };

  const applyFilter = (value: "all" | UserRole) => {
    currentFilter.current = value;
    setFilter(value);
    setLoading(true);
    fetchPage(0, value, currentSearch.current, false).finally(() => setLoading(false));
  };

  const onSearchChange = (text: string) => {
    setSearch(text);
    currentSearch.current = text;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setLoading(true);
      fetchPage(0, currentFilter.current, text, false).finally(() => setLoading(false));
    }, 350);
  };

  const clearSearch = () => {
    setSearch("");
    currentSearch.current = "";
    setLoading(true);
    fetchPage(0, currentFilter.current, "", false).finally(() => setLoading(false));
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchPage(page + 1, currentFilter.current, currentSearch.current, true);
    setLoadingMore(false);
  };

  const getRoleIcon = (role: UserRole, size = 18) => {
    switch (role) {
      case "superadmin":
        return <ShieldCheck size={size} color="#6366F1" />;
      case "admin":
        return <Shield size={size} color="#0EA5E9" />;
      case "supervisor":
        return <Eye size={size} color="#F59E0B" />;
      default:
        return <User size={size} color={COLORS.textSecondary} />;
    }
  };

  const getRoleColors = (role: UserRole) => {
    switch (role) {
      case "superadmin":
        return { bg: "#EEF2FF", text: "#6366F1" };
      case "admin":
        return { bg: "#E0F2FE", text: "#0EA5E9" };
      case "supervisor":
        return { bg: "#FEF3C7", text: "#F59E0B" };
      default:
        return { bg: COLORS.surfaceSecondary, text: COLORS.textSecondary };
    }
  };

  const Card = ({ children, style }: { children: React.ReactNode; style?: any }) => (
    <View style={[styles.card, style]}>{children}</View>
  );

  const FilterChip = ({
    label,
    value,
    count,
    icon,
    active,
  }: {
    label: string;
    value: "all" | UserRole;
    count: number;
    icon: React.ReactNode;
    active: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={() => applyFilter(value)}
      activeOpacity={0.7}
    >
      {icon}
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
      <View style={[styles.filterChipBadge, active && styles.filterChipBadgeActive]}>
        <Text style={[styles.filterChipCount, active && styles.filterChipCountActive]}>
          {count}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const UserItem = ({ user, isLast }: { user: UserWithDetails; isLast: boolean }) => {
    const roleColors = getRoleColors(user.role);
    const isCurrentUser = user.id === currentUser?.id;

    return (
      <TouchableOpacity
        style={[styles.userItem, !isLast && styles.userItemBorder]}
        onPress={() => router.push(`/(admin)/edit-user/${user.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.userAvatar}>
          {user.photo_url ? (
            <Image source={{ uri: user.photo_url }} style={styles.userAvatarImage} />
          ) : (
            getRoleIcon(user.role, 20)
          )}
        </View>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>
              {user.full_name || "No name"}
            </Text>
            {isCurrentUser && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>You</Text>
              </View>
            )}
          </View>
          <Text style={styles.userPhone}>{user.phone_number || user.phone}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: roleColors.bg }]}>
          <Text style={[styles.roleText, { color: roleColors.text }]}>
            {user.role}
          </Text>
        </View>
        <View style={styles.chevronContainer}>
          <ChevronRight size={18} color={COLORS.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  const sectionLabel =
    filter === "all" ? "All Users"
    : filter === "superadmin" ? "Super Admins"
    : filter === "admin" ? "Admins"
    : filter === "supervisor" ? "Supervisors"
    : "Darshans";

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
        <View style={styles.header}>
          <Text style={styles.title}>User Management</Text>
          <Text style={styles.subtitle}>{stats.totalUsers} total users</Text>
        </View>

        {canManageUsers && (
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.addSebayatButton}
              onPress={() => router.push("/(admin)/register-sebayat")}
              activeOpacity={0.8}
            >
              <Text style={styles.addSebayatButtonText}>Add Darshan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push("/(admin)/create-admin")}
              activeOpacity={0.8}
            >
              <Text style={styles.addButtonText}>Add Admin</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.searchContainer}>
          <Search size={18} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or phone..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={onSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton} activeOpacity={0.7}>
              <X size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          <FilterChip
            label="All"
            value="all"
            count={stats.totalUsers}
            icon={<Users size={16} color={filter === "all" ? COLORS.primary : COLORS.textSecondary} />}
            active={filter === "all"}
          />
          <FilterChip
            label="Super Admins"
            value="superadmin"
            count={stats.totalSuperadmins}
            icon={<ShieldCheck size={16} color={filter === "superadmin" ? COLORS.primary : COLORS.textSecondary} />}
            active={filter === "superadmin"}
          />
          <FilterChip
            label="Admins"
            value="admin"
            count={stats.totalAdmins}
            icon={<Shield size={16} color={filter === "admin" ? COLORS.primary : COLORS.textSecondary} />}
            active={filter === "admin"}
          />
          <FilterChip
            label="Supervisors"
            value="supervisor"
            count={stats.totalSupervisors}
            icon={<Eye size={16} color={filter === "supervisor" ? COLORS.primary : COLORS.textSecondary} />}
            active={filter === "supervisor"}
          />
          <FilterChip
            label="Darshans"
            value="sebayat"
            count={stats.totalSebayats}
            icon={<User size={16} color={filter === "sebayat" ? COLORS.primary : COLORS.textSecondary} />}
            active={filter === "sebayat"}
          />
        </ScrollView>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{sectionLabel}</Text>
            <Text style={styles.sectionCount}>{users.length}{hasMore ? "+" : ""}</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <Card>
              {users.length > 0 ? (
                users.map((user, index) => (
                  <UserItem
                    key={user.id}
                    user={user}
                    isLast={index === users.length - 1 && !hasMore}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Search size={48} color={COLORS.textMuted} />
                  <Text style={styles.emptyText}>No users found</Text>
                  <Text style={styles.emptySubtext}>
                    Try adjusting your filters or search
                  </Text>
                </View>
              )}

              {hasMore && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={loadMore}
                  activeOpacity={0.7}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Text style={styles.loadMoreText}>Load More</Text>
                  )}
                </TouchableOpacity>
              )}
            </Card>
          )}
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
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: "500",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  addSebayatButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  addSebayatButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    ...SHADOWS.small,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 10,
    ...SHADOWS.small,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    padding: 0,
  },
  clearButton: {
    padding: 2,
  },
  filtersContainer: {
    gap: 10,
    paddingBottom: 8,
    marginBottom: 24,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: COLORS.primary,
  },
  filterChipBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSecondary,
  },
  filterChipBadgeActive: {
    backgroundColor: COLORS.primary + "20",
  },
  filterChipCount: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  filterChipCountActive: {
    color: COLORS.primary,
  },
  card: {
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: "center",
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  userItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  userAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  userAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 14,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  youBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: COLORS.primaryLight,
  },
  youBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    textTransform: "uppercase",
  },
  userPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
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
  loadMoreButton: {
    paddingVertical: 16,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 4,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
});
