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
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  QrCode,
  Phone,
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
  Printer,
  Share2,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { useTranslation } from "react-i18next";
import { useLocalizedNumber } from "@/hooks/useLocalizedNumber";
import {
  searchSebayatByQR,
  getSebayatDailyQuota,
  getWestGatePendingAcknowledgments,
  acknowledgeWestGateEntry,
  getEntryByCode,
  isTicketExpired,
  getTicketTimeRemaining,
  getSebayatPendingTickets,
} from "@/services/entryService";
import { getActiveSession } from "@/services/slotSessionService";
import {
  resolveScannedTicket,
  recordWestGateEventResilient,
  searchSebayatResilient,
  getEffectiveQuota,
  registerWestGateEntryResilient,
  getGateLog,
} from "@/services/offlineEntryService";
import { loadSebayatListCache, type GateLogEntry, markIdempotencyKeyScanned, isIdempotencyKeyScanned, getScannedRecord, type ScannedRecord } from "@/lib/offline";
import {
  getPrintTokenEnabled,
  getPrintTokenIncludePhoto,
} from "@/services/settingsService";
import { printGateToken, shareGateTokenPDF, buildTokenHTML } from "@/services/printTokenService";
import { connectivity, cacheGateEntries, loadCachedGateEntries } from "@/lib/offline";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { GumastaInfoCard } from "@/components/tickets/GumastaInfoCard";
import { getGumastaById } from "@/services/gumastaService";

const CACHE_SCOPE_WEST_PENDING = "west_gate:pending";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type { SebayatRegistration, SebayatQuota, GateEntry, SlotSession, Gumasta } from "@/types/database";
import type { CreateEntryResult } from "@/types";

type ViewMode = "scan" | "pending";
type SearchMode = "qr" | "phone" | "code";

