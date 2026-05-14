import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Calendar, Users, ChevronDown, ChevronUp, TrendingUp, TicketCheck, CircleCheck as CheckCircle2, Clock, Circle as XCircle, TriangleAlert as AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";
import type { GateEntry } from "@/types/database";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:             { label: "Pending",        color: COLORS.warning,      bg: COLORS.warningLight },
  registered:          { label: "At Inner Gate",  color: COLORS.primary,      bg: COLORS.primaryLight },
  verified:            { label: "Verified",        color: COLORS.success,      bg: COLORS.successLight },
  cancelled:           { label: "Cancelled",       color: COLORS.textMuted,    bg: COLORS.surfaceSecondary },
  discrepancy_flagged: { label: "Flagged",         color: COLORS.error,        bg: COLORS.errorLight },
};

function toISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function formatTime(isoStr: string | null) {
  if (!isoStr) return "—";
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

function StatusIcon({ status, size = 16 }: { status: string; size?: number }) {
  const color = STATUS_CONFIG[status]?.color || COLORS.textMuted;
  switch (status) {
    case "verified":            return <CheckCircle2 size={size} color={color} />;
    case "registered":          return <Clock size={size} color={color} />;
    case "pending":             return <TicketCheck size={size} color={color} />;
    case "discrepancy_flagged": return <AlertTriangle size={size} color={color} />;
    default:                    return <XCircle size={size} color={color} />;
  }
}

export default function UserHistoryScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [entries, setEntries] = useState<GateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [calendarOpen, setCalendarOpen] = useState<"from" | "to" | null>(null);

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29);

  const [fromDate, setFromDate] = useState(toISO(thirtyDaysAgo));
  const [toDate, setToDate] = useState(toISO(today));
  const [calMonth, setCalMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const fetchEntries = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("gate_entries")
      .select("*")
      .eq("sebayat_id", id)
      .gte("entry_date", fromDate)
      .lte("entry_date", toDate)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error && data) {
      setEntries(data);
      const dates = new Set(data.map((e: GateEntry) => e.entry_date));
      setExpandedDates(dates);
    }
    setLoading(false);
  }, [id, fromDate, toDate]);

  useFocusEffect(useCallback(() => { fetchEntries(); }, [fetchEntries]));

  const grouped = groupByDate(entries);

  const totalDevotees = entries.reduce((sum, e) => sum + (e.verified_devotee_count ?? e.declared_devotee_count), 0);
  const verifiedCount = entries.filter((e) => e.status === "verified").length;

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setFromDate(toISO(start));
    setToDate(toISO(end));
  };

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay();

  const buildCalDays = (y: number, m: number) => {
    const days: (string | null)[] = [];
    const first = getFirstDay(y, m);
    const total = getDaysInMonth(y, m);
    for (let i = 0; i < first; i++) days.push(null);
    for (let i = 1; i <= total; i++) {
      days.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
    }
    return days;
  };

  const calDays = buildCalDays(calMonth.year, calMonth.month);

  const prevMonth = () => {
    setCalMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setCalMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const selectCalDay = (dayStr: string) => {
    if (calendarOpen === "from") {
      setFromDate(dayStr);
      if (dayStr > toDate) setToDate(dayStr);
    } else if (calendarOpen === "to") {
      setToDate(dayStr);
      if (dayStr < fromDate) setFromDate(dayStr);
    }
    setCalendarOpen(null);
  };

  const openCalendar = (type: "from" | "to") => {
    const target = type === "from" ? fromDate : toDate;
    const [y, m] = target.split("-");
    setCalMonth({ year: parseInt(y), month: parseInt(m) - 1 });
    setCalendarOpen(type);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Activity History</Text>
            {name ? <Text style={styles.subtitle}>{name}</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.presets}>
            {[7, 14, 30].map((d) => (
              <TouchableOpacity key={d} style={styles.presetBtn} onPress={() => applyPreset(d)} activeOpacity={0.7}>
                <Text style={styles.presetText}>{d}d</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.datePicker} onPress={() => openCalendar("from")} activeOpacity={0.7}>
              <Calendar size={14} color={COLORS.primary} />
              <Text style={styles.datePickerText}>{formatDate(fromDate)}</Text>
            </TouchableOpacity>
            <Text style={styles.dateSeparator}>→</Text>
            <TouchableOpacity style={styles.datePicker} onPress={() => openCalendar("to")} activeOpacity={0.7}>
              <Calendar size={14} color={COLORS.primary} />
              <Text style={styles.datePickerText}>{formatDate(toDate)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {calendarOpen && (
          <View style={styles.calendarCard}>
            <View style={styles.calNav}>
              <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn} activeOpacity={0.7}>
                <ChevronLeft size={18} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.calMonthLabel}>
                {FULL_MONTHS[calMonth.month]} {calMonth.year}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn} activeOpacity={0.7}>
                <ChevronRight size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.calDayNames}>
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
                <Text key={d} style={styles.calDayName}>{d}</Text>
              ))}
            </View>
            <View style={styles.calGrid}>
              {calDays.map((day, i) => {
                if (!day) return <View key={`empty-${i}`} style={styles.calCell} />;
                const isFrom = day === fromDate;
                const isTo = day === toDate;
                const inRange = day > fromDate && day < toDate;
                const isSelected = isFrom || isTo;
                const isFuture = day > toISO(new Date());
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.calCell,
                      isSelected && styles.calCellSelected,
                      inRange && styles.calCellInRange,
                      isFuture && styles.calCellDisabled,
                    ]}
                    onPress={() => !isFuture && selectCalDay(day)}
                    activeOpacity={0.7}
                    disabled={isFuture}
                  >
                    <Text style={[
                      styles.calCellText,
                      isSelected && styles.calCellTextSelected,
                      inRange && styles.calCellTextInRange,
                      isFuture && styles.calCellTextDisabled,
                    ]}>
                      {parseInt(day.split("-")[2], 10)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { borderLeftColor: COLORS.primary }]}>
                <Text style={styles.statValue}>{entries.length}</Text>
                <Text style={styles.statLabel}>Total Entries</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: COLORS.success }]}>
                <Text style={styles.statValue}>{verifiedCount}</Text>
                <Text style={styles.statLabel}>Verified</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: COLORS.accent }]}>
                <Text style={styles.statValue}>{totalDevotees}</Text>
                <Text style={styles.statLabel}>Devotees</Text>
              </View>
            </View>

            {grouped.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <TrendingUp size={40} color={COLORS.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No activity found</Text>
                <Text style={styles.emptySubtitle}>No entries in the selected date range</Text>
              </View>
            ) : (
              grouped.map(({ date, entries: dayEntries }) => {
                const expanded = expandedDates.has(date);
                const dayTotal = dayEntries.reduce((s, e) => s + (e.verified_devotee_count ?? e.declared_devotee_count), 0);
                const dayVerified = dayEntries.filter((e) => e.status === "verified").length;
                return (
                  <View key={date} style={styles.dateGroup}>
                    <TouchableOpacity
                      style={styles.dateHeader}
                      onPress={() => toggleDate(date)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.dateHeaderLeft}>
                        <View style={styles.dateDot} />
                        <View>
                          <Text style={styles.dateLabel}>{formatDate(date)}</Text>
                          <Text style={styles.dateMeta}>
                            {dayEntries.length} {dayEntries.length === 1 ? "entry" : "entries"} · {dayTotal} devotees
                            {dayVerified > 0 ? ` · ${dayVerified} verified` : ""}
                          </Text>
                        </View>
                      </View>
                      {expanded ? (
                        <ChevronUp size={18} color={COLORS.textSecondary} />
                      ) : (
                        <ChevronDown size={18} color={COLORS.textSecondary} />
                      )}
                    </TouchableOpacity>

                    {expanded &&
                      dayEntries.map((entry) => {
                        const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.cancelled;
                        const adjustedCount = entry.verified_devotee_count !== null &&
                          entry.verified_devotee_count !== entry.declared_devotee_count;
                        return (
                          <View key={entry.id} style={styles.entryCard}>
                            <View style={styles.entryTop}>
                              <View style={styles.entryCodeRow}>
                                <TicketCheck size={14} color={COLORS.textSecondary} />
                                <Text style={styles.entryCode}>{entry.entry_code}</Text>
                              </View>
                              <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                                <StatusIcon status={entry.status} size={12} />
                                <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                              </View>
                            </View>

                            <View style={styles.entryDetails}>
                              <View style={styles.entryDetail}>
                                <Users size={13} color={COLORS.textSecondary} />
                                <Text style={styles.entryDetailText}>
                                  {adjustedCount
                                    ? `${entry.verified_devotee_count} devotees (declared: ${entry.declared_devotee_count})`
                                    : `${entry.declared_devotee_count} devotees`}
                                </Text>
                              </View>

                              {entry.west_gate_entry_time && (
                                <View style={styles.entryDetail}>
                                  <Clock size={13} color={COLORS.textSecondary} />
                                  <Text style={styles.entryDetailText}>
                                    West Gate: {formatTime(entry.west_gate_entry_time)}
                                    {entry.inner_gate_verification_time
                                      ? `  ·  Inner Gate: ${formatTime(entry.inner_gate_verification_time)}`
                                      : ""}
                                  </Text>
                                </View>
                              )}

                              {entry.notes && (
                                <View style={styles.notesRow}>
                                  <Text style={styles.notesText}>{entry.notes}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  section: {
    marginBottom: 16,
    gap: 10,
  },
  presets: {
    flexDirection: "row",
    gap: 8,
  },
  presetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  datePicker: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  datePickerText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
  },
  dateSeparator: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
  calendarCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
    ...SHADOWS.medium,
  },
  calNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  calMonthLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  calDayNames: {
    flexDirection: "row",
    marginBottom: 6,
  },
  calDayName: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
    paddingVertical: 4,
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: RADIUS.sm,
  },
  calCellSelected: {
    backgroundColor: COLORS.primary,
  },
  calCellInRange: {
    backgroundColor: COLORS.primaryLight,
  },
  calCellDisabled: {
    opacity: 0.3,
  },
  calCellText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
  },
  calCellTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  calCellTextInRange: {
    color: COLORS.primary,
  },
  calCellTextDisabled: {
    color: COLORS.textMuted,
  },
  loadingContainer: {
    paddingTop: 60,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 40,
    gap: 8,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  dateGroup: {
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOWS.small,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    paddingHorizontal: 16,
  },
  dateHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  dateMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  entryCard: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  entryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  entryCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  entryCode: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  entryDetails: {
    gap: 6,
  },
  entryDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  entryDetailText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  notesRow: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 2,
  },
  notesText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: "italic",
  },
});
