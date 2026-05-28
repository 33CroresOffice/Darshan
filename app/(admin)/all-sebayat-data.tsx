import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Users,
  CircleCheck as CheckCircle2,
  SlidersHorizontal,
  X,
} from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { supabase } from "@/lib/supabase";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type DateMode = "single" | "range";
type CalendarTarget = "single" | "from" | "to";
type StatusFilter = "all" | "verified" | "registered" | "pending" | "cancelled" | "discrepancy_flagged";

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Verified", value: "verified" },
  { label: "At Inner Gate", value: "registered" },
  { label: "Pending", value: "pending" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Flagged", value: "discrepancy_flagged" },
];

const STATUS_COLORS: Record<string, string> = {
  verified: COLORS.success,
  registered: COLORS.primary,
  pending: COLORS.warning,
  cancelled: COLORS.textMuted,
  discrepancy_flagged: COLORS.error,
};

const STATUS_LABELS: Record<string, string> = {
  verified: "Verified",
  registered: "At Inner Gate",
  pending: "Pending",
  cancelled: "Cancelled",
  discrepancy_flagged: "Flagged",
};

interface SebayatRow {
  sebayat_id: string;
  sebayat_name: string;
  entry_date: string;
  total_entries: number;
  total_declared: number;
  total_verified: number;
  status_breakdown: Record<string, number>;
}

function toISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function buildCalDays(y: number, m: number): (string | null)[] {
  const days: (string | null)[] = [];
  const firstDay = new Date(y, m, 1).getDay();
  const total = new Date(y, m + 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= total; i++) {
    days.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
  }
  return days;
}

function subtractDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISO(d);
}

const RANGE_PRESETS = [
  { label: "Today", from: toISO(new Date()), to: toISO(new Date()) },
  { label: "Last 7 days", from: subtractDays(6), to: toISO(new Date()) },
  { label: "Last 30 days", from: subtractDays(29), to: toISO(new Date()) },
  { label: "Last 90 days", from: subtractDays(89), to: toISO(new Date()) },
];

