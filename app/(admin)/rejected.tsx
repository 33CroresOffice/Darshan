import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Circle as XCircle, ChevronRight } from "lucide-react-native";
import { getRegistrationsByStatus } from "@/services/adminService";
import { supabase } from "@/lib/supabase";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";
import type { SebayatRegistration } from "@/types";

export default function RejectedScreen() {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<SebayatRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRegistrations = useCallback(async () => {
    try {
      const data = await getRegistrationsByStatus("rejected");
      setRegistrations(data);
    } catch (err) {
      console.error("Failed to fetch registrations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  useEffect(() => {
    const channel = supabase
      .channel("rejected-registrations")
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
      <View style={styles.iconContainer}>
        <XCircle size={24} color={COLORS.error} />
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.full_name}</Text>
        <Text style={styles.itemReason} numberOfLines={1}>
          {item.rejection_reason || "No reason provided"}
        </Text>
        <Text style={styles.itemDate}>
          Rejected:{" "}
          {item.reviewed_at
            ? new Date(item.reviewed_at).toLocaleDateString("en-IN")
            : "-"}
        </Text>
      </View>
      <ChevronRight size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Rejected</Text>
        <Text style={styles.count}>{registrations.length} applications</Text>
      </View>

      <FlatList
        data={registrations}
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
              <XCircle size={48} color={COLORS.textMuted} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyText}>No rejected applications</Text>
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
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.errorLight,
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
  itemReason: {
    fontSize: 14,
    color: COLORS.error,
    marginTop: 2,
  },
  itemDate: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
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
