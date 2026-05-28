import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, Check, User, UserCheck, Users } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import {
  getActiveGumastasBySebayat,
  assignGumastaToTickets,
} from "@/services/gumastaService";
import { getSebayatPendingTickets } from "@/services/entryService";
import { isGumastaEnabledForSebayat } from "@/services/settingsService";
import { isTicketExpired } from "@/services/entryService";
import { useSlotName } from "@/hooks/useSlotName";
import { useLocalizedNumber } from "@/hooks/useLocalizedNumber";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";
import type { GateEntry, Gumasta } from "@/types/database";

export default function AssignGumastaScreen() {
  const { t } = useTranslation();
  const tabBarHeight = 0;
  const router = useRouter();
  const slotName = useSlotName();
  const ln = useLocalizedNumber();
  const { registration } = useAuth();

  const [gumastas, setGumastas] = useState<Gumasta[]>([]);
  const [tickets, setTickets] = useState<GateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedGumastaId, setSelectedGumastaId] = useState<string | null>(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!registration?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [gList, tList] = await Promise.all([
        getActiveGumastasBySebayat(registration.id),
        getSebayatPendingTickets(registration.id),
      ]);
      setGumastas(gList);
      setTickets(tList.filter((tk) => !isTicketExpired(tk)));
    } catch {
      setError(t("gumasta.assign.loadError"));
    } finally {
      setLoading(false);
    }
  }, [registration?.id, t]);

  useFocusEffect(useCallback(() => {
    setSuccess(false);
    setSelectedGumastaId(null);
    setSelectedTicketIds(new Set());
    loadData();
  }, [loadData]));

  const toggleTicket = (id: string) => {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTicketIds.size === tickets.length) {
      setSelectedTicketIds(new Set());
    } else {
      setSelectedTicketIds(new Set(tickets.map((t) => t.id)));
    }
  };

  const handleAssign = async () => {
    if (!selectedGumastaId || selectedTicketIds.size === 0) return;
    setAssigning(true);
    setError(null);
    try {
      await assignGumastaToTickets(Array.from(selectedTicketIds), selectedGumastaId);
      setSuccess(true);
    } catch {
      setError(t("gumasta.assign.assignError"));
    } finally {
      setAssigning(false);
    }
  };

  const allSelected = tickets.length > 0 && selectedTicketIds.size === tickets.length;
  const selectedGumasta = gumastas.find((g) => g.id === selectedGumastaId);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("gumasta.assign.title")}</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("gumasta.assign.title")}</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.centered}>
          <View style={styles.successIcon}>
            <Check size={40} color={COLORS.success} />
          </View>
          <Text style={styles.successTitle}>{t("gumasta.assign.successTitle")}</Text>
          <Text style={styles.successSubtitle}>
            {t("gumasta.assign.successBody", {
              count: selectedTicketIds.size,
              name: selectedGumasta?.name ?? "",
            })}
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>{t("common.done")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("gumasta.assign.title")}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 16 }]}>
        {/* Gumasta picker */}
        <Text style={styles.sectionLabel}>{t("gumasta.assign.selectGumasta")}</Text>
        {gumastas.length === 0 ? (
          <View style={styles.emptyCard}>
            <Users size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>{t("gumasta.assign.noGumastas")}</Text>
            <Text style={styles.emptySubtitle}>{t("gumasta.assign.noGumastasHint")}</Text>
            <TouchableOpacity
              style={styles.goToGumastasBtn}
              onPress={() => router.push("/(app)/gumastas")}
            >
              <Text style={styles.goToGumastasBtnText}>{t("gumasta.assign.manageGumastas")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gumastaRow}
          >
            {gumastas.map((g) => {
              const selected = selectedGumastaId === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.gumastaCard, selected && styles.gumastaCardSelected]}
                  onPress={() => setSelectedGumastaId(selected ? null : g.id)}
                  activeOpacity={0.75}
                >
                  {g.photo_url ? (
                    <Image source={{ uri: g.photo_url }} style={styles.gumastaAvatar} />
                  ) : (
                    <View style={[styles.gumastaAvatarPlaceholder, selected && styles.gumastaAvatarPlaceholderSelected]}>
                      <User size={20} color={selected ? COLORS.surface : COLORS.textMuted} />
                    </View>
                  )}
                  <Text style={[styles.gumastaName, selected && styles.gumastaNameSelected]} numberOfLines={1}>
                    {g.name}
                  </Text>
                  {selected && (
                    <View style={styles.gumastaCheckBadge}>
                      <Check size={10} color={COLORS.surface} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Ticket list */}
        {tickets.length > 0 && gumastas.length > 0 && (
          <>
            <View style={styles.ticketSectionHeader}>
              <Text style={styles.sectionLabel}>{t("gumasta.assign.selectTickets")}</Text>
              <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn}>
                <Text style={styles.selectAllText}>
                  {allSelected ? t("gumasta.assign.deselectAll") : t("gumasta.assign.selectAll")}
                </Text>
              </TouchableOpacity>
            </View>

            {tickets.map((ticket) => {
              const checked = selectedTicketIds.has(ticket.id);
              const isInnerGate = ticket.entry_mode === "marjana_mandap";
              const isRegistered = ticket.status === "registered";
              return (
                <TouchableOpacity
                  key={ticket.id}
                  style={[styles.ticketRow, checked && styles.ticketRowSelected]}
                  onPress={() => toggleTicket(ticket.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked && <Check size={12} color={COLORS.surface} />}
                  </View>
                  <View style={styles.ticketBadge}>
                    <Text style={styles.ticketCode}>{ticket.entry_code}</Text>
                  </View>
                  <View style={styles.ticketInfo}>
                    {(ticket.slot as any)?.name && (
                      <Text style={styles.ticketSlot} numberOfLines={1}>
                        {(ticket.slot as any).name}
                      </Text>
                    )}
                    <Text style={styles.ticketDevotees}>
                      {ln(ticket.declared_devotee_count)}{" "}
                      {ticket.declared_devotee_count > 1 ? t("app.home.devotees") : t("app.home.devotee")}
                    </Text>
                    {isInnerGate ? (
                      <View style={styles.innerGateBadge}>
                        <Text style={styles.innerGateBadgeText}>{t("app.home.innerGateBadge")}</Text>
                      </View>
                    ) : isRegistered ? (
                      <Text style={styles.ticketStatusText}>{t("app.home.atWestGate")}</Text>
                    ) : null}
                    {ticket.gumasta_id && (
                      <View style={styles.alreadyAssignedRow}>
                        <UserCheck size={11} color={COLORS.primary} />
                        <Text style={styles.alreadyAssignedText} numberOfLines={1}>
                          {gumastas.find((g) => g.id === ticket.gumasta_id)?.name ?? t("gumasta.assignedTo")}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {tickets.length === 0 && !loading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t("gumasta.assign.noTickets")}</Text>
            <Text style={styles.emptySubtitle}>{t("gumasta.assign.noTicketsHint")}</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky bottom bar */}
      {gumastas.length > 0 && tickets.length > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarInfo}>
            <Text style={styles.bottomBarCount}>
              {selectedTicketIds.size > 0
                ? t("gumasta.assign.ticketsSelected", { count: selectedTicketIds.size })
                : t("gumasta.assign.selectTicketsHint")}
            </Text>
            {selectedGumasta && (
              <Text style={styles.bottomBarGumasta} numberOfLines={1}>
                {selectedGumasta.name}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.assignBtn,
              (!selectedGumastaId || selectedTicketIds.size === 0 || assigning) && styles.assignBtnDisabled,
            ]}
            onPress={handleAssign}
            disabled={!selectedGumastaId || selectedTicketIds.size === 0 || assigning}
          >
            {assigning ? (
              <ActivityIndicator size="small" color={COLORS.surface} />
            ) : (
              <Text style={styles.assignBtnText}>{t("gumasta.assign.assignBtn")}</Text>
            )}
          </TouchableOpacity>
        </View>
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
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  gumastaRow: {
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  gumastaCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    width: 88,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.small,
    position: "relative",
  },
  gumastaCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  gumastaAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.border,
  },
  gumastaAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  gumastaAvatarPlaceholderSelected: {
    backgroundColor: COLORS.primary,
  },
  gumastaName: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
    maxWidth: 72,
  },
  gumastaNameSelected: {
    color: COLORS.primaryDark,
  },
  gumastaCheckBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  ticketSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.sm,
  },
  selectAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
  },
  selectAllText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
  },
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    ...SHADOWS.small,
  },
  ticketRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(13, 148, 136, 0.04)",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  ticketBadge: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    minWidth: 60,
    alignItems: "center",
  },
  ticketCode: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: 1,
  },
  ticketInfo: {
    flex: 1,
    gap: 2,
  },
  ticketSlot: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "500",
  },
  ticketDevotees: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
  },
  ticketStatusText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  innerGateBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: COLORS.accentAmber + "22",
    borderRadius: 4,
  },
  innerGateBadgeText: {
    fontSize: 10,
    color: COLORS.accentAmber,
    fontWeight: "600",
  },
  alreadyAssignedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  alreadyAssignedText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: "500",
    maxWidth: 120,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  goToGumastasBtn: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
  },
  goToGumastasBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.surface,
  },
  errorBanner: {
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    fontWeight: "500",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.medium,
  },
  bottomBarInfo: {
    flex: 1,
  },
  bottomBarCount: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  bottomBarGumasta: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  assignBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minWidth: 100,
    alignItems: "center",
  },
  assignBtnDisabled: {
    backgroundColor: COLORS.disabled,
  },
  assignBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.surface,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.successLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  successSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: SPACING.xl,
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.surface,
  },
});
