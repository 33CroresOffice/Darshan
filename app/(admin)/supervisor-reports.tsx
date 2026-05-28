import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
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
  Shield,
  LogIn,
  LogOut,
} from "lucide-react-native";
import {
  getSupervisorList,
  getSupervisorDetailedReport,
  SupervisorReportItem,
  SupervisorDetailedReport,
  EntryReport,
} from "@/services/analyticsService";
import { COLORS, SHADOWS } from "@/constants/config";

const DATE_PRESETS = [
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "All Time", days: 365 * 5 },
];

export default function SupervisorReportsScreen() {
  const tabBarHeight = 0;
  const [supervisors, setSupervisors] = useState<SupervisorReportItem[]>([]);
  const [filteredSupervisors, setFilteredSupervisors] = useState<SupervisorReportItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string | null>(null);
  const [detailedReport, setDetailedReport] = useState<SupervisorDetailedReport | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [dateRange, setDateRange] = useState(30);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"westGate" | "innerGate">("westGate");

  const fetchSupervisors = useCallback(async () => {
    try {
      const data = await getSupervisorList();
      setSupervisors(data);
      setFilteredSupervisors(data);
    } catch (err) {
      console.error("Failed to fetch supervisors:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredSupervisors(supervisors);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredSupervisors(
        supervisors.filter(
          (s) =>
            s.fullName.toLowerCase().includes(query) ||
            s.phoneNumber?.includes(query) ||
            s.role.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, supervisors]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSupervisors();
    setRefreshing(false);
  };

  const handleSelectSupervisor = async (supervisorId: string) => {
    setSelectedSupervisor(supervisorId);
    setLoadingDetail(true);
    try {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const report = await getSupervisorDetailedReport(supervisorId, startDate, endDate);
      setDetailedReport(report);
    } catch (err) {
      console.error("Failed to fetch supervisor report:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleChangeDateRange = async (days: number) => {
    setDateRange(days);
    if (selectedSupervisor) {
      setLoadingDetail(true);
      try {
        const endDate = new Date().toISOString().split("T")[0];
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        const report = await getSupervisorDetailedReport(selectedSupervisor, startDate, endDate);
        setDetailedReport(report);
      } catch (err) {
        console.error("Failed to fetch supervisor report:", err);
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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "superadmin":
        return { bg: "#FEE2E2", text: "#DC2626" };
      case "admin":
        return { bg: "#DBEAFE", text: "#2563EB" };
      case "supervisor":
        return { bg: "#D1FAE5", text: "#059669" };
      default:
        return { bg: "#F3F4F6", text: "#6B7280" };
    }
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
            <Text style={styles.sebayatName}>{entry.sebayatName}</Text>
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

  if (selectedSupervisor && detailedReport) {
    const maxDaily = Math.max(
      ...detailedReport.dailyActivity.map((d) => d.westGate + d.innerGate),
      1
    );

    const currentEntries =
      activeTab === "westGate"
        ? detailedReport.westGateEntries
        : detailedReport.innerGateEntries;

    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setSelectedSupervisor(null);
              setDetailedReport(null);
            }}
          >
            <ArrowLeft size={20} color={COLORS.primary} />
            <Text style={styles.backText}>Back to List</Text>
          </TouchableOpacity>

          <Card style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.profileIcon}>
                <Shield size={32} color={COLORS.primary} />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {detailedReport.supervisor.fullName}
                </Text>
                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor: getRoleBadgeColor(
                        detailedReport.supervisor.role
                      ).bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleBadgeText,
                      {
                        color: getRoleBadgeColor(detailedReport.supervisor.role)
                          .text,
                      },
                    ]}
                  >
                    {detailedReport.supervisor.role.toUpperCase()}
                  </Text>
                </View>
                {detailedReport.supervisor.phoneNumber && (
                  <Text style={styles.profilePhone}>
                    {detailedReport.supervisor.phoneNumber}
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
                  <LogIn size={22} color="#3B82F6" />
                  <Text style={[styles.statValue, { color: "#3B82F6" }]}>
                    {detailedReport.supervisor.westGateEntries}
                  </Text>
                  <Text style={styles.statLabel}>West Gate</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: "#D1FAE5" }]}>
                  <LogOut size={22} color="#10B981" />
                  <Text style={[styles.statValue, { color: "#10B981" }]}>
                    {detailedReport.supervisor.innerGateVerifications}
                  </Text>
                  <Text style={styles.statLabel}>Inner Gate</Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: "#FEF3C7" }]}>
                  <Users size={22} color="#F59E0B" />
                  <Text style={[styles.statValue, { color: "#F59E0B" }]}>
                    {detailedReport.supervisor.westGateDevotees +
                      detailedReport.supervisor.innerGateDevotees}
                  </Text>
                  <Text style={styles.statLabel}>Devotees</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: "#FEE2E2" }]}>
                  <AlertTriangle size={22} color="#EF4444" />
                  <Text style={[styles.statValue, { color: "#EF4444" }]}>
                    {detailedReport.supervisor.flaggedEntries}
                  </Text>
                  <Text style={styles.statLabel}>Flagged</Text>
                </View>
              </View>

              {detailedReport.dailyActivity.length > 0 && (
                <Card>
                  <View style={styles.cardHeader}>
                    <TrendingUp size={20} color={COLORS.primary} />
                    <Text style={styles.cardTitle}>Daily Activity</Text>
                  </View>
                  <View style={styles.chartLegend}>
                    <View style={styles.legendItem}>
                      <View
                        style={[styles.legendDot, { backgroundColor: "#3B82F6" }]}
                      />
                      <Text style={styles.legendText}>West Gate</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View
                        style={[styles.legendDot, { backgroundColor: "#10B981" }]}
                      />
                      <Text style={styles.legendText}>Inner Gate</Text>
                    </View>
                  </View>
                  <View style={styles.chartContainer}>
                    {detailedReport.dailyActivity.slice(-7).map((day, index) => {
                      const totalHeight =
                        day.westGate + day.innerGate > 0
                          ? ((day.westGate + day.innerGate) / maxDaily) * 100
                          : 4;
                      const westGateHeight =
                        day.westGate > 0
                          ? (day.westGate / (day.westGate + day.innerGate)) *
                            totalHeight
                          : 0;
                      const innerGateHeight = totalHeight - westGateHeight;

                      return (
                        <View key={day.date} style={styles.chartBar}>
                          <Text style={styles.chartValue}>
                            {day.westGate + day.innerGate}
                          </Text>
                          <View style={styles.stackedBar}>
                            <View
                              style={[
                                styles.chartBarFill,
                                {
                                  height: Math.max(innerGateHeight, 0),
                                  backgroundColor: "#10B981",
                                  borderTopLeftRadius: 4,
                                  borderTopRightRadius: 4,
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.chartBarFill,
                                {
                                  height: Math.max(westGateHeight, 0),
                                  backgroundColor: "#3B82F6",
                                  borderBottomLeftRadius: 4,
                                  borderBottomRightRadius: 4,
                                },
                              ]}
                            />
                          </View>
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

              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === "westGate" && styles.tabActive,
                  ]}
                  onPress={() => setActiveTab("westGate")}
                >
                  <LogIn
                    size={16}
                    color={
                      activeTab === "westGate" ? COLORS.primary : COLORS.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === "westGate" && styles.tabTextActive,
                    ]}
                  >
                    West Gate ({detailedReport.westGateEntries.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === "innerGate" && styles.tabActive,
                  ]}
                  onPress={() => setActiveTab("innerGate")}
                >
                  <LogOut
                    size={16}
                    color={
                      activeTab === "innerGate"
                        ? COLORS.primary
                        : COLORS.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === "innerGate" && styles.tabTextActive,
                    ]}
                  >
                    Inner Gate ({detailedReport.innerGateEntries.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {currentEntries.length > 0 && (
                <Card style={styles.entriesCard}>
                  <Text style={styles.entriesTitle}>
                    {activeTab === "westGate" ? "West Gate" : "Inner Gate"} Entries
                  </Text>
                  {currentEntries.slice(0, 20).map((entry) => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </Card>
              )}

              {currentEntries.length === 0 && (
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
        <Shield size={48} color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading supervisors...</Text>
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
          <Text style={styles.title}>Supervisor Reports</Text>
          <Text style={styles.subtitle}>View individual supervisor analytics</Text>
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone, or role..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <Text style={styles.resultCount}>
          {filteredSupervisors.length} supervisor
          {filteredSupervisors.length !== 1 ? "s" : ""} found
        </Text>

        {filteredSupervisors.map((supervisor) => {
          const roleColors = getRoleBadgeColor(supervisor.role);
          return (
            <TouchableOpacity
              key={supervisor.id}
              style={styles.supervisorCard}
              onPress={() => handleSelectSupervisor(supervisor.id)}
              activeOpacity={0.7}
            >
              <View style={styles.supervisorRow}>
                <View style={styles.supervisorIcon}>
                  <Shield size={24} color={COLORS.primary} />
                </View>
                <View style={styles.supervisorInfo}>
                  <Text style={styles.supervisorName}>{supervisor.fullName}</Text>
                  <View
                    style={[styles.roleBadgeSmall, { backgroundColor: roleColors.bg }]}
                  >
                    <Text style={[styles.roleBadgeTextSmall, { color: roleColors.text }]}>
                      {supervisor.role.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color={COLORS.textMuted} />
              </View>
              <View style={styles.supervisorStats}>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatValue}>{supervisor.westGateEntries}</Text>
                  <Text style={styles.miniStatLabel}>West Gate</Text>
                </View>
                <View style={styles.miniStatDivider} />
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatValue}>
                    {supervisor.innerGateVerifications}
                  </Text>
                  <Text style={styles.miniStatLabel}>Inner Gate</Text>
                </View>
                <View style={styles.miniStatDivider} />
                <View style={styles.miniStat}>
                  <Text style={[styles.miniStatValue, { color: COLORS.warning }]}>
                    {supervisor.westGateDevotees + supervisor.innerGateDevotees}
                  </Text>
                  <Text style={styles.miniStatLabel}>Devotees</Text>
                </View>
                <View style={styles.miniStatDivider} />
                <View style={styles.miniStat}>
                  <Text
                    style={[
                      styles.miniStatValue,
                      {
                        color:
                          supervisor.flaggedEntries > 0
                            ? COLORS.error
                            : COLORS.textMuted,
                      },
                    ]}
                  >
                    {supervisor.flaggedEntries}
                  </Text>
                  <Text style={styles.miniStatLabel}>Flagged</Text>
                </View>
              </View>
              {supervisor.lastActivityDate && (
                <View style={styles.lastActivity}>
                  <Calendar size={12} color={COLORS.textMuted} />
                  <Text style={styles.lastActivityText}>
                    Last activity:{" "}
                    {new Date(supervisor.lastActivityDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {filteredSupervisors.length === 0 && (
          <Card>
            <View style={styles.emptyState}>
              <Shield size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No supervisors found</Text>
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
  supervisorCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  supervisorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  supervisorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  supervisorInfo: {
    flex: 1,
    gap: 6,
  },
  supervisorName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  roleBadgeSmall: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeTextSmall: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  supervisorStats: {
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
    fontSize: 10,
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
  profileIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    gap: 6,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  profilePhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
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
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  chartLegend: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textSecondary,
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
  stackedBar: {
    width: 24,
  },
  chartValue: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  chartBarFill: {
    width: 24,
    minHeight: 0,
  },
  chartLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: "600",
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
  sebayatName: {
    fontSize: 13,
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
