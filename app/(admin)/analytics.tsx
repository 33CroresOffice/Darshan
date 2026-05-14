import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { TrendingUp, Users, DoorOpen, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Award, ChartBar as BarChart3, Calendar } from "lucide-react-native";
import { CalendarPicker, formatDateDisplay } from "@/components/forms/CalendarPicker";
import {
  getAnalyticsSummary,
  getMonthlyTrend,
  AnalyticsSummary,
  DateRangeFilter,
} from "@/services/analyticsService";
import { COLORS, SHADOWS } from "@/constants/config";

const { width } = Dimensions.get("window");

const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "All Time", days: -1 },
];

export default function AnalyticsScreen() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<
    { month: string; entries: number; devotees: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(7);
  const [dateRange, setDateRange] = useState<DateRangeFilter>(() => {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    return { startDate: weekAgo, endDate: today };
  });
  const [showDatePicker, setShowDatePicker] = useState<"start" | "end" | null>(null);

  const handleDatePreset = (days: number) => {
    setSelectedPreset(days);
    const today = new Date().toISOString().split("T")[0];
    if (days === -1) {
      const fiveYearsAgo = new Date(Date.now() - 365 * 5 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      setDateRange({ startDate: fiveYearsAgo, endDate: today });
    } else if (days === 0) {
      setDateRange({ startDate: today, endDate: today });
    } else {
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      setDateRange({ startDate: start, endDate: today });
    }
  };

  const fetchAnalytics = useCallback(async () => {
    try {
      const [summaryData, trendData] = await Promise.all([
        getAnalyticsSummary(dateRange),
        getMonthlyTrend(6),
      ]);
      setAnalytics(summaryData);
      setMonthlyTrend(trendData);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  };

  const maxDevotees = Math.max(...monthlyTrend.map((m) => m.devotees), 1);

  const Card = ({
    children,
    style,
  }: {
    children: React.ReactNode;
    style?: any;
  }) => <View style={[styles.card, style]}>{children}</View>;

  const StatCard = ({
    title,
    value,
    icon,
    color,
    bgColor,
    subtitle,
  }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    subtitle?: string;
  }) => (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <View style={[styles.statIconContainer, { backgroundColor: color }]}>
        {icon}
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <BarChart3 size={48} color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

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
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>Overview and insights</Text>
        </View>

        <View style={styles.dateRangeContainer}>
          <View style={styles.dateRangeHeader}>
            <Calendar size={18} color={COLORS.primary} />
            <Text style={styles.dateRangeLabel}>Date Range</Text>
          </View>
          <View style={styles.datePresets}>
            {DATE_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.label}
                style={[
                  styles.presetButton,
                  selectedPreset === preset.days && styles.presetButtonActive,
                ]}
                onPress={() => handleDatePreset(preset.days)}
              >
                <Text
                  style={[
                    styles.presetButtonText,
                    selectedPreset === preset.days && styles.presetButtonTextActive,
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dateFieldsRow}>
            <TouchableOpacity
              style={styles.dateField}
              onPress={() => setShowDatePicker("start")}
              activeOpacity={0.7}
            >
              <Calendar size={16} color={COLORS.primary} />
              <Text style={styles.dateFieldText}>{formatDateDisplay(dateRange.startDate)}</Text>
            </TouchableOpacity>
            <Text style={styles.dateRangeSeparator}>to</Text>
            <TouchableOpacity
              style={styles.dateField}
              onPress={() => setShowDatePicker("end")}
              activeOpacity={0.7}
            >
              <Calendar size={16} color={COLORS.primary} />
              <Text style={styles.dateFieldText}>{formatDateDisplay(dateRange.endDate)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <CalendarPicker
          visible={showDatePicker === "start"}
          title="Select Start Date"
          selectedDate={dateRange.startDate}
          maxDate={dateRange.endDate}
          onSelect={(d) => { setSelectedPreset(null); setDateRange((prev) => ({ ...prev, startDate: d })); setShowDatePicker(null); }}
          onClose={() => setShowDatePicker(null)}
        />
        <CalendarPicker
          visible={showDatePicker === "end"}
          title="Select End Date"
          selectedDate={dateRange.endDate}
          minDate={dateRange.startDate}
          maxDate={new Date().toISOString().split("T")[0]}
          onSelect={(d) => { setSelectedPreset(null); setDateRange((prev) => ({ ...prev, endDate: d })); setShowDatePicker(null); }}
          onClose={() => setShowDatePicker(null)}
        />

        <View style={styles.statsGrid}>
          <StatCard
            title="TOTAL ENTRIES"
            value={analytics?.totalEntries || 0}
            icon={<DoorOpen size={22} color="#fff" />}
            color="#3B82F6"
            bgColor="#DBEAFE"
          />
          <StatCard
            title="TOTAL DEVOTEES"
            value={analytics?.totalDevotees || 0}
            icon={<Users size={22} color="#fff" />}
            color="#10B981"
            bgColor="#D1FAE5"
          />
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            title="VERIFIED"
            value={analytics?.verifiedEntries || 0}
            icon={<CheckCircle size={22} color="#fff" />}
            color="#0D9488"
            bgColor="#CCFBF1"
            subtitle={`${analytics?.verificationRate || 0}% rate`}
          />
          <StatCard
            title="FLAGGED"
            value={analytics?.flaggedEntries || 0}
            icon={<AlertTriangle size={22} color="#fff" />}
            color="#EF4444"
            bgColor="#FEE2E2"
            subtitle={`Avg ${analytics?.averageDevoteesPerEntry || 0}/entry`}
          />
        </View>

        <Card style={styles.sebayatSummary}>
          <View style={styles.sebayatRow}>
            <View style={styles.sebayatStat}>
              <Award size={20} color="#8B5CF6" />
              <Text style={styles.sebayatValue}>{analytics?.totalApprovedSebayats || 0}</Text>
              <Text style={styles.sebayatLabel}>Approved Darshans</Text>
            </View>
            <View style={styles.sebayatDivider} />
            <View style={styles.sebayatStat}>
              <Award size={20} color="#F59E0B" />
              <Text style={styles.sebayatValue}>{analytics?.totalPendingSebayats || 0}</Text>
              <Text style={styles.sebayatLabel}>Pending Darshans</Text>
            </View>
          </View>
        </Card>

        {analytics?.dailyTrend && analytics.dailyTrend.length > 0 && (
          <Card>
            <View style={styles.cardHeader}>
              <TrendingUp size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Daily Trend</Text>
            </View>
            <View style={styles.chartContainer}>
              {analytics.dailyTrend.slice(-7).map((day, index) => {
                const maxDaily = Math.max(
                  ...analytics.dailyTrend.slice(-7).map((d) => d.totalDevotees),
                  1
                );
                const height =
                  day.totalDevotees > 0
                    ? (day.totalDevotees / maxDaily) * 100
                    : 4;
                const dayLabel = new Date(day.date).toLocaleDateString("en-IN", {
                  day: "numeric",
                });

                return (
                  <View key={day.date} style={styles.chartBar}>
                    <Text style={styles.chartValue}>{day.totalDevotees}</Text>
                    <View
                      style={[
                        styles.chartBarFill,
                        {
                          height: Math.max(height, 4),
                          backgroundColor:
                            index === analytics.dailyTrend.slice(-7).length - 1
                              ? COLORS.primary
                              : COLORS.primaryMuted,
                        },
                      ]}
                    />
                    <Text style={styles.chartLabel}>{dayLabel}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        <Card>
          <View style={styles.cardHeader}>
            <BarChart3 size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Monthly Trend (6 Months)</Text>
          </View>
          <View style={styles.monthlyChartContainer}>
            {monthlyTrend.map((m, index) => {
              const height =
                m.devotees > 0 ? (m.devotees / maxDevotees) * 80 : 4;
              return (
                <View key={m.month} style={styles.monthlyBar}>
                  <Text style={styles.monthlyValue}>{m.devotees}</Text>
                  <View
                    style={[
                      styles.monthlyBarFill,
                      {
                        height: Math.max(height, 4),
                        backgroundColor:
                          index === monthlyTrend.length - 1
                            ? COLORS.primary
                            : "#94A3B8",
                      },
                    ]}
                  />
                  <Text style={styles.monthlyLabel}>{m.month}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {analytics?.categoryBreakdown &&
          analytics.categoryBreakdown.length > 0 && (
            <Card>
              <View style={styles.cardHeader}>
                <Users size={20} color={COLORS.primary} />
                <Text style={styles.cardTitle}>By Category</Text>
              </View>
              {analytics.categoryBreakdown.map((cat, index) => {
                const maxCat = analytics.categoryBreakdown[0]?.totalDevotees || 1;
                const percentage = Math.round(
                  (cat.totalDevotees / maxCat) * 100
                );
                return (
                  <View key={cat.categoryId} style={styles.categoryItem}>
                    <View style={styles.categoryHeader}>
                      <Text style={styles.categoryName}>{cat.categoryName}</Text>
                      <Text style={styles.categoryStats}>
                        {cat.totalDevotees} devotees
                      </Text>
                    </View>
                    <View style={styles.categoryBarContainer}>
                      <View
                        style={[
                          styles.categoryBar,
                          {
                            width: `${percentage}%`,
                            backgroundColor:
                              index === 0 ? COLORS.primary : COLORS.primaryMuted,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.categoryEntries}>
                      {cat.totalEntries} entries
                    </Text>
                  </View>
                );
              })}
            </Card>
          )}

        {analytics?.topSupervisors && analytics.topSupervisors.length > 0 && (
          <Card style={styles.lastCard}>
            <View style={styles.cardHeader}>
              <Award size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Top Supervisors</Text>
            </View>
            {analytics.topSupervisors.slice(0, 5).map((sup, index) => (
              <View key={sup.supervisorId} style={styles.supervisorItem}>
                <View style={styles.supervisorRank}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.supervisorInfo}>
                  <Text style={styles.supervisorName}>{sup.supervisorName}</Text>
                  <Text style={styles.supervisorStats}>
                    West: {sup.westGateEntries} | Inner:{" "}
                    {sup.innerGateVerifications}
                  </Text>
                </View>
                <Text style={styles.supervisorTotal}>
                  {sup.westGateEntries + sup.innerGateVerifications}
                </Text>
              </View>
            ))}
          </Card>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
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
  dateRangeContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    ...SHADOWS.small,
  },
  dateRangeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  dateRangeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  datePresets: {
    flexDirection: "row",
    gap: 8,
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
  dateFieldsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
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
  dateFieldText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
    flex: 1,
  },
  dateRangeSeparator: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    ...SHADOWS.small,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
  },
  statTitle: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: "600",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  statSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
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
  sebayatSummary: {
    marginBottom: 16,
  },
  sebayatRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sebayatStat: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  sebayatDivider: {
    width: 1,
    height: 50,
    backgroundColor: COLORS.border,
  },
  sebayatValue: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
  },
  sebayatLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 140,
    paddingTop: 20,
  },
  chartBar: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  chartValue: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  chartBarFill: {
    width: 28,
    borderRadius: 6,
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  monthlyChartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
    paddingTop: 20,
  },
  monthlyBar: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  monthlyValue: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  monthlyBarFill: {
    width: 24,
    borderRadius: 4,
    minHeight: 4,
  },
  monthlyLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  categoryItem: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  categoryStats: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  categoryBarContainer: {
    height: 8,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 4,
    overflow: "hidden",
  },
  categoryBar: {
    height: "100%",
    borderRadius: 4,
  },
  categoryEntries: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  supervisorItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  supervisorRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  supervisorInfo: {
    flex: 1,
  },
  supervisorName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  supervisorStats: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  supervisorTotal: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
  },
  lastCard: {
    marginBottom: 0,
  },
});