export default function WestGateScreen() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const ln = useLocalizedNumber();
  const [viewMode, setViewMode] = useState<ViewMode>("scan");
  const [searchMode, setSearchMode] = useState<SearchMode>("qr");
  const [searchValue, setSearchValue] = useState("");
  const [searching, setSearching] = useState(false);
  const [pendingTickets, setPendingTickets] = useState<GateEntry[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GateEntry | null>(null);
  const [selectedEntryQrPayload, setSelectedEntryQrPayload] = useState<Record<string, unknown> | null>(null);
  const [alreadyScannedRecord, setAlreadyScannedRecord] = useState<ScannedRecord | null>(null);
  const [selectedGumasta, setSelectedGumasta] = useState<Gumasta | null>(null);
  const [sebayat, setSebayat] = useState<SebayatRegistration | null>(null);
  const [quota, setQuota] = useState<SebayatQuota | null>(null);
  const [devoteeCount, setDevoteeCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateEntryResult | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [activeSession, setActiveSession] = useState<SlotSession | null>(null);
  const [sebayatPendingTickets, setSebayatPendingTickets] = useState<GateEntry[]>([]);
  const [printTokenEnabled, setPrintTokenEnabled] = useState(false);
  const [printTokenIncludePhoto, setPrintTokenIncludePhoto] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
  const [showTokenPreview, setShowTokenPreview] = useState(false);
  const [tokenPreviewHtml, setTokenPreviewHtml] = useState("");
  const [isOffline, setIsOffline] = useState(!connectivity.isOnline());
  const [gateActivityLog, setGateActivityLog] = useState<GateLogEntry[]>([]);
  const scannerRef = useRef<boolean>(false);

  useEffect(() => {
    const unsub = connectivity.subscribe(() => {
      const offline = !connectivity.isOnline();
      setIsOffline(offline);
      if (offline && (searchMode === "code" || searchMode === "phone")) {
        setSearchMode("qr");
        setSearchValue("");
        setError(null);
        setSebayat(null);
      }
    });
    return unsub;
  }, [searchMode]);

  useEffect(() => {
    if (selectedEntry?.gumasta_id) {
      getGumastaById(selectedEntry.gumasta_id).then(setSelectedGumasta).catch(() => setSelectedGumasta(null));
    } else {
      setSelectedGumasta(null);
    }
  }, [selectedEntry?.gumasta_id]);

  const loadPendingTickets = useCallback(async () => {
    setLoadingPending(true);
    // Paint cached data immediately while network fetches
    const cached = await loadCachedGateEntries(CACHE_SCOPE_WEST_PENDING);
    if (cached.length > 0) setPendingTickets(cached);

    if (connectivity.isOnline()) {
      const [tickets, session] = await Promise.all([
        getWestGatePendingAcknowledgments(),
        getActiveSession(),
      ]);
      setPendingTickets(tickets);
      setActiveSession(session);
      await cacheGateEntries(CACHE_SCOPE_WEST_PENDING, tickets);
    }
    setLoadingPending(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPendingTickets();
      getPrintTokenEnabled().then(setPrintTokenEnabled);
      getPrintTokenIncludePhoto().then(setPrintTokenIncludePhoto);
    }, [loadPendingTickets])
  );

  useEffect(() => {
    if (sebayat) {
      loadQuota();
    }
  }, [sebayat]);

  useEffect(() => {
    if (selectedEntry?.slot_id) {
      getActiveSession().then(setActiveSession);
    } else {
      setActiveSession(null);
    }
  }, [selectedEntry]);

  const loadQuota = async () => {
    if (!sebayat) return;
    const quotaData = connectivity.isOnline()
      ? await getSebayatDailyQuota(sebayat.id)
      : await getEffectiveQuota(sebayat.id);
    setQuota(quotaData);
    if (devoteeCount > quotaData.remainingCount && quotaData.remainingCount > 0) {
      setDevoteeCount(quotaData.remainingCount);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPendingTickets();
    setRefreshing(false);
  };

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      setError(t('supervisor.westGate.emptySearchValue'));
      return;
    }

    setSearching(true);
    setError(null);
    setSebayat(null);
    setSelectedEntry(null);
    setQuota(null);
    setSebayatPendingTickets([]);

    try {
      if (searchMode === "code") {
        const entry = await getEntryByCode(searchValue.trim().toUpperCase());
        if (entry) {
          if (entry.entry_mode === "marjana_mandap") {
            setError(t('supervisor.darshanTickets.entryModeWestGateNotAllowed'));
          } else if (entry.status !== "pending") {
            setError(t('supervisor.westGate.alreadyProcessed'));
          } else if (isTicketExpired(entry)) {
            setError(t('supervisor.westGate.ticketExpired'));
          } else {
            setSelectedEntry(entry);
            setShowAcknowledgeModal(true);
          }
        } else {
          setError(t('supervisor.westGate.noTicketFound'));
        }
      } else if (searchMode === "phone") {
        const found = await searchSebayatResilient(searchValue.trim(), "phone");
        if (found) {
          setSebayat(found);
          setDevoteeCount(1);
          if (connectivity.isOnline()) {
            const tickets = await getSebayatPendingTickets(found.id);
            setSebayatPendingTickets(tickets);
          } else {
            setSebayatPendingTickets([]);
          }
          const log = await getGateLog(found.id);
          setGateActivityLog(log);
        } else {
          setError(t('supervisor.westGate.noSebayatPhone'));
        }
      }
    } catch (err) {
      setError(t('supervisor.westGate.searchFailed'));
    } finally {
      setSearching(false);
    }
  };

  const handleQRScan = async (data: string) => {
    if (scannerRef.current) return;
    scannerRef.current = true;

    try {
      const resolved = await resolveScannedTicket(data);
      if (resolved && resolved.source === "server" && resolved.ticket) {
        const entry = resolved.ticket;
        if (entry.entry_mode === "marjana_mandap") {
          setError(t('supervisor.darshanTickets.entryModeWestGateNotAllowed'));
        } else if (entry.status !== "pending") {
          setError("This ticket has already been processed");
        } else if (isTicketExpired(entry)) {
          setError("This ticket has expired");
        } else {
          setSelectedEntry(entry);
          setShowAcknowledgeModal(true);
        }
        setShowScanner(false);
        return;
      }

      if (resolved && resolved.source === "offline_payload" && resolved.idempotencyKey && resolved.declaredCount !== null && resolved.sebayatId) {
        // Duplicate-scan guard: prevent the same offline ticket from being
        // accepted twice on this supervisor device in the same day.
        const scannedRecord = await getScannedRecord(resolved.idempotencyKey);
        if (scannedRecord) {
          setAlreadyScannedRecord(scannedRecord);
          setShowScanner(false);
          return;
        }

        // Resolve sebayat identity from local cache for display
        const cachedList = await loadSebayatListCache();
        const cachedSebayat = cachedList.find((s) => s.id === resolved.sebayatId);
        const sebayatJoin = cachedSebayat
          ? { full_name: cachedSebayat.full_name, phone_number: cachedSebayat.phone_number, photo_url: cachedSebayat.photo_url, category: cachedSebayat.category_name ? { name: cachedSebayat.category_name } : null }
          : null;

        let parsedQr: Record<string, unknown> = {};
        try { parsedQr = JSON.parse(data); } catch {}

        const synthesized: GateEntry = {
          id: resolved.idempotencyKey,
          entry_code: resolved.entryCode,
          qr_code_data: null,
          sebayat_id: resolved.sebayatId,
          slot_id: null,
          west_gate_supervisor_id: null,
          inner_gate_supervisor_id: null,
          declared_devotee_count: resolved.declaredCount,
          verified_devotee_count: null,
          status: "pending",
          entry_date: new Date().toISOString().split("T")[0],
          west_gate_entry_time: null,
          inner_gate_verification_time: null,
          notes: null,
          created_by_sebayat: true,
          expires_at: null,
          entry_mode: "west_gate",
          idempotency_key: resolved.idempotencyKey,
          offline_origin: true,
          sebayat: sebayatJoin,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setSelectedEntry(synthesized);
        setSelectedEntryQrPayload(parsedQr);
        setShowAcknowledgeModal(true);
        setShowScanner(false);
        return;
      }

      const found = await searchSebayatByQR(data);
      if (found) {
        setSebayat(found);
        setDevoteeCount(1);
        const tickets = await getSebayatPendingTickets(found.id);
        setSebayatPendingTickets(tickets);
        setShowScanner(false);
      } else {
        setError(t('supervisor.westGate.invalidQr'));
        setShowScanner(false);
      }
    } catch (err) {
      setError(t('supervisor.westGate.failedQr'));
      setShowScanner(false);
    } finally {
      scannerRef.current = false;
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError(t('supervisor.westGate.cameraPermission'));
        return;
      }
    }
    setShowScanner(true);
    scannerRef.current = false;
  };

  const handleAcknowledgeEntry = async (entry: GateEntry) => {
    if (!profile) return;
    if (entry.entry_mode === "marjana_mandap") {
      setError(t('supervisor.darshanTickets.entryModeWestGateNotAllowed'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const useOfflinePath =
        entry.offline_origin || !connectivity.isOnline() || !!entry.idempotency_key;

      if (useOfflinePath && entry.idempotency_key) {
        const r = await recordWestGateEventResilient({
          idempotencyKey: entry.idempotency_key,
          supervisorId: profile.id,
          actualCount: entry.declared_devotee_count,
          sebayatId: entry.sebayat_id,
          entryCode: entry.entry_code,
          offlineOrigin: !!entry.offline_origin,
          offlineQrPayload: entry.offline_origin ? (selectedEntryQrPayload ?? undefined) : undefined,
        });
        if (r.success) {
          if (entry.idempotency_key) {
            await markIdempotencyKeyScanned({
              idempotencyKey: entry.idempotency_key,
              gate: "west",
              count: entry.declared_devotee_count,
              entryCode: entry.entry_code,
              scannedAt: new Date().toISOString(),
            });
          }
          const synthEntry: GateEntry = {
            ...entry,
            status: "registered",
            west_gate_supervisor_id: profile.id,
            west_gate_entry_time: new Date().toISOString(),
            west_actual_count: entry.declared_devotee_count,
          };
          setResult({ success: true, message: r.message, entry: synthEntry });
          await loadPendingTickets();
          if (sebayat) {
            const remaining = await getSebayatPendingTickets(sebayat.id);
            setSebayatPendingTickets(remaining);
          }
        } else {
          setError(r.message);
        }
        return;
      }

      const result = await acknowledgeWestGateEntry(entry.id, profile.id);
      if (result.success) {
        setResult(result);
        await loadPendingTickets();
        if (sebayat) {
          const remaining = await getSebayatPendingTickets(sebayat.id);
          setSebayatPendingTickets(remaining);
        }
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(t('supervisor.westGate.failedAcknowledge'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!sebayat || !profile || !quota) return;

    if (devoteeCount <= 0) {
      setError(t('supervisor.westGate.devoteeMinOne'));
      return;
    }

    if (devoteeCount > quota.remainingCount) {
      setError(t('supervisor.westGate.onlySlotsRemaining', { count: quota.remainingCount }));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const entryResult = await registerWestGateEntryResilient(
        sebayat.id,
        devoteeCount,
        profile.id
      );
      setResult(entryResult);

      if (!entryResult.success) {
        setError(entryResult.message);
      }
    } catch (err) {
      setError(t('supervisor.westGate.failedRegister'));
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
    setSebayatPendingTickets([]);
    setGateActivityLog([]);
    setShowAcknowledgeModal(false);
    setShowTokenPreview(false);
  };

  const handleShowTokenPreview = async (entry: GateEntry) => {
    setPrinting(true);
    try {
      const html = await buildTokenHTML(entry, { includePhoto: printTokenIncludePhoto });
      setTokenPreviewHtml(html);
      setShowTokenPreview(true);
    } finally {
      setPrinting(false);
    }
  };

  const handlePrint = async (entry: GateEntry) => {
    setPrinting(true);
    await printGateToken(entry, { includePhoto: printTokenIncludePhoto });
    setPrinting(false);
  };

  const handleShare = async (entry: GateEntry) => {
    setPrinting(true);
    await shareGateTokenPDF(entry, { includePhoto: printTokenIncludePhoto });
    setPrinting(false);
  };

  const adjustCount = (delta: number) => {
    const newCount = devoteeCount + delta;
    if (newCount >= 1 && quota && newCount <= quota.remainingCount) {
      setDevoteeCount(newCount);
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

  const SearchModeButton = ({
    mode,
    icon,
    label,
    disabled,
  }: {
    mode: SearchMode;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      style={[
        styles.modeButton,
        searchMode === mode && styles.modeButtonActive,
        disabled && styles.modeButtonDisabled,
      ]}
      onPress={() => {
        if (disabled) return;
        setSearchMode(mode);
        setSearchValue("");
        setError(null);
        setSebayat(null);
        setSelectedEntry(null);
        setSebayatPendingTickets([]);
      }}
      activeOpacity={disabled ? 1 : 0.7}
    >
      {icon}
      <Text
        style={[
          styles.modeButtonText,
          searchMode === mode && styles.modeButtonTextActive,
          disabled && styles.modeButtonTextDisabled,
        ]}
      >
        {label}
      </Text>
      {disabled && (
        <Text style={styles.modeButtonDisabledHint}>{t('supervisor.westGate.requiresInternet')}</Text>
      )}
    </TouchableOpacity>
  );


  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t('supervisor.westGate.title')}</Text>
            <Text style={styles.subtitle}>{t('supervisor.westGate.subtitle')}</Text>
          </View>

          <OfflineBanner />

          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === "scan" && styles.toggleButtonActive]}
              onPress={() => setViewMode("scan")}
            >
              <QrCode size={18} color={viewMode === "scan" ? "#fff" : COLORS.textSecondary} />
              <Text style={[styles.toggleText, viewMode === "scan" && styles.toggleTextActive]}>
                {t('supervisor.westGate.scanSearch')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === "pending" && styles.toggleButtonActive]}
              onPress={() => setViewMode("pending")}
            >
              <List size={18} color={viewMode === "pending" ? "#fff" : COLORS.textSecondary} />
              <Text style={[styles.toggleText, viewMode === "pending" && styles.toggleTextActive]}>
                {t('supervisor.westGate.pendingTab', { count: pendingTickets.length })}
              </Text>
            </TouchableOpacity>
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

          {viewMode === "pending" ? (
            <View style={styles.pendingSection}>
              {loadingPending ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>{t('supervisor.westGate.loadingPending')}</Text>
                </View>
              ) : pendingTickets.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ticket size={48} color={COLORS.textMuted} />
                  <Text style={styles.emptyTitle}>{t('supervisor.westGate.noPendingTickets')}</Text>
                  <Text style={styles.emptySubtitle}>
                    {t('supervisor.westGate.noPendingSubtitle')}
                  </Text>
                </View>
              ) : (
                pendingTickets.map((ticket) => {
                  const expired = isTicketExpired(ticket);
                  const sebayatData = ticket.sebayat as any;
                  const hasSlot = !!ticket.slot_id;
                  const slotIsActive = hasSlot && activeSession?.slot_id === ticket.slot_id;
                  const slotBlocked = hasSlot && !slotIsActive;
                  const isDisabled = expired || slotBlocked;
                  return (
                    <TouchableOpacity
                      key={ticket.id}
                      style={[
                        styles.pendingCard,
                        expired && styles.pendingCardExpired,
                        slotBlocked && !expired && styles.pendingCardBlocked,
                      ]}
                      onPress={() => {
                        if (!expired) {
                          setSelectedEntry(ticket);
                          setShowAcknowledgeModal(true);
                        }
                      }}
                      activeOpacity={0.7}
                      disabled={isDisabled}
                    >
                      <View style={styles.pendingLeft}>
                        {sebayatData?.photo_url ? (
                          <Image
                            source={{ uri: sebayatData.photo_url }}
                            style={styles.pendingPhoto}
                          />
                        ) : (
                          <View style={styles.pendingPhotoPlaceholder}>
                            <User size={24} color={COLORS.textMuted} />
                          </View>
                        )}
                        <View style={styles.pendingInfo}>
                          <Text style={styles.pendingName}>{sebayatData?.full_name}</Text>
                          <Text style={[styles.pendingCategory, slotBlocked && styles.pendingCategoryBlocked]}>
                            {(ticket.slot as any)?.name || sebayatData?.category?.name || "No Nijog"}
                          </Text>
                          <View style={styles.pendingMeta}>
                            <Users size={12} color={COLORS.textSecondary} />
                            <Text style={styles.pendingMetaText}>
                              {ln(ticket.declared_devotee_count)} {ticket.declared_devotee_count > 1 ? t("app.home.devotees") : t("app.home.devotee")}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.pendingRight}>
                        <Text style={styles.pendingCode}>{ticket.entry_code}</Text>
                        {ticket.entry_mode === "marjana_mandap" && (
                          <View style={styles.marjanaMandapBadge}>
                            <Text style={styles.marjanaMandapBadgeText}>{t('supervisor.darshanTickets.entryModeMarjanaMandap')}</Text>
                          </View>
                        )}
                        {slotBlocked ? (
                          <View style={styles.slotNotActiveBadge}>
                            <Text style={styles.slotNotActiveBadgeText}>{t('supervisor.westGate.slotNotActive')}</Text>
                          </View>
                        ) : (
                          <View style={[styles.pendingTimeRow, expired && styles.pendingTimeExpired]}>
                            <Clock size={12} color={expired ? COLORS.error : COLORS.warning} />
                            <Text style={[styles.pendingTime, expired && { color: COLORS.error }]}>
                              {formatTimeRemaining(ticket)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          ) : (
            <>
              <View style={styles.modeSelector}>
                <SearchModeButton
                  mode="code"
                  icon={
                    <Ticket
                      size={18}
                      color={isOffline ? COLORS.textMuted : searchMode === "code" ? "#fff" : COLORS.textSecondary}
                    />
                  }
                  label={t('supervisor.westGate.code')}
                  disabled={isOffline}
                />
                <SearchModeButton
                  mode="qr"
                  icon={
                    <QrCode
                      size={18}
                      color={searchMode === "qr" ? "#fff" : COLORS.textSecondary}
                    />
                  }
                  label={t('supervisor.westGate.qr')}
                />
                <SearchModeButton
                  mode="phone"
                  icon={
                    <Phone
                      size={18}
                      color={isOffline ? COLORS.textMuted : searchMode === "phone" ? "#fff" : COLORS.textSecondary}
                    />
                  }
                  label={t('supervisor.westGate.phone')}
                  disabled={isOffline}
                />
              </View>

              {searchMode === "qr" ? (
                <TouchableOpacity
                  style={styles.scanButton}
                  onPress={openScanner}
                  activeOpacity={0.8}
                >
                  <Camera size={32} color={COLORS.primary} />
                  <Text style={styles.scanButtonText}>{t('supervisor.westGate.tapToScanQr')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.searchCard}>
                  <View style={styles.searchInputContainer}>
                    <View style={styles.searchIcon}>
                      {searchMode === "code" ? (
                        <Ticket size={20} color={COLORS.primary} />
                      ) : (
                        <Phone size={20} color={COLORS.primary} />
                      )}
                    </View>
                    {searchMode === "phone" && (
                      <Text style={styles.phonePrefix}>+91</Text>
                    )}
                    <TextInput
                      style={styles.searchInput}
                      value={searchValue}
                      onChangeText={(v) => setSearchValue(searchMode === "code" ? v.toUpperCase() : v)}
                      placeholder={
                        searchMode === "code"
                          ? t('supervisor.westGate.enterCode')
                          : t('supervisor.westGate.enterPhone')
                      }
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType={searchMode === "phone" ? "phone-pad" : "default"}
                      maxLength={searchMode === "phone" ? 10 : 6}
                      autoCapitalize="characters"
                    />
                    {searchValue.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setSearchValue("")}
                        style={styles.clearButton}
                      >
                        <X size={18} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.searchButton, searching && styles.searchButtonDisabled]}
                    onPress={handleSearch}
                    disabled={searching}
                    activeOpacity={0.8}
                  >
                    <Search size={20} color="#fff" />
                    <Text style={styles.searchButtonText}>
                      {searching ? t('common.searching') : t('common.search')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {false && (() => {
            return (
              <View style={styles.acknowledgeCard}>
                <View style={styles.acknowledgeHeader}>
                  <View style={styles.acknowledgeIcon}>
                    <Ticket size={24} color={COLORS.primary} />
                  </View>
                  <View style={styles.acknowledgeHeaderInfo}>
                    <Text style={styles.acknowledgeTitle}>{t('supervisor.westGate.acknowledgeTicket')}</Text>
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
                    {slotName ? (
                      <Text style={styles.acknowledgeSebayatCategory}>{slotName}</Text>
                    ) : (
                      <Text style={styles.acknowledgeSebayatCategory}>
                        {(selectedEntry.sebayat as any)?.category?.name || "No Nijog"}
                      </Text>
                    )}
                    {(selectedEntry.sebayat as any)?.temple_health_card_id && (
                      <Text style={styles.acknowledgeSebayatHC}>
                        HC: {(selectedEntry.sebayat as any).temple_health_card_id}
                      </Text>
                    )}
                  </View>
                </View>
                {selectedGumasta && <GumastaInfoCard gumasta={selectedGumasta} />}

                <View style={styles.acknowledgeDetails}>
                  <View style={styles.acknowledgeDetailItem}>
                    <Users size={20} color={COLORS.primary} />
                    <Text style={styles.acknowledgeDetailValue}>
                      {ln(selectedEntry.declared_devotee_count)}
                    </Text>
                    <Text style={styles.acknowledgeDetailLabel}>{t('supervisor.westGate.devotees')}</Text>
                  </View>
                  <View style={styles.acknowledgeDetailDivider} />
                  <View style={styles.acknowledgeDetailItem}>
                    <Clock size={20} color={COLORS.warning} />
                    <Text style={styles.acknowledgeDetailValue}>
                      {formatTimeRemaining(selectedEntry)}
                    </Text>
                    <Text style={styles.acknowledgeDetailLabel}>Remaining</Text>
                  </View>
                </View>

                {selectedEntry.offline_origin && (
                  <View style={styles.offlineIssuedBanner}>
                    <AlertCircle size={16} color={COLORS.warning} />
                    <Text style={styles.offlineIssuedText}>
                      Offline-issued ticket. Will sync when reconnected.
                    </Text>
                  </View>
                )}

                {isMarjanaMandap && (
                  <View style={styles.marjanaMandapBlockBanner}>
                    <AlertCircle size={16} color="#0891b2" />
                    <Text style={styles.marjanaMandapBlockText}>{t('supervisor.darshanTickets.entryModeWestGateNotAllowed')}</Text>
                  </View>
                )}

                {slotBlockMessage && (
                  <View style={styles.slotBlockBanner}>
                    <AlertCircle size={16} color={COLORS.error} />
                    <Text style={styles.slotBlockText}>{slotBlockMessage}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.acknowledgeButton,
                    (!canAcknowledge || submitting) && styles.acknowledgeButtonDisabled,
                  ]}
                  onPress={() => canAcknowledge && handleAcknowledgeEntry(selectedEntry)}
                  disabled={!canAcknowledge || submitting}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Check size={20} color="#fff" />
                      <Text style={styles.acknowledgeButtonText}>
                        {isMarjanaMandap ? t('supervisor.darshanTickets.entryModeMarjanaMandap') : canAcknowledge ? t('supervisor.westGate.acknowledgeEntry') : t('supervisor.westGate.slotNotActive')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })()}

          {sebayat && sebayatPendingTickets.length > 0 && !selectedEntry && (
            <View style={styles.sebayatTicketsSection}>
              <Text style={styles.sebayatTicketsSectionTitle}>
                {t('supervisor.westGate.pendingTickets', { count: sebayatPendingTickets.length })}
              </Text>
              {sebayatPendingTickets.map((ticket) => {
                const isMarjana = ticket.entry_mode === "marjana_mandap";
                const expired = isTicketExpired(ticket);
                const hasSlot = !!ticket.slot_id;
                const slotIsActive = hasSlot && activeSession?.slot_id === ticket.slot_id;
                const slotBlocked = hasSlot && !slotIsActive;
                const isDisabled = expired || slotBlocked || isMarjana;
                return (
                  <TouchableOpacity
                    key={ticket.id}
                    style={[
                      styles.pendingCard,
                      expired && styles.pendingCardExpired,
                      slotBlocked && !expired && styles.pendingCardBlocked,
                      isMarjana && styles.pendingCardMarjana,
                    ]}
                    onPress={() => {
                      if (!isDisabled) {
                        setSelectedEntry(ticket);
                        setShowAcknowledgeModal(true);
                      }
                    }}
                    activeOpacity={0.7}
                    disabled={isDisabled}
                  >
                    <View style={styles.pendingLeft}>
                      <View style={styles.pendingInfo}>
                        <Text style={styles.pendingCode}>{ticket.entry_code}</Text>
                        <Text style={[styles.pendingCategory, slotBlocked && styles.pendingCategoryBlocked]}>
                          {(ticket.slot as any)?.name || "No Slot"}
                        </Text>
                        <View style={styles.pendingMeta}>
                          <Users size={12} color={COLORS.textSecondary} />
                          <Text style={styles.pendingMetaText}>
                            {ln(ticket.declared_devotee_count)} {ticket.declared_devotee_count > 1 ? t("app.home.devotees") : t("app.home.devotee")}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.pendingRight}>
                      {isMarjana ? (
                        <View style={styles.marjanaMandapBadge}>
                          <Text style={styles.marjanaMandapBadgeText}>Inner Gate</Text>
                        </View>
                      ) : slotBlocked ? (
                        <View style={styles.slotNotActiveBadge}>
                          <Text style={styles.slotNotActiveBadgeText}>{t('supervisor.westGate.slotNotActive')}</Text>
                        </View>
                      ) : (
                        <View style={[styles.pendingTimeRow, expired && styles.pendingTimeExpired]}>
                          <Clock size={12} color={expired ? COLORS.error : COLORS.warning} />
                          <Text style={[styles.pendingTime, expired && { color: COLORS.error }]}>
                            {formatTimeRemaining(ticket)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {sebayat && quota && !selectedEntry && sebayatPendingTickets.length === 0 && (
            <View style={styles.sebayatCard}>
              <View style={styles.sebayatHeader}>
                {sebayat.photo_url ? (
                  <Image
                    source={{ uri: sebayat.photo_url }}
                    style={styles.sebayatPhoto}
                  />
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
                  {sebayat.temple_health_card_id && (
                    <Text style={styles.sebayatHealthCard}>
                      HC: {sebayat.temple_health_card_id}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.changeSebayatButton}
                  onPress={resetForm}
                >
                  <X size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.quotaBar}>
                <View style={styles.quotaInfo}>
                  <Text style={styles.quotaLabel}>{t('supervisor.westGate.todayQuota')}</Text>
                  <Text style={styles.quotaValue}>
                    {t('supervisor.westGate.quotaUsed', { used: quota.usedCount, max: quota.maxLimit })}
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
                  {t('supervisor.westGate.quotaRemaining', { count: quota.remainingCount })}
                </Text>
                {isOffline && (
                  <Text style={styles.quotaOfflineNote}>{t('supervisor.westGate.offlineEstimate')}</Text>
                )}
              </View>

              {isOffline && gateActivityLog.length > 0 && (
                <View style={styles.gateLogSection}>
                  <Text style={styles.gateLogTitle}>{t('supervisor.westGate.todayActivity')}</Text>
                  {gateActivityLog.map((log, idx) => (
                    <View key={idx} style={styles.gateLogItem}>
                      <Text style={styles.gateLogTime}>
                        {new Date(log.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                      <Text style={styles.gateLogGate}>
                        {log.gate === "west" ? t('supervisor.westGate.title') : t('supervisor.innerGate.title')}
                      </Text>
                      <Text style={styles.gateLogCount}>
                        {log.count} {log.count > 1 ? t('app.home.devotees') : t('app.home.devotee')}
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.gateLogTotal}>
                    {t('supervisor.westGate.gateLogTotal', { total: gateActivityLog.reduce((s, l) => s + l.count, 0) })}
                  </Text>
                </View>
              )}

              {quota.remainingCount > 0 ? (
                <>
                  <View style={styles.countSection}>
                    <Text style={styles.countLabel}>{t('supervisor.westGate.devoteeCount')}</Text>
                    <View style={styles.countControl}>
                      <TouchableOpacity
                        style={[
                          styles.countButton,
                          devoteeCount <= 1 && styles.countButtonDisabled,
                        ]}
                        onPress={() => adjustCount(-1)}
                        disabled={devoteeCount <= 1}
                        activeOpacity={0.7}
                      >
                        <Minus
                          size={24}
                          color={devoteeCount <= 1 ? COLORS.textMuted : COLORS.text}
                        />
                      </TouchableOpacity>
                      <View style={styles.countDisplay}>
                        <Users size={20} color={COLORS.primary} />
                        <Text style={styles.countValue}>{ln(devoteeCount)}</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.countButton,
                          devoteeCount >= quota.remainingCount &&
                            styles.countButtonDisabled,
                        ]}
                        onPress={() => adjustCount(1)}
                        disabled={devoteeCount >= quota.remainingCount}
                        activeOpacity={0.7}
                      >
                        <Plus
                          size={24}
                          color={
                            devoteeCount >= quota.remainingCount
                              ? COLORS.textMuted
                              : COLORS.text
                          }
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      submitting && styles.submitButtonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={submitting}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.submitButtonText}>
                      {submitting ? t('supervisor.westGate.registering') : t('supervisor.westGate.registerEntry')}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.quotaExhausted}>
                  <AlertCircle size={24} color={COLORS.error} />
                  <Text style={styles.quotaExhaustedText}>
                    {t('supervisor.westGate.quotaExhausted')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showScanner} animationType="slide">
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>{t('supervisor.westGate.scanQrCode')}</Text>
            <TouchableOpacity
              style={styles.scannerClose}
              onPress={() => setShowScanner(false)}
            >
              <X size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          {Platform.OS !== "web" ? (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
              onBarcodeScanned={(result) => {
                if (result.data) {
                  handleQRScan(result.data);
                }
              }}
            >
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerFrame} />
              </View>
            </CameraView>
          ) : (
            <View style={styles.webCameraPlaceholder}>
              <QrCode size={64} color={COLORS.textMuted} />
              <Text style={styles.webCameraText}>
                {t('supervisor.westGate.qrNotSupported')}
              </Text>
              <TouchableOpacity
                style={styles.webCameraButton}
                onPress={() => setShowScanner(false)}
              >
                <Text style={styles.webCameraButtonText}>{t('supervisor.westGate.useManualSearch')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Acknowledge Entry Modal */}
      <Modal
        visible={showAcknowledgeModal && !!selectedEntry}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowAcknowledgeModal(false); setSelectedEntry(null); }}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => { setShowAcknowledgeModal(false); setSelectedEntry(null); }}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {selectedEntry && (() => {
              const slotName = (selectedEntry.slot as any)?.name as string | undefined;
              const hasSlot = !!selectedEntry.slot_id;
              const slotIsActive = hasSlot && activeSession?.slot_id === selectedEntry.slot_id;
              const isMarjanaMandap = selectedEntry.entry_mode === "marjana_mandap";
              const canAcknowledge = !isMarjanaMandap && (!hasSlot || slotIsActive);
              let slotBlockMessage: string | null = null;
              if (hasSlot && !slotIsActive) {
                slotBlockMessage = activeSession
                  ? `This ticket is for "${slotName}" but "${(activeSession.slot as any)?.name}" is currently active.`
                  : `This ticket requires the "${slotName}" slot to be active.`;
              }
              return (
                <>
                  <View style={styles.acknowledgeHeader}>
                    <View style={styles.acknowledgeIcon}>
                      <Ticket size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.acknowledgeHeaderInfo}>
                      <Text style={styles.acknowledgeTitle}>{t('supervisor.westGate.acknowledgeTicket')}</Text>
                      <Text style={styles.acknowledgeCode}>{selectedEntry.entry_code}</Text>
                    </View>
                    <TouchableOpacity style={styles.closeButton} onPress={() => { setShowAcknowledgeModal(false); setSelectedEntry(null); }}>
                      <X size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.acknowledgeSebayat}>
                    {(selectedEntry.sebayat as any)?.photo_url ? (
                      <Image source={{ uri: (selectedEntry.sebayat as any).photo_url }} style={styles.acknowledgeSebayatPhoto} />
                    ) : (
                      <View style={styles.acknowledgeSebayatPhotoPlaceholder}>
                        <User size={32} color={COLORS.textMuted} />
                      </View>
                    )}
                    <View style={styles.acknowledgeSebayatInfo}>
                      <Text style={styles.acknowledgeSebayatName}>{(selectedEntry.sebayat as any)?.full_name}</Text>
                      <Text style={styles.acknowledgeSebayatCategory}>
                        {slotName || (selectedEntry.sebayat as any)?.category?.name || "No Nijog"}
                      </Text>
                      {(selectedEntry.sebayat as any)?.temple_health_card_id && (
                        <Text style={styles.acknowledgeSebayatHC}>HC: {(selectedEntry.sebayat as any).temple_health_card_id}</Text>
                      )}
                    </View>
                  </View>
                  {selectedGumasta && <GumastaInfoCard gumasta={selectedGumasta} />}
                  <View style={styles.acknowledgeDetails}>
                    <View style={styles.acknowledgeDetailItem}>
                      <Users size={20} color={COLORS.primary} />
                      <Text style={styles.acknowledgeDetailValue}>{ln(selectedEntry.declared_devotee_count)}</Text>
                      <Text style={styles.acknowledgeDetailLabel}>{t('supervisor.westGate.devotees')}</Text>
                    </View>
                    <View style={styles.acknowledgeDetailDivider} />
                    <View style={styles.acknowledgeDetailItem}>
                      <Clock size={20} color={COLORS.warning} />
                      <Text style={styles.acknowledgeDetailValue}>{formatTimeRemaining(selectedEntry)}</Text>
                      <Text style={styles.acknowledgeDetailLabel}>Remaining</Text>
                    </View>
                  </View>
                  {selectedEntry.offline_origin && (
                    <View style={styles.offlineIssuedBanner}>
                      <AlertCircle size={16} color={COLORS.warning} />
                      <Text style={styles.offlineIssuedText}>Offline-issued ticket. Will sync when reconnected.</Text>
                    </View>
                  )}
                  {isMarjanaMandap && (
                    <View style={styles.marjanaMandapBlockBanner}>
                      <AlertCircle size={16} color="#0891b2" />
                      <Text style={styles.marjanaMandapBlockText}>{t('supervisor.darshanTickets.entryModeWestGateNotAllowed')}</Text>
                    </View>
                  )}
                  {slotBlockMessage && (
                    <View style={styles.slotBlockBanner}>
                      <AlertCircle size={16} color={COLORS.error} />
                      <Text style={styles.slotBlockText}>{slotBlockMessage}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.acknowledgeButton, (!canAcknowledge || submitting) && styles.acknowledgeButtonDisabled]}
                    onPress={() => canAcknowledge && handleAcknowledgeEntry(selectedEntry)}
                    disabled={!canAcknowledge || submitting}
                    activeOpacity={0.8}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Check size={20} color="#fff" />
                        <Text style={styles.acknowledgeButtonText}>
                          {isMarjanaMandap ? t('supervisor.darshanTickets.entryModeMarjanaMandap') : canAcknowledge ? t('supervisor.westGate.acknowledgeEntry') : t('supervisor.westGate.slotNotActive')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Success / Result Modal */}
      <Modal
        visible={!!(result?.success && result.entry)}
        transparent
        animationType="fade"
        onRequestClose={resetForm}
      >
        <Pressable style={styles.modalBackdrop} onPress={resetForm}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {result?.entry && (
              <>
                <View style={styles.successModalHeader}>
                  <View style={styles.successIcon}>
                    <Check size={28} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.successTitle}>{t('supervisor.westGate.entryAcknowledged')}</Text>
                    <Text style={styles.successSubtitle}>{t('supervisor.westGate.darshanProceed')}</Text>
                  </View>
                  <TouchableOpacity style={styles.closeButton} onPress={resetForm}>
                    <X size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.codeContainer}>
                  <Text style={styles.codeLabel}>{t('supervisor.westGate.entryCode')}</Text>
                  <Text style={styles.codeValue}>{result.entry.entry_code}</Text>
                </View>
                <View style={styles.entryDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('supervisor.westGate.darshan')}</Text>
                    <Text style={styles.detailValue}>{(result.entry.sebayat as any)?.full_name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('supervisor.westGate.devotees')}</Text>
                    <Text style={styles.detailValue}>{ln(result.entry.declared_devotee_count)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('supervisor.westGate.time')}</Text>
                    <Text style={styles.detailValue}>
                      {result.entry.west_gate_entry_time
                        ? new Date(result.entry.west_gate_entry_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                        : "-"}
                    </Text>
                  </View>
                </View>
                {printTokenEnabled && (
                  <View style={styles.printButtonsRow}>
                    <TouchableOpacity
                      style={[styles.printButton, printing && styles.printButtonDisabled]}
                      onPress={() => handleShowTokenPreview(result.entry!)}
                      disabled={printing}
                      activeOpacity={0.8}
                    >
                      <Printer size={18} color={COLORS.primary} />
                      <Text style={styles.printButtonText}>Print Token</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.shareButton, printing && styles.printButtonDisabled]}
                      onPress={() => handleShare(result.entry!)}
                      disabled={printing}
                      activeOpacity={0.8}
                    >
                      <Share2 size={18} color={COLORS.textSecondary} />
                      <Text style={styles.shareButtonText}>Share PDF</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity style={styles.newEntryButton} onPress={resetForm} activeOpacity={0.8}>
                  <Text style={styles.newEntryButtonText}>{t('supervisor.westGate.processNext')}</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Print Token Preview Modal */}
      <Modal
        visible={showTokenPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTokenPreview(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTokenPreview(false)}>
          <Pressable style={[styles.modalCard, styles.modalCardTall]} onPress={() => {}}>
            <View style={styles.tokenPreviewHeader}>
              <Text style={styles.tokenPreviewTitle}>Token Preview</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowTokenPreview(false)}>
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              {Platform.OS === "web" ? (
                // @ts-ignore
                <iframe
                  srcDoc={tokenPreviewHtml}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  title="Token Preview"
                />
              ) : (
                <View style={styles.tokenPreviewNative}>
                  <Text style={styles.tokenPreviewNativeText}>Token ready. Use the buttons below to print or share.</Text>
                </View>
              )}
            </View>
            <View style={styles.tokenPreviewActions}>
              {result?.entry && (
                <>
                  <TouchableOpacity
                    style={[styles.printButton, { flex: 1 }, printing && styles.printButtonDisabled]}
                    onPress={() => result.entry && handlePrint(result.entry)}
                    disabled={printing}
                    activeOpacity={0.8}
                  >
                    <Printer size={18} color={COLORS.primary} />
                    <Text style={styles.printButtonText}>Print</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.shareButton, { flex: 1 }, printing && styles.printButtonDisabled]}
                    onPress={() => result.entry && handleShare(result.entry)}
                    disabled={printing}
                    activeOpacity={0.8}
                  >
                    <Share2 size={18} color={COLORS.textSecondary} />
                    <Text style={styles.shareButtonText}>Share PDF</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Already-Scanned Alert Modal */}
      <Modal
        visible={!!alreadyScannedRecord}
        transparent
        animationType="fade"
        onRequestClose={() => setAlreadyScannedRecord(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAlreadyScannedRecord(null)}>
          <Pressable style={styles.alreadyScannedCard} onPress={() => {}}>
            <View style={styles.alreadyScannedIconRow}>
              <View style={styles.alreadyScannedIconBg}>
                <AlertCircle size={28} color={COLORS.warning} />
              </View>
            </View>
            <Text style={styles.alreadyScannedTitle}>
              {t('supervisor.westGate.alreadyScannedTitle')}
            </Text>
            <Text style={styles.alreadyScannedBody}>
              {t('supervisor.westGate.alreadyScannedBody')}
            </Text>
            {alreadyScannedRecord && (
              <View style={styles.alreadyScannedDetails}>
                <Text style={styles.alreadyScannedDetailText}>
                  {t('supervisor.westGate.alreadyScannedDetails', {
                    code: alreadyScannedRecord.entryCode,
                    count: alreadyScannedRecord.count,
                    time: new Date(alreadyScannedRecord.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  })}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.alreadyScannedCloseBtn}
              onPress={() => setAlreadyScannedRecord(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.alreadyScannedCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerWrapper: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 100,
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
    marginTop: 6,
  },
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
  modeButtonDisabled: {
    opacity: 0.5,
    backgroundColor: COLORS.surfaceSecondary,
  },
  modeButtonTextDisabled: {
    color: COLORS.textMuted,
  },
  modeButtonDisabledHint: {
    fontSize: 8,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 16,
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
  pendingSection: {
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
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
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: "center",
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
  pendingCardBlocked: {
    opacity: 0.6,
    borderColor: COLORS.textMuted,
  },
  pendingCardMarjana: {
    opacity: 0.7,
    borderColor: "#0891b230",
    backgroundColor: "#0891b208",
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
  pendingCategory: {
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 1,
  },
  pendingCategoryBlocked: {
    color: COLORS.textMuted,
  },
  marjanaMandapBadge: {
    marginTop: 4,
    backgroundColor: "#0891b215",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#0891b230",
  },
  marjanaMandapBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0891b2",
  },
  slotNotActiveBadge: {
    marginTop: 4,
    backgroundColor: COLORS.textMuted + "20",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotNotActiveBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.textMuted,
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
  searchIcon: {
    marginRight: 12,
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
  clearButton: {
    padding: 4,
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
  acknowledgeSebayatHC: {
    fontSize: 13,
    color: COLORS.textSecondary,
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
  offlineIssuedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.xs,
    backgroundColor: COLORS.warning + "15",
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.warning + "30",
  },
  offlineIssuedText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.warning,
    lineHeight: 18,
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
  slotBlockBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.xs,
    backgroundColor: COLORS.error + "15",
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.error + "30",
  },
  slotBlockText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.error,
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
    opacity: 0.5,
    backgroundColor: COLORS.textMuted,
  },
  acknowledgeButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  sebayatTicketsSection: {
    marginBottom: 16,
  },
  sebayatTicketsSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  sebayatHealthCard: {
    fontSize: 13,
    color: COLORS.textSecondary,
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
  successContent: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.success,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 2,
  },
  successSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 0,
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
  printButtonsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    width: "100%",
    marginBottom: SPACING.md,
  },
  printButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  shareButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  printButtonDisabled: {
    opacity: 0.5,
  },
  printButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.lg,
    width: "100%",
    maxWidth: 480,
    gap: 16,
    ...SHADOWS.large,
  },
  modalCardTall: {
    height: "80%",
    padding: 0,
    overflow: "hidden",
  },
  successModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 4,
  },
  tokenPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tokenPreviewTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  tokenPreviewWebWrap: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  tokenPreviewNative: {
    padding: SPACING.xl,
    alignItems: "center",
  },
  tokenPreviewNativeText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  tokenPreviewActions: {
    flexDirection: "row",
    gap: 12,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
  quotaOfflineNote: {
    fontSize: 11,
    color: "#92400E",
    fontStyle: "italic",
    marginTop: 4,
  },
  gateLogSection: {
    backgroundColor: "#F0F9FF",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  gateLogTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },
  gateLogItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  gateLogTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "500",
    width: 55,
  },
  gateLogGate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
  },
  gateLogCount: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
  },
  gateLogTotal: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#BAE6FD",
  },
  alreadyScannedCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginHorizontal: SPACING.xl,
    alignItems: "center",
    ...SHADOWS.lg,
  },
  alreadyScannedIconRow: {
    marginBottom: SPACING.md,
  },
  alreadyScannedIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.warning + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  alreadyScannedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  alreadyScannedBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  alreadyScannedDetails: {
    backgroundColor: COLORS.warning + "12",
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    width: "100%",
    alignItems: "center",
  },
  alreadyScannedDetailText: {
    fontSize: 13,
    color: COLORS.warning,
    fontWeight: "600",
    textAlign: "center",
  },
  alreadyScannedCloseBtn: {
    backgroundColor: COLORS.warning,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: SPACING.xl,
    minWidth: 120,
    alignItems: "center",
  },
  alreadyScannedCloseBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
