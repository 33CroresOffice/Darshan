import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { CalendarPicker, formatDateDisplay } from "@/components/forms/CalendarPicker";
import { useRouter } from "expo-router";
import { FileText, Calendar, ListFilter as Filter, ChevronDown, ChevronUp, Clock, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Circle as XCircle, Users, ChevronRight, Shield } from "lucide-react-native";
import {
  generateReport,
  ReportFilters,
  ReportSummary,
  EntryReport,
} from "@/services/analyticsService";
import { getCategories } from "@/services/categoryService";
import { COLORS, SHADOWS } from "@/constants/config";
import type { Category } from "@/types/database";

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Registered", value: "registered" },
  { label: "Verified", value: "verified" },
  { label: "Flagged", value: "discrepancy_flagged" },
  { label: "Cancelled", value: "cancelled" },
];

const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
];

export default function ReportsScreen() {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [filters, setFilters] = useState<ReportFilters>({
    startDate: weekAgo,
    endDate: today,
    status: "",
    categoryId: "",
  });
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<"start" | "end" | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const [reportData, categoriesData] = await Promise.all([
        generateReport(filters),
        getCategories(),
      ]);
      setReport(reportData);
      setCategories(categoriesData);
    } catch (err) {
      console.error("Failed to generate report:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReport();
    setRefreshing(false);
  };

  const handleDatePreset = (days: number) => {
    const end = new Date().toISOString().split("T")[0];
    const start =
      days === 0
        ? end
        : new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0];
    setFilters((prev) => ({ ...prev, startDate: start, endDate: end }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock size={14} color="#8B5CF6" />;
      case "registered":
        return <Clock size={14} color="#F59E0B" />;
      case "verified":
        return <CheckCircle size={14} color="#10B981" />;
      case "discrepancy_flagged":
        return <AlertTriangle size={14} color="#EF4444" />;
      case "cancelled":
        return <XCircle size={14} color="#6B7280" />;
      default:
        return <Clock size={14} color="#6B7280" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return { bg: "#EDE9FE", text: "#8B5CF6" };
      case "registered":
        return { bg: "#FEF3C7", text: "#F59E0B" };
      case "verified":
        return { bg: "#D1FAE5", text: "#10B981" };
      case "discrepancy_flagged":
        return { bg: "#FEE2E2", text: "#EF4444" };
      case "cancelled":
        return { bg: "#F3F4F6", text: "#6B7280" };
      default:
        return { bg: "#F3F4F6", text: "#6B7280" };
    }
  };

  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  };

  const Card = ({
    children,
    style,
  }: {
    children: React.ReactNode;
    style?: any;
  }) => <View style={[styles.card, style]}>{children}</View>;

  const EntryRow = ({ entry }: { entry: EntryReport }) => {
    const isExpanded = expandedEntry === entry.id;
    const statusColors = getStatusColor(entry.status);

    return (
      <TouchableOpacity
        style={styles.entryRow}
        onPress={() => setExpandedEntry(isExpanded ? null : entry.id)}
        activeOpacity={0.7}
      >
        <View style={styles.entryHeader}>
          <View style={styles.entryMain}>
            <Text style={styles.entryCode}>{entry.entryCode}</Text>
            <Text style={styles.entryName}>{entry.sebayatName}</Text>
          </View>
          <View style={styles.entryRight}>
            <View
              style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}
            >
              {getStatusIcon(entry.status)}
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {formatStatus(entry.status)}
              </Text>
            </View>
            {isExpanded ? (
              <ChevronUp size={18} color={COLORS.textMuted} />
            ) : (
              <ChevronDown size={18} color={COLORS.textMuted} />
            )}
          </View>
        </View>

        <View style={styles.entryMeta}>
          <Text style={styles.entryDate}>
            {new Date(entry.entryDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
          </Text>
          <View style={styles.devoteeCount}>
            <Users size={12} color={COLORS.textSecondary} />
            <Text style={styles.devoteeText}>
              {entry.verifiedCount ?? entry.declaredCount} devotees
            </Text>
          </View>
          <Text style={styles.categoryBadge}>{entry.categoryName}</Text>
        </View>

        {isExpanded && (
          <View style={styles.entryDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Declared Count</Text>
              <Text style={styles.detailValue}>{entry.declaredCount}</Text>
            </View>
            {entry.verifiedCount !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Verified Count</Text>
                <Text style={styles.detailValue}>{entry.verifiedCount}</Text>
              </View>
            )}
            {entry.westGateSupervisor && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>West Gate</Text>
                <Text style={styles.detailValue}>
                  {entry.westGateSupervisor}
                </Text>
              </View>
            )}
            {entry.innerGateSupervisor && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Inner Gate</Text>
                <Text style={styles.detailValue}>
                  {entry.innerGateSupervisor}
                </Text>
              </View>
            )}
            {entry.westGateTime && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>West Gate Time</Text>
                <Text style={styles.detailValue}>
                  {new Date(entry.westGateTime).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            )}
            {entry.innerGateTime && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Inner Gate Time</Text>
                <Text style={styles.detailValue}>
                  {new Date(entry.innerGateTime).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

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
          <Text style={styles.title}>Reports</Text>
          <Text style={styles.subtitle}>Generate and view entry reports</Text>
        </View>

        <View style={styles.quickLinks}>
          <TouchableOpacity
            style={styles.quickLinkCard}
            onPress={() => router.push("/(admin)/sebayat-reports")}
            activeOpacity={0.7}
          >
            <View style={[styles.quickLinkIcon, { backgroundColor: "#D1FAE5" }]}>
              <Users size={24} color="#10B981" />
            </View>
            <View style={styles.quickLinkContent}>
              <Text style={styles.quickLinkTitle}>Darshan Reports</Text>
              <Text style={styles.quickLinkSubtitle}>View individual Darshan analytics</Text>
            </View>
            <ChevronRight size={20} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickLinkCard}
            onPress={() => router.push("/(admin)/supervisor-reports")}
            activeOpacity={0.7}
          >
            <View style={[styles.quickLinkIcon, { backgroundColor: "#DBEAFE" }]}>
              <Shield size={24} color="#3B82F6" />
            </View>
            <View style={styles.quickLinkContent}>
              <Text style={styles.quickLinkTitle}>Supervisor Reports</Text>
              <Text style={styles.quickLinkSubtitle}>View supervisor activity analytics</Text>
            </View>
            <ChevronRight size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <Card>
          <TouchableOpacity
            style={styles.filterHeader}
            onPress={() => setShowFilters(!showFilters)}
            activeOpacity={0.7}
          >
            <View style={styles.filterHeaderLeft}>
              <Filter size={20} color={COLORS.primary} />
              <Text style={styles.filterTitle}>Filters</Text>
            </View>
            {showFilters ? (
              <ChevronUp size={20} color={COLORS.textSecondary} />
            ) : (
              <ChevronDown size={20} color={COLORS.textSecondary} />
            )}
          </TouchableOpacity>

          {showFilters && (
            <View style={styles.filtersContainer}>
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Date Range</Text>
                <View style={styles.datePresets}>
                  {DATE_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.label}
                      style={[
                        styles.presetButton,
                        filters.startDate ===
                          (preset.days === 0
                            ? today
                            : new Date(
                                Date.now() - preset.days * 24 * 60 * 60 * 1000
                              )
                                .toISOString()
                                .split("T")[0]) && styles.presetButtonActive,
                      ]}
                      onPress={() => handleDatePreset(preset.days)}
                    >
                      <Text
                        style={[
                          styles.presetButtonText,
                          filters.startDate ===
                            (preset.days === 0
                              ? today
                              : new Date(
                                  Date.now() - preset.days * 24 * 60 * 60 * 1000
                                )
                                  .toISOString()
                                  .split("T")[0]) &&
                            styles.presetButtonTextActive,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.dateRange}>
                  <TouchableOpacity
                    style={styles.dateField}
                    onPress={() => setShowDatePicker("start")}
                    activeOpacity={0.7}
                  >
                    <Calendar size={16} color={COLORS.primary} />
                    <Text style={styles.dateText}>{formatDateDisplay(filters.startDate)}</Text>
                  </TouchableOpacity>
                  <Text style={styles.dateRangeSeparator}>to</Text>
                  <TouchableOpacity
                    style={styles.dateField}
                    onPress={() => setShowDatePicker("end")}
                    activeOpacity={0.7}
                  >
                    <Calendar size={16} color={COLORS.primary} />
                    <Text style={styles.dateText}>{formatDateDisplay(filters.endDate)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Status</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.statusScroll}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.statusOption,
                        filters.status === option.value &&
                          styles.statusOptionActive,
                      ]}
                      onPress={() =>
                        setFilters((prev) => ({
                          ...prev,
                          status: option.value,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.statusOptionText,
                          filters.status === option.value &&
                            styles.statusOptionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {categories.length > 0 && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterLabel}>Category</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.statusScroll}
                  >
                    <TouchableOpacity
                      style={[
                        styles.statusOption,
                        !filters.categoryId && styles.statusOptionActive,
                      ]}
                      onPress={() =>
                        setFilters((prev) => ({ ...prev, categoryId: "" }))
                      }
                    >
                      <Text
                        style={[
                          styles.statusOptionText,
                          !filters.categoryId && styles.statusOptionTextActive,
                        ]}
                      >
                        All
                      </Text>
                    </TouchableOpacity>
                    {categories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.statusOption,
                          filters.categoryId === cat.id &&
                            styles.statusOptionActive,
                        ]}
                        onPress={() =>
                          setFilters((prev) => ({
                            ...prev,
                            categoryId: cat.id,
                          }))
                        }
                      >
                        <Text
                          style={[
                            styles.statusOptionText,
                            filters.categoryId === cat.id &&
                              styles.statusOptionTextActive,
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <TouchableOpacity
                style={styles.generateButton}
                onPress={fetchReport}
                disabled={loading}
                activeOpacity={0.8}
              >
                <FileText size={18} color="#fff" />
                <Text style={styles.generateButtonText}>
                  {loading ? "Generating..." : "Generate Report"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {report && (
          <>
            <Card>
              <Text style={styles.summaryTitle}>Report Summary</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{report.totalEntries}</Text>
                  <Text style={styles.summaryLabel}>Total Entries</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {report.totalDeclaredDevotees}
                  </Text>
                  <Text style={styles.summaryLabel}>Declared</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {report.totalVerifiedDevotees}
                  </Text>
                  <Text style={styles.summaryLabel}>Verified</Text>
                </View>
              </View>

              <View style={styles.statusBreakdown}>
                <Text style={styles.breakdownTitle}>Status Breakdown</Text>
                <View style={styles.breakdownGrid}>
                  {Object.entries(report.statusBreakdown).map(
                    ([status, count]) => {
                      const colors = getStatusColor(status);
                      return (
                        <View
                          key={status}
                          style={[
                            styles.breakdownItem,
                            { backgroundColor: colors.bg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.breakdownCount,
                              { color: colors.text },
                            ]}
                          >
                            {count}
                          </Text>
                          <Text style={styles.breakdownLabel}>
                            {formatStatus(status)}
                          </Text>
                        </View>
                      );
                    }
                  )}
                </View>
              </View>
            </Card>

            {report.entries.length > 0 && (
              <Card style={styles.entriesCard}>
                <Text style={styles.entriesTitle}>
                  Entries ({report.entries.length})
                </Text>
                {report.entries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} />
                ))}
              </Card>
            )}

            {report.entries.length === 0 && (
              <Card>
                <View style={styles.emptyState}>
                  <FileText size={48} color={COLORS.textMuted} />
                  <Text style={styles.emptyText}>No entries found</Text>
                  <Text style={styles.emptySubtext}>
                    Try adjusting your filters
                  </Text>
                </View>
              </Card>
            )}
          </>
        )}

        {!report && !loading && (
          <Card>
            <View style={styles.emptyState}>
              <FileText size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Generate a Report</Text>
              <Text style={styles.emptySubtext}>
                Select filters and click "Generate Report"
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>

      <CalendarPicker
        visible={showDatePicker === "start"}
        title="Select Start Date"
        selectedDate={filters.startDate}
        maxDate={filters.endDate}
        onSelect={(d) => { setFilters((prev) => ({ ...prev, startDate: d })); setShowDatePicker(null); }}
        onClose={() => setShowDatePicker(null)}
      />
      <CalendarPicker
        visible={showDatePicker === "end"}
        title="Select End Date"
        selectedDate={filters.endDate}
        minDate={filters.startDate}
        maxDate={new Date().toISOString().split("T")[0]}
        onSelect={(d) => { setFilters((prev) => ({ ...prev, endDate: d })); setShowDatePicker(null); }}
        onClose={() => setShowDatePicker(null)}
      />
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
    marginBottom: 16,
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
  },
  quickLinks: {
    gap: 12,
    marginBottom: 16,
  },
  quickLinkCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
    ...SHADOWS.small,
  },
  quickLinkIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  quickLinkContent: {
    flex: 1,
  },
  quickLinkTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  quickLinkSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  card: {
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    ...SHADOWS.small,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  filtersContainer: {
    marginTop: 20,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  datePresets: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  presetButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  presetButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  presetButtonTextActive: {
    color: "#fff",
  },
  dateRange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dateField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + "40",
  },
  dateText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
    flex: 1,
  },
  dateRangeSeparator: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  statusScroll: {
    marginHorizontal: -4,
  },
  statusOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 4,
  },
  statusOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  statusOptionTextActive: {
    color: "#fff",
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statusBreakdown: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  breakdownGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  breakdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 80,
  },
  breakdownCount: {
    fontSize: 18,
    fontWeight: "700",
  },
  breakdownLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  entriesCard: {
    padding: 16,
  },
  entriesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },
  entryRow: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 14,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryMain: {
    flex: 1,
  },
  entryCode: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 1,
  },
  entryName: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
    marginTop: 2,
  },
  entryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  entryMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  entryDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  devoteeCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  devoteeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  categoryBadge: {
    fontSize: 11,
    color: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: "500",
  },
  entryDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
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
    textAlign: "center",
  },
});
