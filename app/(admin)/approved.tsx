import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, ChevronRight, User, CircleCheck as CheckCircle } from "lucide-react-native";
import { getRegistrationsByStatus } from "@/services/adminService";
import { getCategories } from "@/services/categoryService";
import { supabase } from "@/lib/supabase";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";
import type { SebayatRegistration, Category } from "@/types";

export default function ApprovedScreen() {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<SebayatRegistration[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        "approved",
        selectedCategory || undefined
      );
      setRegistrations(data);
    } catch (err) {
      console.error("Failed to fetch registrations:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  useEffect(() => {
    const channel = supabase
      .channel("approved-registrations")
      .on("postgres_changes", { event: "*", schema: "public", table: "sebayat_registrations" }, () => {
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

  const renderItem = ({ item }: { item: SebayatRegistration }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => router.push(`/(admin)/review/${item.id}`)}
      activeOpacity={0.7}
    >
      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <User size={24} color={COLORS.surface} />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.full_name}</Text>
        <Text style={styles.itemPhone}>{item.profile?.phone_number || "-"}</Text>
        <Text style={styles.itemCategory}>
          {item.category?.name || "No Nijog"}
        </Text>
      </View>
      <ChevronRight size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

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
        <Text style={styles.title}>Approved</Text>
        <Text style={styles.count}>{filteredRegistrations.length} sebayats</Text>
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
      </View>

      {renderCategoryFilter()}

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
              <CheckCircle
                size={48}
                color={COLORS.textMuted}
                strokeWidth={1.5}
              />
            </View>
            <Text style={styles.emptyText}>No approved sebayats yet</Text>
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 48,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    height: "100%",
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
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
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  itemPhone: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemCategory: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "500",
    marginTop: 2,
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
