import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  KeyboardAvoidingView,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  QrCode,
  Phone,
  CreditCard,
  Search,
  X,
  User,
  Users,
  Minus,
  Plus,
  Check,
  CircleAlert as AlertCircle,
  Camera,
  Clock,
  Ticket,
  List,
  DoorOpen,
  ScanLine,
  History,
  Flag,
  ChevronRight,
  Calendar,
  TrendingUp,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import {
  searchSebayatByPhone,
  searchSebayatByHealthCard,
  searchSebayatByQR,
  getSebayatDailyQuota,
  registerWestGateEntry,
  getWestGatePendingAcknowledgments,
  acknowledgeWestGateEntry,
  getEntryByCode,
  searchEntryByQR,
  isTicketExpired,
  getTicketTimeRemaining,
  verifyInnerGateEntry,
  flagEntryDiscrepancy,
  getPendingVerifications,
  getTodayEntries,
  getEntryStats,
} from "@/services/entryService";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type { SebayatRegistration, SebayatQuota, GateEntry, EntryStatus, EntryStats } from "@/types/database";
import type { CreateEntryResult, VerifyEntryResult } from "@/types";

type TabType = "dashboard" | "west-gate" | "inner-gate" | "history";
type SearchMode = "qr" | "phone" | "healthcard" | "code";
type ViewMode = "scan" | "pending";

const TABS: { key: TabType; label: string; icon: typeof DoorOpen }[] = [
  { key: "dashboard", label: "Overview", icon: TrendingUp },
  { key: "west-gate", label: "West Gate", icon: DoorOpen },
  { key: "inner-gate", label: "Marjana Mandap", icon: ScanLine },
  { key: "history", label: "History", icon: History },
];

const STATUS_CONFIG: Record<
  EntryStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Awaiting Gate",
    color: "#8B5CF6",
    bg: "#EDE9FE",
    icon: <Clock size={16} color="#8B5CF6" />,
  },
  registered: {
    label: "At Marjana Mandap",
    color: "#F59E0B",
    bg: "#FEF3C7",
    icon: <Clock size={16} color="#F59E0B" />,
  },
  verified: {
    label: "Verified",
    color: "#10B981",
    bg: "#D1FAE5",
    icon: <Check size={16} color="#10B981" />,
  },
  discrepancy_flagged: {
    label: "Flagged",
    color: "#EF4444",
    bg: "#FEE2E2",
    icon: <Flag size={16} color="#EF4444" />,
  },
  cancelled: {
    label: "Cancelled",
    color: "#6B7280",
    bg: "#F3F4F6",
    icon: <X size={16} color="#6B7280" />,
  },
};

