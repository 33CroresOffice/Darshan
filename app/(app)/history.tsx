import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  Calendar,
  Users,
  ChevronDown,
  ChevronUp,
  History,
  ListFilter as Filter,
  TicketCheck,
  ChevronLeft,
  ChevronRight,
  Bell,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { getSebayatEntriesByDateRange } from "@/services/entryService";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";
import type { GateEntry } from "@/types/database";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// STATUS_CONFIG is built inside component to access t()

function toISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function formatTime(isoStr: string | null) {
  if (!isoStr) return "-";
  return new Date(isoStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type GroupedEntries = { date: string; entries: GateEntry[] }[];

function groupByDate(entries: GateEntry[]): GroupedEntries {
  const map: Record<string, GateEntry[]> = {};
  for (const entry of entries) {
    if (!map[entry.entry_date]) map[entry.entry_date] = [];
    map[entry.entry_date].push(entry);
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, entries: items as GateEntry[] }));
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function buildCalendarDays(year: number, month: number): (string | null)[] {
  const days: (string | null)[] = [];
  const firstDay = getFirstDayOfMonth(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(toISO(new Date(year, month, d)));
  }
  return days;
}

function CalendarPicker({
  visible,
  title,
  selectedDate,
  minDate,
  maxDate,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  selectedDate: string;
  minDate?: string;
  maxDate?: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const initial = selectedDate ? new Date(selectedDate) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const days = buildCalendarDays(viewYear, viewMonth);
  const today = toISO(new Date());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const isDisabled = (dateStr: string) => {
    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    return false;
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={calStyles.overlay}>
        <View style={calStyles.container}>
          <Text style={calStyles.title}>{title}</Text>
          <View style={calStyles.navRow}>
            <TouchableOpacity style={calStyles.navBtn} onPress={prevMonth}>
              <ChevronLeft size={20} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={calStyles.monthYear}>{FULL_MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity style={calStyles.navBtn} onPress={nextMonth}>
              <ChevronRight size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <View style={calStyles.dayNamesRow}>
            {DAY_NAMES.map((d) => (
              <Text key={d} style={calStyles.dayName}>{d}</Text>
            ))}
          </View>
          <View style={calStyles.daysGrid}>
            {days.map((dateStr, i) => {
              if (!dateStr) return <View key={`empty-${i}`} style={calStyles.dayCell} />;
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === today;
              const disabled = isDisabled(dateStr);
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    calStyles.dayCell,
                    isSelected && calStyles.dayCellSelected,
                    isToday && !isSelected && calStyles.dayCellToday,
                    disabled && calStyles.dayCellDisabled,
                  ]}
                  onPress={() => !disabled && onSelect(dateStr)}
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      calStyles.dayText,
                      isSelected && calStyles.dayTextSelected,
                      isToday && !isSelected && calStyles.dayTextToday,
                      disabled && calStyles.dayTextDisabled,
                    ]}
                  >
                    {parseInt(dateStr.split("-")[2], 10)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={calStyles.cancelBtn} onPress={onClose}>
            <Text style={calStyles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const calStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    width: "100%",
    maxWidth: 340,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  monthYear: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  dayNamesRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayName: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
    paddingVertical: 4,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: RADIUS.sm,
  },
  dayCellSelected: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    color: COLORS.text,
  },
  dayTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  dayTextToday: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  dayTextDisabled: {
    color: COLORS.textMuted,
  },
  cancelBtn: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
});

export default function HistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { registration } = useAuth();
  const { unreadCount } = useNotifications();

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending: { label: t("app.history.statusPending"), color: COLORS.warning },
    registered: { label: t("app.history.statusAtInnerGate"), color: COLORS.primary },
    verified: { label: t("app.history.statusVerified"), color: COLORS.success },
    cancelled: { label: t("app.history.statusCancelled"), color: COLORS.textMuted },
    discrepancy_flagged: { label: t("app.history.statusFlagged"), color: COLORS.error },
  };

  const todayISO = toISO(new Date());
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const thirtyDaysAgoISO = toISO(thirtyDaysAgo);

  const [fromDate, setFromDate] = useState(thirtyDaysAgoISO);
  const [toDate, setToDate] = useState(todayISO);
  const [pendingFrom, setPendingFrom] = useState(thirtyDaysAgoISO);
  const [pendingTo, setPendingTo] = useState(todayISO);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [entries, setEntries] = useState<GateEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [filterVisible, setFilterVisible] = useState(false);

  const loadEntries = useCallback(
    async (from: string, to: string) => {
      if (!registration?.id) return;
      setLoading(true);
      const data = await getSebayatEntriesByDateRange(registration.id, from, to);
      setEntries(data);
      setLoading(false);
      const groups = groupByDate(data);
      const dates = new Set<string>();
      if (groups.length > 0) dates.add(groups[0].date);
      setExpandedDates(dates);
    },
    [registration?.id]
  );

  useFocusEffect(
    useCallback(() => {
      loadEntries(fromDate, toDate);
    }, [loadEntries, fromDate, toDate])
  );

  const handleApplyFilter = () => {
    setFromDate(pendingFrom);
    setToDate(pendingTo);
    setFilterVisible(false);
    loadEntries(pendingFrom, pendingTo);
  };

  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setPendingFrom(toISO(start));
    setPendingTo(toISO(end));
  };

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const grouped = groupByDate(entries);
  const totalDevotees = entries
    .filter((e) => e.status !== "cancelled")
    .reduce((sum, e) => sum + (e.verified_devotee_count ?? e.declared_devotee_count), 0);
  const verifiedCount = entries.filter((e) => e.status === "verified").length;
  const totalEntries = entries.filter((e) => e.status !== "cancelled").length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <History size={22} color={COLORS.primary} />
          <Text style={styles.headerTitle}>{t("app.history.title")}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => router.push("/(app)/notifications")}
          >
            <Bell size={20} color={COLORS.textSecondary} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterVisible && styles.filterButtonActive]}
            onPress={() => setFilterVisible((v) => !v)}
          >
            <Filter size={18} color={filterVisible ? COLORS.surface : COLORS.primary} />
            <Text style={[styles.filterButtonText, filterVisible && styles.filterButtonTextActive]}>
              {t("app.history.filter")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {filterVisible && (
        <View style={styles.filterPanel}>
          <View style={styles.presetRow}>
            {[7, 14, 30].map((d) => (
              <TouchableOpacity key={d} style={styles.presetChip} onPress={() => setPreset(d)}>
                <Text style={styles.presetChipText}>{t("app.history.lastDays", { d })}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>{t("app.history.from")}</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowFromPicker(true)}
                activeOpacity={0.7}
              >
                <Calendar size={15} color={COLORS.primary} />
                <Text style={styles.datePickerText}>{formatDate(pendingFrom)}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateSeparator}>
              <Text style={styles.dateSeparatorText}>to</Text>
            </View>
            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>{t("app.history.to")}</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowToPicker(true)}
                activeOpacity={0.7}
              >
                <Calendar size={15} color={COLORS.primary} />
                <Text style={styles.datePickerText}>{formatDate(pendingTo)}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.applyButton} onPress={handleApplyFilter}>
            <Text style={styles.applyButtonText}>{t("app.history.apply")}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.rangeLabel}>
        <Calendar size={14} color={COLORS.textSecondary} />
        <Text style={styles.rangeLabelText}>
          {formatDate(fromDate)} – {formatDate(toDate)}
        </Text>
      </View>

      {!loading && entries.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalEntries}</Text>
            <Text style={styles.summaryLabel}>{t("supervisor.dashboard.entries")}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalDevotees}</Text>
            <Text style={styles.summaryLabel}>{t("supervisor.dashboard.devotees")}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: COLORS.success }]}>{verifiedCount}</Text>
            <Text style={styles.summaryLabel}>{t("supervisor.history.verified")}</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centerStateText}>{t("app.history.loadingHistory")}</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centerState}>
          <View style={styles.emptyIcon}>
            <TicketCheck size={40} color={COLORS.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>{t("app.history.noEntries")}</Text>
          <Text style={styles.emptySubtitle}>{t("app.history.noEntriesInRange")}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {grouped.map(({ date, entries: dayEntries }) => {
            const expanded = expandedDates.has(date);
            const dayDevotees = dayEntries
              .filter((e) => e.status !== "cancelled")
              .reduce((s, e) => s + (e.verified_devotee_count ?? e.declared_devotee_count), 0);

            return (
              <View key={date} style={styles.dateGroup}>
                <TouchableOpacity
                  style={styles.dateHeader}
                  onPress={() => toggleDate(date)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dateHeaderLeft}>
                    <View style={styles.dateDot} />
                    <View>
                      <Text style={styles.dateText}>{formatDate(date)}</Text>
                      <Text style={styles.dateMeta}>
                        {dayEntries.length} {dayEntries.length > 1 ? "tickets" : "ticket"} · {dayDevotees} {dayDevotees !== 1 ? t("supervisor.dashboard.devotees").toLowerCase() : "devotee"}
                      </Text>
                    </View>
                  </View>
                  {expanded ? (
                    <ChevronUp size={18} color={COLORS.textSecondary} />
                  ) : (
                    <ChevronDown size={18} color={COLORS.textSecondary} />
                  )}
                </TouchableOpacity>

                {expanded && (
                  <View style={styles.entriesList}>
                    {dayEntries.map((entry) => {
                      const cfg = STATUS_CONFIG[entry.status] ?? { label: entry.status, color: COLORS.textSecondary };
                      const count = entry.verified_devotee_count ?? entry.declared_devotee_count;
                      return (
                        <View key={entry.id} style={styles.entryCard}>
                          <View style={styles.entryTop}>
                            <View style={styles.entryCodeBadge}>
                              <Text style={styles.entryCode}>{entry.entry_code}</Text>
                            </View>
                            {entry.entry_mode === "marjana_mandap" && (
                              <View style={styles.innerGateBadge}>
                                <Text style={styles.innerGateBadgeText}>Inner Gate</Text>
                              </View>
                            )}
                            <View style={[styles.statusBadge, { backgroundColor: cfg.color + "18" }]}>
                              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                            </View>
                          </View>
                          <View style={styles.entryDetails}>
                            <View style={styles.entryDetailItem}>
                              <Users size={14} color={COLORS.textSecondary} />
                              <Text style={styles.entryDetailText}>
                                {t("app.history.devoteeCount", { count })}
                                {entry.verified_devotee_count !== null &&
                                  entry.verified_devotee_count !== entry.declared_devotee_count && (
                                    <Text style={styles.adjustedNote}> {t("app.history.adjustedFrom", { declared: entry.declared_devotee_count })}</Text>
                                  )}
                              </Text>
                            </View>
                            {entry.west_gate_entry_time && (
                              <View style={styles.entryDetailItem}>
                                <Calendar size={14} color={COLORS.textSecondary} />
                                <Text style={styles.entryDetailText}>
                                  {t("app.history.westGateTime", { time: formatTime(entry.west_gate_entry_time) })}
                                </Text>
                              </View>
                            )}
                            {entry.inner_gate_verification_time && (
                              <View style={styles.entryDetailItem}>
                                <Calendar size={14} color={COLORS.success} />
                                <Text style={[styles.entryDetailText, { color: COLORS.success }]}>
                                  {t("app.history.innerGateTime", { time: formatTime(entry.inner_gate_verification_time) })}
                                </Text>
                              </View>
                            )}
                            {entry.notes && (
                              <Text style={styles.entryNotes}>{entry.notes}</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <CalendarPicker
        visible={showFromPicker}
        title={t("app.history.selectFromDate")}
        selectedDate={pendingFrom}
        maxDate={pendingTo}
        onSelect={(d) => { setPendingFrom(d); setShowFromPicker(false); }}
        onClose={() => setShowFromPicker(false)}
      />
      <CalendarPicker
        visible={showToPicker}
        title={t("app.history.selectToDate")}
        selectedDate={pendingTo}
        minDate={pendingFrom}
        maxDate={todayISO}
        onSelect={(d) => { setPendingTo(d); setShowToPicker(false); }}
        onClose={() => setShowToPicker(false)}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.error,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  filterButtonTextActive: {
    color: COLORS.surface,
  },
  filterPanel: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  presetRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  presetChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  dateField: {
    flex: 1,
  },
  dateFieldLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.primary + "40",
  },
  datePickerText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
  },
  dateSeparator: {
    paddingTop: 26,
    alignItems: "center",
  },
  dateSeparatorText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: "center",
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  rangeLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  rangeLabelText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  centerStateText: {
    marginTop: SPACING.md,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  dateGroup: {
    marginBottom: SPACING.md,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  dateHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  dateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  dateText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  dateMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  entriesList: {
    marginTop: SPACING.xs,
    paddingLeft: SPACING.sm,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primaryLight,
    marginLeft: SPACING.xs,
  },
  entryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  entryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  entryCodeBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  innerGateBadge: {
    backgroundColor: "#0891b215",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: "#0891b230",
  },
  innerGateBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0891b2",
    letterSpacing: 0.3,
  },
  entryCode: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  entryDetails: {
    gap: SPACING.xs,
  },
  entryDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  entryDetailText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  adjustedNote: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  entryNotes: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: "italic",
    marginTop: 2,
  },
});
