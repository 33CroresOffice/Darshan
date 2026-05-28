import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { CalendarPicker, formatDateDisplay } from "@/components/forms/CalendarPicker";
import {
  Heart,
  Users,
  TrendingUp,
  Calendar,
  Clock,
  Award,
  ChartBar as BarChart3,
} from "lucide-react-native";
import {
  getDevoteeAnalytics,
  DevoteeAnalyticsSummary,
  DateRangeFilter,
} from "@/services/analyticsService";
import { COLORS, SHADOWS } from "@/constants/config";

const DATE_PRESETS = [
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "This Year", days: -1 },
];

export default function DevoteeAnalyticsScreen() {
  const tabBarHeight = 0;
  const [analytics, setAnalytics] = useState<DevoteeAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(30);
  const [dateRange, setDateRange] = useState<DateRangeFilter>(() => {
    const today = new Date().toISOString().split("T")[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    return { startDate: monthAgo, endDate: today };
  });
  const [showDatePicker, setShowDatePicker] = useState<"start" | "end" | null>(null);

  const handleDatePreset = (days: number) => {
    setSelectedPreset(days);
    const today = new Date().toISOString().split("T")[0];
    if (days === -1) {
      const yearStart = `${new Date().getFullYear()}-01-01`;
      setDateRange({ startDate: yearStart, endDate: today });
    } else {
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      setDateRange({ startDate: start, endDate: today });
    }
  };

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await getDevoteeAnalytics(dateRange);
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to fetch devotee analytics:", err);
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

  const Card = ({ children, style }: { children: React.ReactNode; style?: any }) => (
    <View style={[styles.card, style]}>{children}</View>
  );

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
        <Heart size={48} color="#EC4899" />
        <Text style={styles.loadingText}>Loading devotee analytics...</Text>
      </View>
    );
  }

  const maxWeekday = Math.max(
    ...(analytics?.weekdayDistribution.map((d) => d.devotees) || [1]),
    1
  );

  const maxHourly = Math.max(
    ...(analytics?.hourlyDistribution.map((h) => h.devotees) || [1]),
    1
  );

  const maxDaily = Math.max(
    ...(analytics?.dailyTrend.map((d) => d.devotees) || [1]),
    1
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}
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
          <Text style={styles.title}>Devotee Analytics</Text>
          <Text style={styles.subtitle}>Track devotee visits and patterns</Text>
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
              <Calendar size={16} color="#EC4899" />
              <Text style={styles.dateFieldText}>{formatDateDisplay(dateRange.startDate)}</Text>
            </TouchableOpacity>
            <Text style={styles.dateRangeSeparator}>to</Text>
            <TouchableOpacity
              style={styles.dateField}
              onPress={() => setShowDatePicker("end")}
              activeOpacity={0.7}
            >
              <Calendar size={16} color="#EC4899" />
              <Text style={styles.dateFieldText}>{formatDateDisplay(dateRange.endDate)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <CalendarPicker
          visible={showDatePicker === "start"}
          title="Select Start Date"
          selectedDate={dateRange.startDate}
          maxDate={dateRange.endDate}
          accentColor="#EC4899"
          onSelect={(d) => { setSelectedPreset(null); setDateRange((prev) => ({ ...prev, startDate: d })); setShowDatePicker(null); }}
          onClose={() => setShowDatePicker(null)}
        />
        <CalendarPicker
          visible={showDatePicker === "end"}
          title="Select End Date"
          selectedDate={dateRange.endDate}
          minDate={dateRange.startDate}
          maxDate={new Date().toISOString().split("T")[0]}
          accentColor="#EC4899"
          onSelect={(d) => { setSelectedPreset(null); setDateRange((prev) => ({ ...prev, endDate: d })); setShowDatePicker(null); }}
          onClose={() => setShowDatePicker(null)}
        />

        <View style={styles.statsGrid}>
          <StatCard
            title="TOTAL DEVOTEES"
            value={analytics?.totalDevotees.toLocaleString() || 0}
            icon={<Heart size={22} color="#fff" />}
            color="#EC4899"
            bgColor="#FCE7F3"
          />
          <StatCard
            title="TOTAL ENTRIES"
            value={analytics?.totalEntries || 0}
            icon={<Users size={22} color="#fff" />}
            color="#3B82F6"
            bgColor="#DBEAFE"
          />
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            title="AVG PER ENTRY"
            value={analytics?.averageDevoteesPerEntry || 0}
            icon={<TrendingUp size={22} color="#fff" />}
            color="#10B981"
            bgColor="#D1FAE5"
            subtitle="devotees"
          />
          <StatCard
            title="PEAK DAY"
            value={analytics?.peakDayDevotees || 0}
            icon={<Award size={22} color="#fff" />}
            color="#F59E0B"
            bgColor="#FEF3C7"
            subtitle={analytics?.peakDayDate ? new Date(analytics.peakDayDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "-"}
          />
        </View>

        {analytics?.categoryDistribution && analytics.categoryDistribution.length > 0 && (
          <Card>
            <View style={styles.cardHeader}>
              <Users size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>By Category</Text>
            </View>
            {analytics.categoryDistribution.slice(0, 5).map((cat, index) => {
              const maxCat = analytics.categoryDistribution[0]?.devotees || 1;
              const width = Math.max((cat.devotees / maxCat) * 100, 5);
              const colors = ["#EC4899", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"];
              return (
                <View key={cat.category} style={styles.categoryItem}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryName}>{cat.category}</Text>
                    <Text style={styles.categoryValue}>
                      {cat.devotees.toLocaleString()} ({cat.percentage}%)
                    </Text>
                  </View>
                  <View style={styles.categoryBarContainer}>
                    <View
                      style={[
                        styles.categoryBar,
                        { width: `${width}%`, backgroundColor: colors[index % colors.length] },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        {analytics?.weekdayDistribution && (
          <Card>
            <View style={styles.cardHeader}>
              <Calendar size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Weekday Distribution</Text>
            </View>
            <View style={styles.weekdayChart}>
              {analytics.weekdayDistribution.map((day) => {
                const height = day.devotees > 0 ? (day.devotees / maxWeekday) * 80 : 4;
                return (
                  <View key={day.day} style={styles.weekdayBar}>
                    <Text style={styles.weekdayValue}>{day.devotees}</Text>
                    <View
                      style={[
                        styles.weekdayBarFill,
                        {
                          height: Math.max(height, 4),
                          backgroundColor: day.day === "Sun" || day.day === "Sat" ? "#EC4899" : COLORS.primary,
                        },
                      ]}
                    />
                    <Text style={styles.weekdayLabel}>{day.day}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {analytics?.hourlyDistribution && analytics.hourlyDistribution.length > 0 && (
          <Card>
            <View style={styles.cardHeader}>
              <Clock size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Hourly Distribution</Text>
            </View>
            <View style={styles.hourlyChart}>
              {analytics.hourlyDistribution.map((hour) => {
                const height = hour.devotees > 0 ? (hour.devotees / maxHourly) * 60 : 4;
                return (
                  <View key={hour.hour} style={styles.hourlyBar}>
                    <View
                      style={[
                        styles.hourlyBarFill,
                        { height: Math.max(height, 4) },
                      ]}
                    />
                    <Text style={styles.hourlyLabel}>{hour.hour.split(":")[0]}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.chartNote}>Peak hours highlighted</Text>
          </Card>
        )}

        {analytics?.dailyTrend && analytics.dailyTrend.length > 0 && (
          <Card style={styles.lastCard}>
            <View style={styles.cardHeader}>
              <BarChart3 size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Daily Trend</Text>
            </View>
            <View style={styles.dailyChart}>
              {analytics.dailyTrend.slice(-14).map((day, index) => {
                const height = day.devotees > 0 ? (day.devotees / maxDaily) * 100 : 4;
                const dayLabel = new Date(day.date).toLocaleDateString("en-IN", { day: "numeric" });
                return (
                  <View key={day.date} style={styles.dailyBar}>
                    <Text style={styles.dailyValue}>{day.devotees}</Text>
                    <View
                      style={[
                        styles.dailyBarFill,
                        {
                          height: Math.max(height, 4),
                          backgroundColor: index === analytics.dailyTrend.slice(-14).length - 1
                            ? "#EC4899"
                            : COLORS.primaryMuted,
                        },
                      ]}
                    />
                    <Text style={styles.dailyLabel}>{dayLabel}</Text>
                  </View>
                );
              })}
            </View>
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
    backgroundColor: "#EC4899",
    borderColor: "#EC4899",
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
    backgroundColor: "#FCE7F3",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#EC489940",
  },
  dateFieldText: {
    fontSize: 13,
    color: "#EC4899",
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
  categoryItem: {
    marginBottom: 14,
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
  categoryValue: {
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
  weekdayChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
    paddingTop: 20,
  },
  weekdayBar: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  weekdayValue: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  weekdayBarFill: {
    width: 28,
    borderRadius: 6,
    minHeight: 4,
  },
  weekdayLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  hourlyChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 100,
    paddingTop: 20,
  },
  hourlyBar: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  hourlyBarFill: {
    width: 12,
    borderRadius: 3,
    minHeight: 4,
    backgroundColor: COLORS.primary,
  },
  hourlyLabel: {
    fontSize: 8,
    color: COLORS.textMuted,
  },
  chartNote: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 12,
  },
  dailyChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 140,
    paddingTop: 20,
  },
  dailyBar: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  dailyValue: {
    fontSize: 9,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  dailyBarFill: {
    width: 16,
    borderRadius: 4,
    minHeight: 4,
  },
  dailyLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  lastCard: {
    marginBottom: 0,
  },
});
