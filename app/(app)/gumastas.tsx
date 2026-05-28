import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Plus, User, ArrowLeft, Phone } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { getGumastasBySebayat } from "@/services/gumastaService";
import { isGumastaEnabledForSebayat } from "@/services/settingsService";
import { StatusBadge } from "@/components/display/StatusBadge";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type { Gumasta } from "@/types/database";

export default function GumastasScreen() {
  const router = useRouter();
  const tabBarHeight = 0;
  const { t } = useTranslation();
  const { registration } = useAuth();
  const [gumastas, setGumastas] = useState<Gumasta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const loadData = useCallback(async () => {
    if (!registration?.id) return;
    try {
      const [isEnabled, list] = await Promise.all([
        isGumastaEnabledForSebayat(registration.id),
        getGumastasBySebayat(registration.id),
      ]);
      setEnabled(isEnabled);
      setGumastas(list);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [registration?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (!enabled && !loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("gumasta.title")}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <User size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>{t("gumasta.featureDisabled")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getApprovalBadge = (item: Gumasta) => {
    if (item.approval_status === "pending") {
      return (
        <View style={[styles.approvalBadge, styles.approvalBadgePending]}>
          <Text style={[styles.approvalBadgeText, { color: COLORS.warning }]}>
            {t("gumasta.approval.pending")}
          </Text>
        </View>
      );
    }
    if (item.approval_status === "rejected") {
      return (
        <View style={[styles.approvalBadge, styles.approvalBadgeRejected]}>
          <Text style={[styles.approvalBadgeText, { color: COLORS.error }]}>
            {t("gumasta.approval.rejected")}
          </Text>
        </View>
      );
    }
    return null;
  };

  const renderItem = ({ item }: { item: Gumasta }) => {
    const isPendingOrRejected = item.approval_status !== "approved";
    return (
      <TouchableOpacity
        style={[styles.card, isPendingOrRejected && styles.cardDimmed]}
        onPress={() => router.push(`/(app)/gumasta-detail?id=${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardRow}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={24} color={COLORS.textMuted} />
            </View>
          )}
          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.cardName}>{item.name}</Text>
              {getApprovalBadge(item)}
            </View>
            <View style={styles.phoneRow}>
              <Phone size={13} color={COLORS.textSecondary} />
              <Text style={styles.cardPhone}>{item.contact_number}</Text>
            </View>
            {item.approval_status === "rejected" && item.rejection_reason && (
              <Text style={styles.rejectionReason} numberOfLines={1}>
                {item.rejection_reason}
              </Text>
            )}
          </View>
          {item.approval_status === "approved" && (
            <View
              style={[
                styles.statusDot,
                { backgroundColor: item.is_active ? COLORS.success : COLORS.textMuted },
              ]}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("gumasta.title")}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/(app)/gumasta-add")}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>{t("gumasta.subtitle")}</Text>

      {gumastas.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <User size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>{t("gumasta.noGumastas")}</Text>
          <Text style={styles.emptySubtitle}>{t("gumasta.noGumastasSubtitle")}</Text>
        </View>
      ) : (
        <FlatList
          data={gumastas}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 16 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
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
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  list: {
    paddingHorizontal: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceSecondary,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  cardDimmed: {
    opacity: 0.75,
  },
  cardInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    flexWrap: "wrap",
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 4,
  },
  cardPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  rejectionReason: {
    fontSize: 11,
    color: COLORS.error,
    marginTop: 2,
    fontStyle: "italic",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  approvalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  approvalBadgePending: {
    backgroundColor: COLORS.warningLight,
  },
  approvalBadgeRejected: {
    backgroundColor: COLORS.errorLight,
  },
  approvalBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: "center",
  },
});