export default function GateManagementScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState<EntryStats | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("scan");
  const [searchMode, setSearchMode] = useState<SearchMode>("code");
  const [searchValue, setSearchValue] = useState("");
  const [searching, setSearching] = useState(false);
  const [pendingTickets, setPendingTickets] = useState<GateEntry[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GateEntry | null>(null);
  const [sebayat, setSebayat] = useState<SebayatRegistration | null>(null);
  const [quota, setQuota] = useState<SebayatQuota | null>(null);
  const [devoteeCount, setDevoteeCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateEntryResult | VerifyEntryResult | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannerRef = useRef<boolean>(false);

  const [innerGateEntry, setInnerGateEntry] = useState<GateEntry | null>(null);
  const [innerGateEntryCode, setInnerGateEntryCode] = useState("");
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [innerSearching, setInnerSearching] = useState(false);
  const [pendingList, setPendingList] = useState<GateEntry[]>([]);
  const [showPendingList, setShowPendingList] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState("");

  const [historyEntries, setHistoryEntries] = useState<GateEntry[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"all" | EntryStatus>("all");

  const loadStats = useCallback(async () => {
    try {
      const data = await getEntryStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }, []);

  const loadPendingTickets = useCallback(async () => {
    setLoadingPending(true);
    const tickets = await getWestGatePendingAcknowledgments();
    setPendingTickets(tickets);
    setLoadingPending(false);
  }, []);

  const loadHistoryEntries = useCallback(async () => {
    try {
      const data = await getTodayEntries();
      setHistoryEntries(data);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
      loadPendingTickets();
      loadHistoryEntries();
    }, [loadStats, loadPendingTickets, loadHistoryEntries])
  );

  useEffect(() => {
    if (sebayat) {
      loadQuota();
    }
  }, [sebayat]);

  const loadQuota = async () => {
    if (!sebayat) return;
    const quotaData = await getSebayatDailyQuota(sebayat.id);
    setQuota(quotaData);
    if (devoteeCount > quotaData.remainingCount && quotaData.remainingCount > 0) {
      setDevoteeCount(quotaData.remainingCount);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadPendingTickets(), loadHistoryEntries()]);
    setRefreshing(false);
  };

  const handleWestGateSearch = async () => {
    if (!searchValue.trim()) {
      setError("Please enter a search value");
      return;
    }

    setSearching(true);
    setError(null);
    setSebayat(null);
    setSelectedEntry(null);
    setQuota(null);

    try {
      if (searchMode === "code") {
        const entry = await getEntryByCode(searchValue.trim().toUpperCase());
        if (entry) {
          if (entry.status !== "pending") {
            setError("This ticket has already been processed");
          } else if (isTicketExpired(entry)) {
            setError("This ticket has expired");
          } else {
            setSelectedEntry(entry);
          }
        } else {
          setError("No ticket found with this code");
        }
      } else if (searchMode === "phone") {
        const found = await searchSebayatByPhone(searchValue.trim());
        if (found) {
          setSebayat(found);
          setDevoteeCount(1);
        } else {
          setError("No approved sebayat found with this phone number");
        }
      } else if (searchMode === "healthcard") {
        const found = await searchSebayatByHealthCard(searchValue.trim());
        if (found) {
          setSebayat(found);
          setDevoteeCount(1);
        } else {
          setError("No approved sebayat found with this health card");
        }
      }
    } catch (err) {
      setError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleQRScan = async (data: string) => {
    if (scannerRef.current) return;
    scannerRef.current = true;

    try {
      if (activeTab === "inner-gate") {
        const found = await searchEntryByQR(data);
        if (found) {
          if (found.status === "verified") {
            setError("This entry has already been verified");
          } else if (found.status === "cancelled") {
            setError("This entry was cancelled");
          } else if (found.status === "pending") {
            setError("This entry is still pending at West Gate");
          } else if (found.status === "discrepancy_flagged") {
            setError("This entry has been flagged for discrepancy");
          } else {
            setInnerGateEntry(found);
            setVerifiedCount(found.declared_devotee_count);
          }
        } else {
          setError("Invalid QR code or entry not found");
        }
        setShowScanner(false);
        return;
      }

      const entry = await searchEntryByQR(data);
      if (entry) {
        if (entry.status !== "pending") {
          setError("This ticket has already been processed");
        } else if (isTicketExpired(entry)) {
          setError("This ticket has expired");
        } else {
          setSelectedEntry(entry);
        }
        setShowScanner(false);
        return;
      }

      const found = await searchSebayatByQR(data);
      if (found) {
        setSebayat(found);
        setDevoteeCount(1);
        setShowScanner(false);
      } else {
        setError("Invalid QR code");
        setShowScanner(false);
      }
    } catch (err) {
      setError("Failed to process QR code");
      setShowScanner(false);
    } finally {
      scannerRef.current = false;
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError("Camera permission is required for QR scanning");
        return;
      }
    }
    setShowScanner(true);
    scannerRef.current = false;
  };

  const handleAcknowledgeEntry = async (entry: GateEntry) => {
    if (!profile) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await acknowledgeWestGateEntry(entry.id, profile.id);
      if (res.success) {
        setResult(res);
        await loadPendingTickets();
        await loadStats();
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError("Failed to acknowledge entry");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWestGateSubmit = async () => {
    if (!sebayat || !profile || !quota) return;

    if (devoteeCount <= 0) {
      setError("Devotee count must be at least 1");
      return;
    }

    if (devoteeCount > quota.remainingCount) {
      setError(`Only ${quota.remainingCount} slots remaining for today`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const entryResult = await registerWestGateEntry(sebayat.id, devoteeCount, profile.id);
      setResult(entryResult);
      if (!entryResult.success) {
        setError(entryResult.message);
      } else {
        await loadStats();
      }
    } catch (err) {
      setError("Failed to register entry");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInnerGateSearch = async () => {
    if (!innerGateEntryCode.trim()) {
      setError("Please enter an entry code");
      return;
    }

    setInnerSearching(true);
    setError(null);
    setInnerGateEntry(null);

    try {
      const found = await getEntryByCode(innerGateEntryCode.trim().toUpperCase());
      if (found) {
        if (found.status === "verified") {
          setError("This entry has already been verified");
        } else if (found.status === "cancelled") {
          setError("This entry was cancelled");
        } else if (found.status === "pending") {
          setError("This entry is still pending at West Gate");
        } else if (found.status === "discrepancy_flagged") {
          setError("This entry has been flagged for discrepancy");
        } else {
          setInnerGateEntry(found);
          setVerifiedCount(found.declared_devotee_count);
        }
      } else {
        setError("Entry not found with this code");
      }
    } catch (err) {
      setError("Search failed. Please try again.");
    } finally {
      setInnerSearching(false);
    }
  };

  const loadInnerGatePendingList = async () => {
    const pending = await getPendingVerifications();
    setPendingList(pending);
    setShowPendingList(true);
  };

  const selectPendingEntry = (entry: GateEntry) => {
    setInnerGateEntry(entry);
    setVerifiedCount(entry.declared_devotee_count);
    setShowPendingList(false);
  };

  const handleVerify = async () => {
    if (!innerGateEntry || !profile) return;

    const needsReason = verifiedCount !== innerGateEntry.declared_devotee_count;
    if (needsReason && !adjustReason.trim()) {
      setError("Please provide a reason for the count adjustment");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const verifyResult = await verifyInnerGateEntry(
        innerGateEntry.id,
        verifiedCount,
        profile.id,
        needsReason ? adjustReason.trim() : undefined
      );

      setResult(verifyResult);
      if (!verifyResult.success) {
        setError(verifyResult.message);
      } else {
        await Promise.all([loadStats(), loadHistoryEntries()]);
      }
    } catch (err) {
      setError("Failed to verify entry");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFlag = async () => {
    if (!innerGateEntry || !profile || !flagReason.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const flagResult = await flagEntryDiscrepancy(innerGateEntry.id, flagReason.trim(), profile.id);

      if (flagResult.success) {
        setResult(flagResult);
        setShowFlagModal(false);
        await loadHistoryEntries();
      } else {
        setError(flagResult.message);
      }
    } catch (err) {
      setError("Failed to flag entry");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSebayat(null);
    setSelectedEntry(null);
    setQuota(null);
    setSearchValue("");
    setDevoteeCount(1);
    setError(null);
    setResult(null);
    setInnerGateEntry(null);
    setInnerGateEntryCode("");
    setVerifiedCount(0);
    setAdjustReason("");
    setFlagReason("");
  };

  const adjustDevoteeCount = (delta: number) => {
    const newCount = devoteeCount + delta;
    if (newCount >= 1 && quota && newCount <= quota.remainingCount) {
      setDevoteeCount(newCount);
    }
  };

  const adjustVerifiedCount = (delta: number) => {
    const newCount = verifiedCount + delta;
    if (newCount >= 0) {
      setVerifiedCount(newCount);
    }
  };

  const formatTimeRemaining = (entry: GateEntry) => {
    const remaining = getTicketTimeRemaining(entry);
    if (remaining <= 0) return "Expired";
    const minutes = Math.floor(remaining / 60000);
    if (minutes < 60) return `${minutes}m left`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const filteredHistoryEntries =
    historyFilter === "all"
      ? historyEntries
      : historyEntries.filter((e) => e.status === historyFilter);

  const statusCounts = {
    all: historyEntries.length,
    pending: historyEntries.filter((e) => e.status === "pending").length,
    registered: historyEntries.filter((e) => e.status === "registered").length,
    verified: historyEntries.filter((e) => e.status === "verified").length,
    discrepancy_flagged: historyEntries.filter((e) => e.status === "discrepancy_flagged").length,
    cancelled: historyEntries.filter((e) => e.status === "cancelled").length,
  };

  const renderDashboard = () => (
    <View style={styles.dashboardContent}>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: "#DBEAFE" }]}>
          <View style={[styles.statIconContainer, { backgroundColor: "#3B82F6" }]}>
            <DoorOpen size={24} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: "#3B82F6" }]}>{stats?.todayEntries || 0}</Text>
          <Text style={styles.statTitle}>ENTRIES</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#D1FAE5" }]}>
          <View style={[styles.statIconContainer, { backgroundColor: "#10B981" }]}>
            <Users size={24} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: "#10B981" }]}>{stats?.todayDevotees || 0}</Text>
          <Text style={styles.statTitle}>DEVOTEES</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#FEF3C7" }]}>
          <View style={[styles.statIconContainer, { backgroundColor: "#F59E0B" }]}>
            <Clock size={24} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: "#F59E0B" }]}>{stats?.pendingVerifications || 0}</Text>
          <Text style={styles.statTitle}>PENDING</Text>
        </View>
      </View>

      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => setActiveTab("west-gate")}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: "#DBEAFE" }]}>
              <DoorOpen size={24} color="#3B82F6" />
            </View>
            <View style={styles.quickActionText}>
              <Text style={styles.quickActionTitle}>West Gate Entry</Text>
              <Text style={styles.quickActionSubtitle}>Register new entry</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => setActiveTab("inner-gate")}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: "#D1FAE5" }]}>
              <ScanLine size={24} color="#10B981" />
            </View>
            <View style={styles.quickActionText}>
              <Text style={styles.quickActionTitle}>Marjana Mandap Verify</Text>
              <Text style={styles.quickActionSubtitle}>Verify entries</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderWestGate = () => {
    if (result && "success" in result && result.success && result.entry) {
      return (
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Check size={48} color="#fff" />
          </View>
          <Text style={styles.successTitle}>
            {selectedEntry ? "Entry Acknowledged" : "Entry Registered"}
          </Text>
          <Text style={styles.successSubtitle}>
            {selectedEntry ? "Darshan may proceed to inner gate" : "Give this code to the Darshan"}
          </Text>

          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Entry Code</Text>
            <Text style={styles.codeValue}>{result.entry.entry_code}</Text>
          </View>

          <View style={styles.entryDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Darshan</Text>
              <Text style={styles.detailValue}>{(result.entry.sebayat as any)?.full_name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Devotees</Text>
              <Text style={styles.detailValue}>{result.entry.declared_devotee_count}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.newEntryButton} onPress={resetForm} activeOpacity={0.8}>
            <Text style={styles.newEntryButtonText}>Process Next Entry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.gateContent}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === "scan" && styles.toggleButtonActive]}
            onPress={() => setViewMode("scan")}
          >
            <QrCode size={18} color={viewMode === "scan" ? "#fff" : COLORS.textSecondary} />
            <Text style={[styles.toggleText, viewMode === "scan" && styles.toggleTextActive]}>
              Scan / Search
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === "pending" && styles.toggleButtonActive]}
            onPress={() => setViewMode("pending")}
          >
            <List size={18} color={viewMode === "pending" ? "#fff" : COLORS.textSecondary} />
            <Text style={[styles.toggleText, viewMode === "pending" && styles.toggleTextActive]}>
              Pending ({pendingTickets.length})
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === "pending" ? (
          <View style={styles.pendingSection}>
            {loadingPending ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : pendingTickets.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ticket size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>No Pending Tickets</Text>
              </View>
            ) : (
              pendingTickets.map((ticket) => {
                const expired = isTicketExpired(ticket);
                const sebayatData = ticket.sebayat as any;
                return (
                  <TouchableOpacity
                    key={ticket.id}
                    style={[styles.pendingCard, expired && styles.pendingCardExpired]}
                    onPress={() => !expired && setSelectedEntry(ticket)}
                    activeOpacity={0.7}
                    disabled={expired}
                  >
                    <View style={styles.pendingLeft}>
                      {sebayatData?.photo_url ? (
                        <Image source={{ uri: sebayatData.photo_url }} style={styles.pendingPhoto} />
                      ) : (
                        <View style={styles.pendingPhotoPlaceholder}>
                          <User size={24} color={COLORS.textMuted} />
                        </View>
                      )}
                      <View style={styles.pendingInfo}>
                        <Text style={styles.pendingName}>{sebayatData?.full_name}</Text>
                        <View style={styles.pendingMeta}>
                          <Users size={12} color={COLORS.textSecondary} />
                          <Text style={styles.pendingMetaText}>
                            {ticket.declared_devotee_count} devotee
                            {ticket.declared_devotee_count > 1 ? "s" : ""}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.pendingRight}>
                      <Text style={styles.pendingCode}>{ticket.entry_code}</Text>
                      <View style={[styles.pendingTimeRow, expired && styles.pendingTimeExpired]}>
                        <Clock size={12} color={expired ? COLORS.error : COLORS.warning} />
                        <Text style={[styles.pendingTime, expired && { color: COLORS.error }]}>
                          {formatTimeRemaining(ticket)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : (
          <>
            <View style={styles.modeSelector}>
              {(["code", "qr", "phone", "healthcard"] as SearchMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.modeButton, searchMode === mode && styles.modeButtonActive]}
                  onPress={() => {
                    setSearchMode(mode);
                    setSearchValue("");
                    setError(null);
                    setSebayat(null);
                    setSelectedEntry(null);
                  }}
                  activeOpacity={0.7}
                >
                  {mode === "code" && (
                    <Ticket size={18} color={searchMode === mode ? "#fff" : COLORS.textSecondary} />
                  )}
                  {mode === "qr" && (
                    <QrCode size={18} color={searchMode === mode ? "#fff" : COLORS.textSecondary} />
                  )}
                  {mode === "phone" && (
                    <Phone size={18} color={searchMode === mode ? "#fff" : COLORS.textSecondary} />
                  )}
                  {mode === "healthcard" && (
                    <CreditCard size={18} color={searchMode === mode ? "#fff" : COLORS.textSecondary} />
                  )}
                  <Text
                    style={[styles.modeButtonText, searchMode === mode && styles.modeButtonTextActive]}
                  >
                    {mode === "healthcard" ? "HC" : mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {searchMode === "qr" ? (
              <TouchableOpacity style={styles.scanButton} onPress={openScanner} activeOpacity={0.8}>
                <Camera size={32} color={COLORS.primary} />
                <Text style={styles.scanButtonText}>Tap to Scan QR Code</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.searchCard}>
                <View style={styles.searchInputContainer}>
                  {searchMode === "phone" && <Text style={styles.phonePrefix}>+91</Text>}
                  <TextInput
                    style={styles.searchInput}
                    value={searchValue}
                    onChangeText={setSearchValue}
                    placeholder={
                      searchMode === "code"
                        ? "Enter 6-character code"
                        : searchMode === "phone"
                        ? "Enter 10-digit number"
                        : "Enter Health Card ID"
                    }
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType={searchMode === "phone" ? "phone-pad" : "default"}
                    maxLength={searchMode === "phone" ? 10 : searchMode === "code" ? 6 : 20}
                    autoCapitalize="characters"
                  />
                  {searchValue.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchValue("")}>
                      <X size={18} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.searchButton, searching && styles.searchButtonDisabled]}
                  onPress={handleWestGateSearch}
                  disabled={searching}
                  activeOpacity={0.8}
                >
                  <Search size={20} color="#fff" />
                  <Text style={styles.searchButtonText}>{searching ? "Searching..." : "Search"}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {selectedEntry && (
          <View style={styles.acknowledgeCard}>
            <View style={styles.acknowledgeHeader}>
              <View style={styles.acknowledgeIcon}>
                <Ticket size={24} color={COLORS.primary} />
              </View>
              <View style={styles.acknowledgeHeaderInfo}>
                <Text style={styles.acknowledgeTitle}>Acknowledge Ticket</Text>
                <Text style={styles.acknowledgeCode}>{selectedEntry.entry_code}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedEntry(null)}>
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.acknowledgeSebayat}>
              {(selectedEntry.sebayat as any)?.photo_url ? (
                <Image
                  source={{ uri: (selectedEntry.sebayat as any).photo_url }}
                  style={styles.acknowledgeSebayatPhoto}
                />
              ) : (
                <View style={styles.acknowledgeSebayatPhotoPlaceholder}>
                  <User size={32} color={COLORS.textMuted} />
                </View>
              )}
              <View style={styles.acknowledgeSebayatInfo}>
                <Text style={styles.acknowledgeSebayatName}>
                  {(selectedEntry.sebayat as any)?.full_name}
                </Text>
                <Text style={styles.acknowledgeSebayatCategory}>
                  {(selectedEntry.sebayat as any)?.category?.name || "No Nijog"}
                </Text>
              </View>
            </View>

            <View style={styles.acknowledgeDetails}>
              <View style={styles.acknowledgeDetailItem}>
                <Users size={20} color={COLORS.primary} />
                <Text style={styles.acknowledgeDetailValue}>{selectedEntry.declared_devotee_count}</Text>
                <Text style={styles.acknowledgeDetailLabel}>Devotees</Text>
              </View>
              <View style={styles.acknowledgeDetailDivider} />
              <View style={styles.acknowledgeDetailItem}>
                <Clock size={20} color={COLORS.warning} />
                <Text style={styles.acknowledgeDetailValue}>{formatTimeRemaining(selectedEntry)}</Text>
                <Text style={styles.acknowledgeDetailLabel}>Remaining</Text>
              </View>
            </View>

            {selectedEntry.entry_mode === "marjana_mandap" && (
              <View style={styles.marjanaMandapBlockBanner}>
                <AlertCircle size={16} color="#0891b2" />
                <Text style={styles.marjanaMandapBlockText}>This ticket is for Marjana Mandap direct entry. West Gate entry is not allowed.</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.acknowledgeButton, (submitting || selectedEntry.entry_mode === "marjana_mandap") && styles.acknowledgeButtonDisabled]}
              onPress={() => selectedEntry.entry_mode !== "marjana_mandap" && handleAcknowledgeEntry(selectedEntry)}
              disabled={submitting || selectedEntry.entry_mode === "marjana_mandap"}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Check size={20} color="#fff" />
                  <Text style={styles.acknowledgeButtonText}>
                    {selectedEntry.entry_mode === "marjana_mandap" ? "Marjana Mandap" : "Acknowledge Entry"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {sebayat && quota && !selectedEntry && (
          <View style={styles.sebayatCard}>
            <View style={styles.sebayatHeader}>
              {sebayat.photo_url ? (
                <Image source={{ uri: sebayat.photo_url }} style={styles.sebayatPhoto} />
              ) : (
                <View style={styles.sebayatPhotoPlaceholder}>
                  <User size={32} color={COLORS.textMuted} />
                </View>
              )}
              <View style={styles.sebayatInfo}>
                <Text style={styles.sebayatName}>{sebayat.full_name}</Text>
                <Text style={styles.sebayatCategory}>
                  {(sebayat.category as any)?.name || "No Nijog"}
                </Text>
              </View>
              <TouchableOpacity style={styles.changeSebayatButton} onPress={resetForm}>
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.quotaBar}>
              <View style={styles.quotaInfo}>
                <Text style={styles.quotaLabel}>Today's Quota</Text>
                <Text style={styles.quotaValue}>
                  {quota.usedCount} / {quota.maxLimit} used
                </Text>
              </View>
              <View style={styles.quotaProgressBg}>
                <View
                  style={[
                    styles.quotaProgressFill,
                    {
                      width: `${(quota.usedCount / quota.maxLimit) * 100}%`,
                      backgroundColor:
                        quota.remainingCount <= 5
                          ? COLORS.error
                          : quota.remainingCount <= 15
                          ? COLORS.warning
                          : COLORS.success,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.quotaRemaining,
                  {
                    color:
                      quota.remainingCount <= 5
                        ? COLORS.error
                        : quota.remainingCount <= 15
                        ? COLORS.warning
                        : COLORS.success,
                  },
                ]}
              >
                {quota.remainingCount} remaining
              </Text>
            </View>

            {quota.remainingCount > 0 ? (
              <>
                <View style={styles.countSection}>
                  <Text style={styles.countLabel}>Number of Devotees</Text>
                  <View style={styles.countControl}>
                    <TouchableOpacity
                      style={[styles.countButton, devoteeCount <= 1 && styles.countButtonDisabled]}
                      onPress={() => adjustDevoteeCount(-1)}
                      disabled={devoteeCount <= 1}
                      activeOpacity={0.7}
                    >
                      <Minus size={24} color={devoteeCount <= 1 ? COLORS.textMuted : COLORS.text} />
                    </TouchableOpacity>
                    <View style={styles.countDisplay}>
                      <Users size={20} color={COLORS.primary} />
                      <Text style={styles.countValue}>{devoteeCount}</Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.countButton,
                        devoteeCount >= quota.remainingCount && styles.countButtonDisabled,
                      ]}
                      onPress={() => adjustDevoteeCount(1)}
                      disabled={devoteeCount >= quota.remainingCount}
                      activeOpacity={0.7}
                    >
                      <Plus
                        size={24}
                        color={devoteeCount >= quota.remainingCount ? COLORS.textMuted : COLORS.text}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                  onPress={handleWestGateSubmit}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitButtonText}>
                    {submitting ? "Registering..." : "Register Entry"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.quotaExhausted}>
                <AlertCircle size={24} color={COLORS.error} />
                <Text style={styles.quotaExhaustedText}>Daily quota exhausted</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderInnerGate = () => {
    if (result && "success" in result && result.success && result.entry) {
      return (
        <View style={styles.successCard}>
          <View
            style={[
              styles.successIcon,
              result.entry.status === "discrepancy_flagged" && { backgroundColor: COLORS.warning },
            ]}
          >
            {result.entry.status === "discrepancy_flagged" ? (
              <Flag size={48} color="#fff" />
            ) : (
              <Check size={48} color="#fff" />
            )}
          </View>
          <Text style={styles.successTitle}>
            {result.entry.status === "discrepancy_flagged" ? "Entry Flagged" : "Entry Verified"}
          </Text>
          <Text style={styles.successSubtitle}>
            {result.entry.status === "discrepancy_flagged"
              ? "This entry has been flagged for review"
              : "The entry has been verified successfully"}
          </Text>

          <View style={styles.entryDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Entry Code</Text>
              <Text style={styles.detailValue}>{result.entry.entry_code}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Darshan</Text>
              <Text style={styles.detailValue}>{(result.entry.sebayat as any)?.full_name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Verified Count</Text>
              <Text style={styles.detailValue}>{result.entry.verified_devotee_count ?? "-"}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.newEntryButton} onPress={resetForm} activeOpacity={0.8}>
            <Text style={styles.newEntryButtonText}>Verify Next Entry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.gateContent}>
        {!innerGateEntry && (
          <>
            <View style={styles.searchActions}>
              <TouchableOpacity style={styles.scanActionButton} onPress={openScanner} activeOpacity={0.8}>
                <Camera size={28} color={COLORS.primary} />
                <Text style={styles.scanActionText}>Scan QR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.listActionButton}
                onPress={loadInnerGatePendingList}
                activeOpacity={0.8}
              >
                <Clock size={24} color={COLORS.warning} />
                <Text style={styles.listActionText}>Pending</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or enter code</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.searchCard}>
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInputCentered}
                  value={innerGateEntryCode}
                  onChangeText={(text) => setInnerGateEntryCode(text.toUpperCase())}
                  placeholder="Enter 6-digit entry code"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="characters"
                  maxLength={6}
                />
                {innerGateEntryCode.length > 0 && (
                  <TouchableOpacity onPress={() => setInnerGateEntryCode("")}>
                    <X size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[styles.searchButton, innerSearching && styles.searchButtonDisabled]}
                onPress={handleInnerGateSearch}
                disabled={innerSearching}
                activeOpacity={0.8}
              >
                <Search size={20} color="#fff" />
                <Text style={styles.searchButtonText}>
                  {innerSearching ? "Searching..." : "Find Entry"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {innerGateEntry && (
          <View style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <View style={styles.entryCodeBadge}>
                <Text style={styles.entryCodeText}>{innerGateEntry.entry_code}</Text>
              </View>
              <TouchableOpacity style={styles.changeEntryButton} onPress={resetForm}>
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.sebayatSection}>
              {(innerGateEntry.sebayat as any)?.photo_url ? (
                <Image
                  source={{ uri: (innerGateEntry.sebayat as any).photo_url }}
                  style={styles.sebayatSectionPhoto}
                />
              ) : (
                <View style={styles.sebayatSectionPhotoPlaceholder}>
                  <User size={32} color={COLORS.textMuted} />
                </View>
              )}
              <View style={styles.sebayatSectionInfo}>
                <Text style={styles.sebayatSectionName}>
                  {(innerGateEntry.sebayat as any)?.full_name || "Unknown"}
                </Text>
                <Text style={styles.sebayatSectionCategory}>
                  {(innerGateEntry.sebayat as any)?.category?.name || "No Nijog"}
                </Text>
              </View>
            </View>

            <View style={styles.declaredCount}>
              <Text style={styles.declaredLabel}>Declared at West Gate</Text>
              <View style={styles.declaredValue}>
                <Users size={20} color={COLORS.text} />
                <Text style={styles.declaredNumber}>{innerGateEntry.declared_devotee_count}</Text>
                <Text style={styles.declaredUnit}>devotees</Text>
              </View>
            </View>

            <View style={styles.verifySection}>
              <Text style={styles.verifyLabel}>Actual Count</Text>
              <View style={styles.countControl}>
                <TouchableOpacity
                  style={[styles.countButton, verifiedCount <= 0 && styles.countButtonDisabled]}
                  onPress={() => adjustVerifiedCount(-1)}
                  disabled={verifiedCount <= 0}
                  activeOpacity={0.7}
                >
                  <Minus size={24} color={verifiedCount <= 0 ? COLORS.textMuted : COLORS.text} />
                </TouchableOpacity>
                <View
                  style={[
                    styles.countDisplay,
                    verifiedCount !== innerGateEntry.declared_devotee_count && {
                      backgroundColor:
                        verifiedCount > innerGateEntry.declared_devotee_count ? "#D1FAE5" : "#FEF3C7",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countValue,
                      verifiedCount !== innerGateEntry.declared_devotee_count && {
                        color:
                          verifiedCount > innerGateEntry.declared_devotee_count
                            ? COLORS.success
                            : COLORS.warning,
                      },
                    ]}
                  >
                    {verifiedCount}
                  </Text>
                </View>
                <TouchableOpacity style={styles.countButton} onPress={() => adjustVerifiedCount(1)}>
                  <Plus size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {verifiedCount !== innerGateEntry.declared_devotee_count && (
                <View style={styles.reasonSection}>
                  <Text style={styles.reasonLabel}>Reason for adjustment (required)</Text>
                  <TextInput
                    style={styles.reasonInput}
                    value={adjustReason}
                    onChangeText={setAdjustReason}
                    placeholder="Enter reason for count difference"
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              )}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.verifyButton, submitting && styles.verifyButtonDisabled]}
                onPress={handleVerify}
                disabled={submitting}
                activeOpacity={0.8}
              >
                <Check size={20} color="#fff" />
                <Text style={styles.verifyButtonText}>{submitting ? "Verifying..." : "Verify Entry"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.flagButton}
                onPress={() => setShowFlagModal(true)}
                activeOpacity={0.7}
              >
                <Flag size={20} color={COLORS.warning} />
                <Text style={styles.flagButtonText}>Flag Issue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderHistory = () => (
    <View style={styles.historyContent}>
      <View style={styles.historyDateContainer}>
        <Calendar size={16} color={COLORS.textSecondary} />
        <Text style={styles.historyDateText}>
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "short",
          })}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.historyFilterScroll}
        contentContainerStyle={styles.historyFilterContainer}
      >
        {(
          [
            { status: "all", label: "All" },
            { status: "pending", label: "Awaiting" },
            { status: "registered", label: "At Marjana Mandap" },
            { status: "verified", label: "Verified" },
            { status: "discrepancy_flagged", label: "Flagged" },
          ] as { status: "all" | EntryStatus; label: string }[]
        ).map(({ status, label }) => (
          <TouchableOpacity
            key={status}
            style={[styles.historyFilterButton, historyFilter === status && styles.historyFilterButtonActive]}
            onPress={() => setHistoryFilter(status)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.historyFilterText,
                historyFilter === status && styles.historyFilterTextActive,
              ]}
            >
              {label}
            </Text>
            <View
              style={[
                styles.historyFilterCount,
                historyFilter === status && styles.historyFilterCountActive,
              ]}
            >
              <Text
                style={[
                  styles.historyFilterCountText,
                  historyFilter === status && styles.historyFilterCountTextActive,
                ]}
              >
                {statusCounts[status]}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filteredHistoryEntries.length === 0 ? (
        <View style={styles.emptyState}>
          <Clock size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyStateText}>No entries found</Text>
        </View>
      ) : (
        <View style={styles.historyList}>
          {filteredHistoryEntries.map((entry) => {
            const config = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
            const sebayatEntry = entry.sebayat as any;
            const entryTime = entry.west_gate_entry_time || entry.created_at;

            return (
              <TouchableOpacity
                key={entry.id}
                style={styles.historyItem}
                onPress={() => router.push(`/(supervisor)/entry/${entry.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.historyItemLeft}>
                  <View style={styles.historyItemCodeContainer}>
                    <Text style={styles.historyItemCode}>{entry.entry_code}</Text>
                  </View>
                  <View style={styles.historyItemInfo}>
                    <Text style={styles.historyItemName}>{sebayatEntry?.full_name || "Unknown"}</Text>
                    <View style={styles.historyItemMeta}>
                      <Users size={14} color={COLORS.textSecondary} />
                      <Text style={styles.historyItemCount}>
                        {entry.verified_devotee_count ?? entry.declared_devotee_count} devotees
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.historyItemRight}>
                  <View style={[styles.historyStatusBadge, { backgroundColor: config.bg }]}>
                    {config.icon}
                    <Text style={[styles.historyStatusText, { color: config.color }]}>{config.label}</Text>
                  </View>
                  <Text style={styles.historyItemTime}>
                    {entryTime
                      ? new Date(entryTime).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </Text>
                </View>
                <ChevronRight size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Gate Management</Text>
        <Text style={styles.subtitle}>Manage entry operations</Text>
      </View>

      <View style={styles.tabsContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => {
              setActiveTab(tab.key);
              resetForm();
            }}
            activeOpacity={0.8}
          >
            <tab.icon size={18} color={activeTab === tab.key ? "#fff" : COLORS.textSecondary} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && (
        <View style={styles.errorCard}>
          <AlertCircle size={20} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <X size={18} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        >
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "west-gate" && renderWestGate()}
          {activeTab === "inner-gate" && renderInnerGate()}
          {activeTab === "history" && renderHistory()}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showScanner} animationType="slide">
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan QR Code</Text>
            <TouchableOpacity style={styles.scannerClose} onPress={() => setShowScanner(false)}>
              <X size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          {Platform.OS !== "web" ? (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={(res) => res.data && handleQRScan(res.data)}
            >
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerFrame} />
              </View>
            </CameraView>
          ) : (
            <View style={styles.webCameraPlaceholder}>
              <QrCode size={64} color={COLORS.textMuted} />
              <Text style={styles.webCameraText}>QR scanning is not supported in web browser</Text>
              <TouchableOpacity style={styles.webCameraButton} onPress={() => setShowScanner(false)}>
                <Text style={styles.webCameraButtonText}>Use Manual Search</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={showPendingList} animationType="slide">
        <View style={styles.pendingListContainer}>
          <View style={styles.pendingListHeader}>
            <Text style={styles.pendingListTitle}>Pending Verifications</Text>
            <TouchableOpacity style={styles.pendingListClose} onPress={() => setShowPendingList(false)}>
              <X size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pendingListContent}>
            {pendingList.length === 0 ? (
              <View style={styles.emptyState}>
                <Clock size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyStateText}>No pending entries</Text>
              </View>
            ) : (
              pendingList.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.pendingListItem}
                  onPress={() => selectPendingEntry(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.pendingListItemCode}>
                    <Text style={styles.pendingListItemCodeText}>{item.entry_code}</Text>
                  </View>
                  <View style={styles.pendingListItemInfo}>
                    <Text style={styles.pendingListItemName}>
                      {(item.sebayat as any)?.full_name || "Unknown"}
                    </Text>
                    <Text style={styles.pendingListItemCount}>{item.declared_devotee_count} devotees</Text>
                  </View>
                  <ChevronRight size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showFlagModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.flagModal}>
            <View style={styles.flagModalHeader}>
              <Flag size={24} color={COLORS.warning} />
              <Text style={styles.flagModalTitle}>Flag Discrepancy</Text>
            </View>
            <Text style={styles.flagModalSubtitle}>Describe the issue with this entry</Text>
            <TextInput
              style={styles.flagInput}
              value={flagReason}
              onChangeText={setFlagReason}
              placeholder="Enter reason for flagging..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={4}
            />
            <View style={styles.flagModalActions}>
              <TouchableOpacity
                style={styles.flagCancelButton}
                onPress={() => {
                  setShowFlagModal(false);
                  setFlagReason("");
                }}
              >
                <Text style={styles.flagCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.flagSubmitButton, (!flagReason.trim() || submitting) && styles.flagSubmitDisabled]}
                onPress={handleFlag}
                disabled={!flagReason.trim() || submitting}
              >
                <Text style={styles.flagSubmitText}>{submitting ? "Flagging..." : "Flag Entry"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: "#fff",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "500",
  },
  dashboardContent: {},
  overviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  overviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  overviewIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  overviewLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  overviewDate: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    ...SHADOWS.small,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
  },
  statTitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "600",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 16,
  },
  quickActions: {
    gap: 12,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
    ...SHADOWS.small,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionText: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  gateContent: {},
  viewToggle: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  toggleTextActive: {
    color: "#fff",
  },
  modeSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  modeButtonTextActive: {
    color: "#fff",
  },
  scanButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: 12,
  },
  searchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 54,
    marginBottom: 14,
  },
  phonePrefix: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "500",
  },
  searchInputCentered: {
    flex: 1,
    fontSize: 20,
    color: COLORS.text,
    fontWeight: "700",
    letterSpacing: 4,
    textAlign: "center",
  },
  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  pendingSection: {
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 16,
  },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  pendingCardExpired: {
    opacity: 0.5,
    borderColor: COLORS.error,
  },
  pendingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  pendingPhoto: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  pendingPhotoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  pendingInfo: {
    marginLeft: 12,
    flex: 1,
  },
  pendingName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  pendingMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  pendingMetaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  pendingRight: {
    alignItems: "flex-end",
  },
  pendingCode: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: 1,
  },
  pendingTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  pendingTimeExpired: {},
  pendingTime: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.warning,
  },
  acknowledgeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  acknowledgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  acknowledgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  acknowledgeHeaderInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  acknowledgeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  acknowledgeCode: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  acknowledgeSebayat: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  acknowledgeSebayatPhoto: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  acknowledgeSebayatPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  acknowledgeSebayatInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  acknowledgeSebayatName: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
  },
  acknowledgeSebayatCategory: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
    marginTop: 2,
  },
  acknowledgeDetails: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  acknowledgeDetailItem: {
    alignItems: "center",
    flex: 1,
  },
  acknowledgeDetailValue: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 6,
  },
  acknowledgeDetailLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  acknowledgeDetailDivider: {
    width: 1,
    height: 48,
    backgroundColor: COLORS.border,
  },
  marjanaMandapBlockBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.xs,
    backgroundColor: "#0891b215",
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: "#0891b230",
  },
  marjanaMandapBlockText: {
    flex: 1,
    fontSize: 13,
    color: "#0891b2",
    lineHeight: 18,
  },
  acknowledgeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    gap: SPACING.sm,
  },
  acknowledgeButtonDisabled: {
    opacity: 0.6,
  },
  acknowledgeButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  sebayatCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  sebayatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  sebayatPhoto: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  sebayatPhotoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  sebayatInfo: {
    flex: 1,
  },
  sebayatName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  sebayatCategory: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
    marginTop: 2,
  },
  changeSebayatButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  quotaBar: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  quotaInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  quotaLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  quotaValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  quotaProgressBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  quotaProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
  quotaRemaining: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10,
    textAlign: "center",
  },
  countSection: {
    marginBottom: 20,
  },
  countLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 14,
  },
  countControl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  countButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countButtonDisabled: {
    opacity: 0.4,
  },
  countDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
    minWidth: 100,
    justifyContent: "center",
  },
  countValue: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.primary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    ...SHADOWS.small,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  quotaExhausted: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 20,
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
  },
  quotaExhaustedText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.error,
  },
  successCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 28,
    textAlign: "center",
  },
  codeContainer: {
    width: "100%",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  codeLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 40,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 6,
  },
  entryDetails: {
    width: "100%",
    gap: 12,
    marginBottom: 28,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  newEntryButton: {
    width: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  newEntryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  searchActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  scanActionButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  scanActionText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
  },
  listActionButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.warning,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  listActionText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.warning,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 13,
    color: COLORS.textMuted,
    paddingHorizontal: 16,
  },
  entryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  entryCodeBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  entryCodeText: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 3,
  },
  changeEntryButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  sebayatSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sebayatSectionPhoto: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  sebayatSectionPhotoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  sebayatSectionInfo: {
    flex: 1,
  },
  sebayatSectionName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  sebayatSectionCategory: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
    marginTop: 2,
  },
  declaredCount: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  declaredLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
    marginBottom: 8,
  },
  declaredValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  declaredNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text,
  },
  declaredUnit: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  verifySection: {
    marginBottom: 20,
  },
  verifyLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 14,
  },
  reasonSection: {
    marginTop: 16,
  },
  reasonLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
    marginBottom: 8,
  },
  reasonInput: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 60,
    textAlignVertical: "top",
  },
  actions: {
    gap: 12,
  },
  verifyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.success,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    ...SHADOWS.small,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  flagButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: COLORS.warning,
    gap: 8,
  },
  flagButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.warning,
  },
  historyContent: {},
  historyDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  historyDateText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  historyFilterScroll: {
    marginBottom: 20,
  },
  historyFilterContainer: {
    flexDirection: "row",
    gap: 10,
  },
  historyFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  historyFilterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  historyFilterText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  historyFilterTextActive: {
    color: "#fff",
  },
  historyFilterCount: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  historyFilterCountActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  historyFilterCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
  },
  historyFilterCountTextActive: {
    color: "#fff",
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOWS.small,
  },
  historyItemLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  historyItemCodeContainer: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  historyItemCode: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 1,
  },
  historyItemInfo: {
    flex: 1,
  },
  historyItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  historyItemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  historyItemCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  historyItemRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  historyStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  historyItemTime: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  scannerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  scannerClose: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: COLORS.primary,
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  webCameraPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  webCameraText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 24,
  },
  webCameraButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  webCameraButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  pendingListContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pendingListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pendingListTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  pendingListClose: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  pendingListContent: {
    flex: 1,
    padding: 20,
  },
  pendingListItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  pendingListItemCode: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pendingListItemCodeText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 1,
  },
  pendingListItemInfo: {
    flex: 1,
  },
  pendingListItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  pendingListItemCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  flagModal: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  flagModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  flagModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  flagModalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  flagInput: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  flagModalActions: {
    flexDirection: "row",
    gap: 12,
  },
  flagCancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  flagCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  flagSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: COLORS.warning,
  },
  flagSubmitDisabled: {
    opacity: 0.5,
  },
  flagSubmitText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