export default function AllSebayatDataScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const today = new Date();

  const [dateMode] = useState<DateMode>("range");

  const [selectedDate, setSelectedDate] = useState(toISO(today));
  const [fromDate, setFromDate] = useState(subtractDays(6));
  const [toDate, setToDate] = useState(toISO(today));

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calTarget, setCalTarget] = useState<CalendarTarget>("single");
  const [calMonth, setCalMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rows, setRows] = useState<SebayatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"name" | "quota" | "verified" | "date">("quota");
  const [sortAsc, setSortAsc] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("gate_entries")
      .select(`
        id,
        sebayat_id,
        entry_date,
        declared_devotee_count,
        verified_devotee_count,
        status,
        sebayat:sebayat_id (
          full_name
        )
      `);

    if (dateMode === "single") {
      query = query.eq("entry_date", selectedDate);
    } else {
      query = query.gte("entry_date", fromDate).lte("entry_date", toDate);
    }

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error || !data) {
      setRows([]);
      setLoading(false);
      return;
    }

    const map: Record<string, SebayatRow> = {};
    for (const entry of data as any[]) {
      const sid = entry.sebayat_id;
      const name = entry.sebayat?.full_name || "Unknown";
      const key = dateMode === "range" ? `${sid}` : `${sid}`;
      if (!map[key]) {
        map[key] = {
          sebayat_id: sid,
          sebayat_name: name,
          entry_date: entry.entry_date,
          total_entries: 0,
          total_declared: 0,
          total_verified: 0,
          status_breakdown: {},
        };
      }
      const row = map[key];
      if (entry.entry_date > row.entry_date) row.entry_date = entry.entry_date;
      row.total_entries += 1;
      row.total_declared += entry.declared_devotee_count || 0;
      row.total_verified += entry.verified_devotee_count ?? entry.declared_devotee_count ?? 0;
      row.status_breakdown[entry.status] = (row.status_breakdown[entry.status] || 0) + 1;
    }

    setRows(Object.values(map));
    setLoading(false);
  }, [selectedDate, fromDate, toDate, dateMode, statusFilter]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const filtered = rows.filter((r) =>
    r.sebayat_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") cmp = a.sebayat_name.localeCompare(b.sebayat_name);
    else if (sortBy === "quota") cmp = a.total_declared - b.total_declared;
    else if (sortBy === "verified") cmp = a.total_verified - b.total_verified;
    else if (sortBy === "date") cmp = a.entry_date.localeCompare(b.entry_date);
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (col: "name" | "quota" | "verified" | "date") => {
    if (sortBy === col) setSortAsc((p) => !p);
    else { setSortBy(col); setSortAsc(false); }
  };

  const totalDevotees = sorted.reduce((s, r) => s + r.total_declared, 0);
  const totalVerified = sorted.reduce((s, r) => s + r.total_verified, 0);

  const openCalendar = (target: CalendarTarget, refDate: string) => {
    const [y, m] = refDate.split("-");
    setCalMonth({ year: parseInt(y), month: parseInt(m) - 1 });
    setCalTarget(target);
    setCalendarOpen(true);
  };

  const selectDay = (day: string) => {
    if (calTarget === "single") {
      setSelectedDate(day);
    } else if (calTarget === "from") {
      setFromDate(day);
      if (day > toDate) setToDate(day);
    } else {
      setToDate(day);
      if (day < fromDate) setFromDate(day);
    }
    setCalendarOpen(false);
  };

  const applyPreset = (preset: { from: string; to: string }) => {
    setFromDate(preset.from);
    setToDate(preset.to);
  };

  const prevMonth = () =>
    setCalMonth((p) => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });

  const nextMonth = () =>
    setCalMonth((p) => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });

  const calDays = buildCalDays(calMonth.year, calMonth.month);
  const todayISO = toISO(new Date());

  const isInRange = (day: string) =>
    dateMode === "range" && calTarget !== "single" && day >= fromDate && day <= toDate;

  const SortArrow = ({ col }: { col: "name" | "quota" | "verified" | "date" }) => {
    if (sortBy !== col) return <ChevronDown size={12} color={COLORS.textMuted} />;
    return (
      <Text style={{ fontSize: 10, color: COLORS.primary, fontWeight: "700" }}>
        {sortAsc ? "▲" : "▼"}
      </Text>
    );
  };

  const activeSingle = calTarget === "single" ? selectedDate : calTarget === "from" ? fromDate : toDate;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 16 }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>All Darshan Data</Text>
            <Text style={styles.subtitle}>Quota usage by date</Text>
          </View>
        </View>



        <View style={styles.controls}>
          {dateMode === "single" ? (
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => openCalendar("single", selectedDate)}
              activeOpacity={0.7}
            >
              <Calendar size={16} color={COLORS.primary} />
              <Text style={styles.dateButtonText}>{formatDate(selectedDate)}</Text>
              <ChevronDown size={14} color={COLORS.primary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.rangeContainer}>
              <View style={styles.rangeRow}>
                <TouchableOpacity
                  style={[styles.rangeDateBtn, calendarOpen && calTarget === "from" && styles.rangeDateBtnActive]}
                  onPress={() => openCalendar("from", fromDate)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rangeDateLabel}>From</Text>
                  <Text style={styles.rangeDateValue}>{formatDate(fromDate)}</Text>
                </TouchableOpacity>
                <View style={styles.rangeSep} />
                <TouchableOpacity
                  style={[styles.rangeDateBtn, calendarOpen && calTarget === "to" && styles.rangeDateBtnActive]}
                  onPress={() => openCalendar("to", toDate)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rangeDateLabel}>To</Text>
                  <Text style={styles.rangeDateValue}>{formatDate(toDate)}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
                {RANGE_PRESETS.map((preset) => {
                  const active = preset.from === fromDate && preset.to === toDate;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      style={[styles.presetChip, active && styles.presetChipActive]}
                      onPress={() => { applyPreset(preset); setCalendarOpen(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Search size={14} color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search sebayat..."
                placeholderTextColor={COLORS.textMuted}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
                  <X size={14} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.filterBtn, filtersOpen && styles.filterBtnActive]}
              onPress={() => setFiltersOpen((p) => !p)}
              activeOpacity={0.7}
            >
              <SlidersHorizontal size={16} color={filtersOpen ? COLORS.primary : COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {filtersOpen && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusScroll}>
              {STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.statusChip, statusFilter === opt.value && styles.statusChipActive]}
                  onPress={() => setStatusFilter(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.statusChipText, statusFilter === opt.value && styles.statusChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {calendarOpen && (
          <View style={styles.calendarCard}>
            {dateMode === "range" && (
              <View style={styles.calTargetBanner}>
                <Text style={styles.calTargetText}>
                  Selecting: {calTarget === "from" ? "Start Date" : "End Date"}
                </Text>
                <TouchableOpacity onPress={() => setCalendarOpen(false)} activeOpacity={0.7}>
                  <X size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
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
                if (!day) return <View key={`e-${i}`} style={styles.calCell} />;
                const isSelected = day === activeSingle;
                const inRange = isInRange(day);
                const isFrom = dateMode === "range" && day === fromDate;
                const isTo = dateMode === "range" && day === toDate;
                const isFuture = day > todayISO;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.calCell,
                      (isSelected || isFrom || isTo) && styles.calCellSelected,
                      inRange && !isFrom && !isTo && styles.calCellInRange,
                      isFuture && styles.calCellDisabled,
                    ]}
                    onPress={() => !isFuture && selectDay(day)}
                    activeOpacity={0.7}
                    disabled={isFuture}
                  >
                    <Text style={[
                      styles.calCellText,
                      (isSelected || isFrom || isTo) && styles.calCellTextSelected,
                      inRange && !isFrom && !isTo && styles.calCellTextInRange,
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
            <Text style={styles.loadingText}>Loading data...</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { borderLeftColor: COLORS.primary }]}>
                <Text style={styles.summaryValue}>{sorted.length}</Text>
                <Text style={styles.summaryLabel}>Darshans</Text>
              </View>
              <View style={[styles.summaryCard, { borderLeftColor: "#F59E0B" }]}>
                <Text style={styles.summaryValue}>{totalDevotees}</Text>
                <Text style={styles.summaryLabel}>Total Declared</Text>
              </View>
              <View style={[styles.summaryCard, { borderLeftColor: COLORS.success }]}>
                <Text style={styles.summaryValue}>{totalVerified}</Text>
                <Text style={styles.summaryLabel}>Total Verified</Text>
              </View>
            </View>

            {sorted.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <Users size={40} color={COLORS.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No data found</Text>
                <Text style={styles.emptySubtitle}>
                  {statusFilter !== "all"
                    ? "Try changing the status filter"
                    : dateMode === "single"
                    ? "No entries recorded on " + formatDate(selectedDate)
                    : `No entries between ${formatDate(fromDate)} and ${formatDate(toDate)}`}
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tableCard}>
                  <View style={styles.tableHeader}>
                    <TouchableOpacity style={[styles.colName, styles.colHeaderRow]} onPress={() => toggleSort("name")} activeOpacity={0.7}>
                      <Text style={styles.colHeaderText}>Darshan Name</Text>
                      <SortArrow col="name" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.colQuota, styles.colHeaderRow]} onPress={() => toggleSort("quota")} activeOpacity={0.7}>
                      <Text style={styles.colHeaderText}>Declared</Text>
                      <SortArrow col="quota" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.colVerified, styles.colHeaderRow]} onPress={() => toggleSort("verified")} activeOpacity={0.7}>
                      <Text style={styles.colHeaderText}>Verified</Text>
                      <SortArrow col="verified" />
                    </TouchableOpacity>
                    <View style={[styles.colStatus, styles.colHeaderRow]}>
                      <View style={[styles.statusDot, { backgroundColor: COLORS.warning }]} />
                      <Text style={styles.colHeaderText}>Pending</Text>
                    </View>
                    <View style={[styles.colStatus, styles.colHeaderRow]}>
                      <View style={[styles.statusDot, { backgroundColor: COLORS.primary }]} />
                      <Text style={styles.colHeaderText}>Inner Gate</Text>
                    </View>
                    <View style={[styles.colStatus, styles.colHeaderRow]}>
                      <View style={[styles.statusDot, { backgroundColor: COLORS.textMuted }]} />
                      <Text style={styles.colHeaderText}>Cancelled</Text>
                    </View>
                    <View style={[styles.colStatus, styles.colHeaderRow]}>
                      <View style={[styles.statusDot, { backgroundColor: COLORS.error }]} />
                      <Text style={styles.colHeaderText}>Flagged</Text>
                    </View>
                  </View>

                  {sorted.map((row, index) => (
                    <View key={row.sebayat_id} style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}>
                      <View style={styles.colName}>
                        <Text style={styles.cellName} numberOfLines={1}>{row.sebayat_name}</Text>
                        {dateMode === "range" && row.total_entries > 1 && (
                          <Text style={styles.cellDateSub}>{row.total_entries} entries</Text>
                        )}
                      </View>
                      <View style={styles.colQuota}>
                        <View style={styles.quotaCell}>
                          <Users size={13} color={COLORS.textSecondary} />
                          <Text style={styles.cellNumber}>{row.total_declared}</Text>
                        </View>
                      </View>
                      <View style={styles.colVerified}>
                        <View style={styles.quotaCell}>
                          <CheckCircle2 size={13} color={row.total_verified > 0 ? COLORS.success : COLORS.textMuted} />
                          <Text style={[styles.cellNumber, { color: row.total_verified > 0 ? COLORS.success : COLORS.textMuted }]}>
                            {row.total_verified}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.colStatus}>
                        <Text style={[styles.statusCount, (row.status_breakdown["pending"] || 0) > 0 && { color: COLORS.warning, fontWeight: "700" }]}>
                          {row.status_breakdown["pending"] || 0}
                        </Text>
                      </View>
                      <View style={styles.colStatus}>
                        <Text style={[styles.statusCount, (row.status_breakdown["registered"] || 0) > 0 && { color: COLORS.primary, fontWeight: "700" }]}>
                          {row.status_breakdown["registered"] || 0}
                        </Text>
                      </View>
                      <View style={styles.colStatus}>
                        <Text style={[styles.statusCount, (row.status_breakdown["cancelled"] || 0) > 0 && { color: COLORS.textMuted, fontWeight: "700" }]}>
                          {row.status_breakdown["cancelled"] || 0}
                        </Text>
                      </View>
                      <View style={styles.colStatus}>
                        <Text style={[styles.statusCount, (row.status_breakdown["discrepancy_flagged"] || 0) > 0 && { color: COLORS.error, fontWeight: "700" }]}>
                          {row.status_breakdown["discrepancy_flagged"] || 0}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
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
  modeSwitcher: {
    flexDirection: "row",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 3,
    marginBottom: 14,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  modeTabActive: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.small,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  modeTabTextActive: {
    fontWeight: "600",
    color: COLORS.primary,
  },
  controls: {
    gap: 10,
    marginBottom: 16,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  rangeContainer: {
    gap: 8,
  },
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  rangeDateBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rangeDateBtnActive: {
    backgroundColor: COLORS.primaryLight,
  },
  rangeDateLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rangeDateValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  rangeSep: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
  presetScroll: {
    flexGrow: 0,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  presetChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  presetChipTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  statusScroll: {
    flexGrow: 0,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  statusChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  statusChipTextActive: {
    color: "#fff",
    fontWeight: "600",
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
  calTargetBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  calTargetText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
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
    marginBottom: 4,
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
    borderRadius: 0,
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
    fontWeight: "600",
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
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 12,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 48,
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
    paddingHorizontal: 24,
  },
  tableCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOWS.small,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  colHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  colHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  colName: {
    width: 160,
    paddingRight: 8,
  },
  colQuota: {
    width: 72,
    alignItems: "center",
  },
  colVerified: {
    width: 72,
    alignItems: "center",
  },
  colDate: {
    flex: 1.8,
    alignItems: "flex-end",
  },
  colStatus: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusCount: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textMuted,
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  tableRowAlt: {
    backgroundColor: COLORS.background,
  },
  cellName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  quotaCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cellNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  cellDate: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "500",
    textAlign: "right",
  },
  cellDateSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: "right",
    marginTop: 2,
  },
});
