import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  TextInput,
} from "react-native";
import {
  Users,
  Search,
  ChevronRight,
  Calendar,
  TrendingUp,
  DoorOpen,
  CircleCheck as CheckCircle,
  TriangleAlert as AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Circle as XCircle,
} from "lucide-react-native";
import {
  getSebayatList,
  getSebayatDetailedReport,
  SebayatReportItem,
  SebayatDetailedReport,
  EntryReport,
} from "@/services/analyticsService";
import { COLORS, SHADOWS } from "@/constants/config";

const DATE_PRESETS = [
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "All Time", days: 365 * 5 },
];

export default function SebayatReportsScreen() {
  const tabBarHeight = 0;
  const [sebayats, setSebayats] = useState<SebayatReportItem[]>([]);
  const [filteredSebayats, setFilteredSebayats] = useState<SebayatReportItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSebayat, setSelectedSebayat] = useState<string | null>(null);
  const [detailedReport, setDetailedReport] = useState<SebayatDetailedReport | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [dateRange, setDateRange] = useState(30);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const fetchSebayats = useCallback(async () => {
    try {
      const data = await getSebayatList();
      setSebayats(data);
      setFilteredSebayats(data);
    } catch (err) {
      console.error("Failed to fetch sebayats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSebayats();
  }, [fetchSebayats]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredSebayats(sebayats);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredSebayats(
        sebayats.filter(
          (s) =>
            s.fullName.toLowerCase().includes(query) ||
            s.phoneNumber?.includes(query) ||
            s.categoryName.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, sebayats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSebayats();
    setRefreshing(false);
  };

  const handleSelectSebayat = async (sebayatId: string) => {
    setSelectedSebayat(sebayatId);
    setLoadingDetail(true);
    try {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const report = await getSebayatDetailedReport(sebayatId, startDate, endDate);
      setDetailedReport(report);
    } catch (err) {
      console.error("Failed to fetch sebayat report:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleChangeDateRange = async (days: number) => {
    setDateRange(days);
    if (selectedSebayat) {
      setLoadingDetail(true);
      try {
        const endDate = new Date().toISOString().split("T")[0];
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        const report = await getSebayatDetailedReport(selectedSebayat, startDate, endDate);
        setDetailedReport(report);
      } catch (err) {
        console.error("Failed to fetch sebayat report:", err);
      } finally {
        setLoadingDetail(false);
      }
    }
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

  const Card = ({ children, style }: { children: React.ReactNode; style?: any }) => (
    <View style={[styles.card, style]}>{children}</View>
  );

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
            <Text style={styles.entryDate}>
              {new Date(entry.entryDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Text>
          </View>
          <View style={styles.entryRight}>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
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
          <View style={styles.devoteeCount}>
            <Users size={12} color={COLORS.textSecondary} />
            <Text style={styles.devoteeText}>
              {entry.verifiedCount ?? entry.declaredCount} devotees
            </Text>
          </View>
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
                <Text style={styles.detailValue}>{entry.westGateSupervisor}</Text>
              </View>
            )}
            {entry.innerGateSupervisor && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Inner Gate</Text>
                <Text style={styles.detailValue}>{entry.innerGateSupervisor}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (selectedSebayat && detailedReport) {
    const maxDaily = Math.max(...detailedReport.dailyTrend.map((d) => d.devotees), 1);

    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setSelectedSebayat(null);
              setDetailedReport(null);
            }}
          >
            <ArrowLeft size={20} color={COLORS.primary} />
            <Text style={styles.backText}>Back to List</Text>
          </TouchableOpacity>

          <Card style={styles.profileCard}>
            <View style={styles.profileHeader}>
              {detailedReport.sebayat.photoUrl ? (
                <Image
                  source={{ uri: detailedReport.sebayat.photoUrl }}
                  style={styles.profilePhoto}
                />
              ) : (
                <View style={styles.profilePhotoPlaceholder}>
                  <Users size={32} color={COLORS.textMuted} />
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{detailedReport.sebayat.fullName}</Text>
                <Text style={styles.profileCategory}>
                  {detailedReport.sebayat.categoryName}
                </Text>
                {detailedReport.sebayat.phoneNumber && (
                  <Text style={styles.profilePhone}>
                    {detailedReport.sebayat.phoneNumber}
                  </Text>
                )}
              </View>
            </View>
          </Card>

          <View style={styles.datePresets}>
            {DATE_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.label}
                style={[
                  styles.presetButton,
                  dateRange === preset.days && styles.presetButtonActive,
                ]}
                onPress={() => handleChangeDateRange(preset.days)}
              >
                <Text
                  style={[
                    styles.presetButtonText,
                    dateRange === preset.days && styles.presetButtonTextActive,
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loadingDetail ? (
            <Card>
              <Text style={styles.loadingText}>Loading report...</Text>
            </Card>
          ) : (
            <>
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: "#DBEAFE" }]}>
                  <DoorOpen size={22} color="#3B82F6" />
                  <Text style={[styles.statValue, { color: "#3B82F6" }]}>
                    {detailedReport.sebayat.totalEntries}
                  </Text>
                  <Text style={styles.statLabel}>Entries</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: "#D1FAE5" }]}>
                  <Users size={22} color="#10B981" />
                  <Text style={[styles.statValue, { color: "#10B981" }]}>
                    {detailedReport.sebayat.totalDevotees}
                  </Text>
                  <Text style={styles.statLabel}>Devotees</Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: "#CCFBF1" }]}>
                  <CheckCircle size={22} color="#0D9488" />
                  <Text style={[styles.statValue, { color: "#0D9488" }]}>
                    {detailedReport.sebayat.verifiedEntries}
                  </Text>
                  <Text style={styles.statLabel}>Verified</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: "#FEE2E2" }]}>
                  <AlertTriangle size={22} color="#EF4444" />
                  <Text style={[styles.statValue, { color: "#EF4444" }]}>
                    {detailedReport.sebayat.flaggedEntries}
                  </Text>
                  <Text style={styles.statLabel}>Flagged</Text>
                </View>
              </View>

              {detailedReport.dailyTrend.length > 0 && (
                <Card>
                  <View style={styles.cardHeader}>
                    <TrendingUp size={20} color={COLORS.primary} />
                    <Text style={styles.cardTitle}>Daily Trend</Text>
                  </View>
                  <View style={styles.chartContainer}>
                    {detailedReport.dailyTrend.slice(-7).map((day, index) => {
                      const height = day.devotees > 0 ? (day.devotees / maxDaily) * 100 : 4;
                      return (
                        <View key={day.date} style={styles.chartBar}>
                          <Text style={styles.chartValue}>{day.devotees}</Text>
                          <View
                            style={[
                              styles.chartBarFill,
                              {
                                height: Math.max(height, 4),
                                backgroundColor:
                                  index === detailedReport.dailyTrend.slice(-7).length - 1
                                    ? COLORS.primary
                                    : COLORS.primaryMuted,
                              },
                            ]}
                          />
                          <Text style={styles.chartLabel}>
                            {new Date(day.date).toLocaleDateString("en-IN", {
                              day: "numeric",
                            })}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Card>
              )}

              {detailedReport.entries.length > 0 && (
                <Card style={styles.entriesCard}>
                  <Text style={styles.entriesTitle}>
                    Recent Entries ({detailedReport.entries.length})
                  </Text>
                  {detailedReport.entries.slice(0, 20).map((entry) => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </Card>
              )}

              {detailedReport.entries.length === 0 && (
                <Card>
                  <View style={styles.emptyState}>
                    <DoorOpen size={48} color={COLORS.textMuted} />
                    <Text style={styles.emptyText}>No entries found</Text>
                    <Text style={styles.emptySubtext}>
                      Try selecting a different date range
                    </Text>
                  </View>
                </Card>
              )}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Users size={48} color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading sebayats...</Text>
      </View>
    );
  }

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
          <Text style={styles.title}>Darshan Reports</Text>
          <Text style={styles.subtitle}>View individual Darshan analytics</Text>
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone, or category..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <Text style={styles.resultCount}>
          {filteredSebayats.length} darshan{filteredSebayats.length !== 1 ? "s" : ""} found
        </Text>

        {filteredSebayats.map((sebayat) => (
          <TouchableOpacity
            key={sebayat.id}
            style={styles.sebayatCard}
            onPress={() => handleSelectSebayat(sebayat.id)}
            activeOpacity={0.7}
          >
            <View style={styles.sebayatRow}>
              {sebayat.photoUrl ? (
                <Image source={{ uri: sebayat.photoUrl }} style={styles.sebayatPhoto} />
              ) : (
                <View style={styles.sebayatPhotoPlaceholder}>
                  <Users size={20} color={COLORS.textMuted} />
                </View>
              )}
              <View style={styles.sebayatInfo}>
                <Text style={styles.sebayatName}>{sebayat.fullName}</Text>
                <Text style={styles.sebayatCategory}>{sebayat.categoryName}</Text>
              </View>
              <ChevronRight size={20} color={COLORS.textMuted} />
            </View>
            <View style={styles.sebayatStats}>
              <View style={styles.miniStat}>
                <Text style={styles.miniStatValue}>{sebayat.totalEntries}</Text>
                <Text style={styles.miniStatLabel}>Entries</Text>
              </View>
              <View style={styles.miniStatDivider} />
              <View style={styles.miniStat}>
                <Text style={styles.miniStatValue}>{sebayat.totalDevotees}</Text>
                <Text style={styles.miniStatLabel}>Devotees</Text>
              </View>
              <View style={styles.miniStatDivider} />
              <View style={styles.miniStat}>
                <Text style={[styles.miniStatValue, { color: COLORS.success }]}>
                  {sebayat.verifiedEntries}
                </Text>
                <Text style={styles.miniStatLabel}>Verified</Text>
              </View>
              <View style={styles.miniStatDivider} />
              <View style={styles.miniStat}>
                <Text
                  style={[
                    styles.miniStatValue,
                    { color: sebayat.flaggedEntries > 0 ? COLORS.error : COLORS.textMuted },
                  ]}
                >
                  {sebayat.flaggedEntries}
                </Text>
                <Text style={styles.miniStatLabel}>Flagged</Text>
              </View>
            </View>
            {sebayat.lastEntryDate && (
              <View style={styles.lastActivity}>
                <Calendar size={12} color={COLORS.textMuted} />
                <Text style={styles.lastActivityText}>
                  Last entry:{" "}
                  {new Date(sebayat.lastEntryDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {filteredSebayats.length === 0 && (
          <Card>
            <View style={styles.emptyState}>
              <Users size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No sebayats found</Text>
              <Text style={styles.emptySubtext}>Try a different search term</Text>
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
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  resultCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  sebayatCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  sebayatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sebayatPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  sebayatPhotoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  sebayatInfo: {
    flex: 1,
  },
  sebayatName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  sebayatCategory: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sebayatStats: {
    flexDirection: "row",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  miniStat: {
    flex: 1,
    alignItems: "center",
  },
  miniStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  miniStatLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  lastActivity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  lastActivityText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  backText: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.primary,
  },
  profileCard: {
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  profilePhoto: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  profilePhotoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  profileCategory: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 4,
  },
  profilePhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  datePresets: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  presetButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
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
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
    ...SHADOWS.small,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "500",
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
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
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
    width: 24,
    borderRadius: 6,
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "500",
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
  entryDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
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
  devoteeCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  devoteeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
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
