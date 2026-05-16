import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  Modal,
  Pressable,
  RefreshControl,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  QrCode,
  Ticket,
  Phone,
  List,
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
  Flag,
  ChevronRight,
  Printer,
  Share2,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { useTranslation } from "react-i18next";
import {
  getEntryByCode,
  verifyInnerGateEntry,
  getPendingVerifications,
  getSebayatDailyQuota,
  getSebayatPendingTickets,
} from "@/services/entryService";
import {
  resolveScannedTicket,
  recordInnerGateEventResilient,
  flagEntryDiscrepancyResilient,
  searchSebayatResilient,
  getEffectiveQuota,
} from "@/services/offlineEntryService";
import { connectivity, cacheGateEntries, loadCachedGateEntries, loadSebayatListCache, markIdempotencyKeyScanned, isIdempotencyKeyScanned, getScannedRecord, type ScannedRecord } from "@/lib/offline";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { GumastaInfoCard } from "@/components/tickets/GumastaInfoCard";
import { getGumastaById } from "@/services/gumastaService";

const CACHE_SCOPE_INNER_PENDING = "inner_gate:pending";
import {
  getPrintTokenEnabled,
  getPrintTokenIncludePhoto,
} from "@/services/settingsService";
import { printGateToken, shareGateTokenPDF } from "@/services/printTokenService";
import { COLORS, SHADOWS, SPACING, RADIUS } from "@/constants/config";
import type { GateEntry, Gumasta } from "@/types/database";
import type { VerifyEntryResult } from "@/types";

export default function InnerGateScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [entryCode, setEntryCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [entry, setEntry] = useState<GateEntry | null>(null);
  const [entryGumasta, setEntryGumasta] = useState<Gumasta | null>(null);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyEntryResult | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const scannerRef = useRef<boolean>(false);
  const [pendingList, setPendingList] = useState<GateEntry[]>([]);
  const [maxVerifiedCount, setMaxVerifiedCount] = useState<number>(999);
  const [offlineMode, setOfflineMode] = useState(false);
  const [offlineEntry, setOfflineEntry] = useState<{ idempotencyKey: string; entryCode: string; declaredCount: number; sebayatId: string; qrPayload: Record<string, unknown> } | null>(null);
  const [printTokenEnabled, setPrintTokenEnabled] = useState(false);
  const [printTokenIncludePhoto, setPrintTokenIncludePhoto] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [searchMode, setSearchMode] = useState<"qr" | "code" | "phone">("qr");
  const [viewMode, setViewMode] = useState<"scan" | "pending">("scan");
  const [loadingPending, setLoadingPending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");
  const [isOffline, setIsOffline] = useState(!connectivity.isOnline());
  const [alreadyScannedRecord, setAlreadyScannedRecord] = useState<ScannedRecord | null>(null);

  useEffect(() => {
    const unsub = connectivity.subscribe(() => {
      const offline = !connectivity.isOnline();
      setIsOffline(offline);
      if (offline && (searchMode === "code" || searchMode === "phone")) {
        setSearchMode("qr");
        setEntryCode("");
        setPhoneValue("");
        setError(null);
      }
    });
    return unsub;
  }, [searchMode]);

  useEffect(() => {
    if (entry?.gumasta_id) {
      getGumastaById(entry.gumasta_id).then(setEntryGumasta).catch(() => setEntryGumasta(null));
    } else {
      setEntryGumasta(null);
    }
  }, [entry?.gumasta_id]);

  const loadPendingList = useCallback(async () => {
    setLoadingPending(true);
    // Paint cached data immediately
    const cached = await loadCachedGateEntries(CACHE_SCOPE_INNER_PENDING);
    if (cached.length > 0) setPendingList(cached);

    if (connectivity.isOnline()) {
      try {
        const pending = await getPendingVerifications();
        setPendingList(pending);
        await cacheGateEntries(CACHE_SCOPE_INNER_PENDING, pending);
      } catch {}
    }
    setLoadingPending(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPendingList();
      getPrintTokenEnabled().then(setPrintTokenEnabled);
      getPrintTokenIncludePhoto().then(setPrintTokenIncludePhoto);
    }, [loadPendingList])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPendingList();
    setRefreshing(false);
  };

  const handlePrint = async (e: GateEntry) => {
    setPrinting(true);
    await printGateToken(e, { includePhoto: printTokenIncludePhoto });
    setPrinting(false);
  };

  const handleShare = async (e: GateEntry) => {
    setPrinting(true);
    await shareGateTokenPDF(e, { includePhoto: printTokenIncludePhoto });
    setPrinting(false);
  };

  const handleSearch = async () => {
    const searchVal = searchMode === "phone" ? phoneValue.trim() : entryCode.trim();
    if (!searchVal) {
      setError(t('supervisor.innerGate.emptyCode'));
      return;
    }

    setSearching(true);
    setError(null);
    setEntry(null);

    try {
      if (searchMode === "phone") {
        const sebayat = await searchSebayatResilient(searchVal, "phone");
        if (!sebayat) {
          setError(t('supervisor.westGate.noSebayatPhone'));
          return;
        }
        if (connectivity.isOnline()) {
          const tickets = await getSebayatPendingTickets(sebayat.id);
          const activeTicket = tickets.find(
            (tk) => tk.status === "registered" || tk.status === "acknowledged"
          );
          if (activeTicket) {
            setEntry(activeTicket);
            setVerifiedCount(activeTicket.declared_devotee_count);
            loadEntryQuota(activeTicket);
          } else {
            setError(t('supervisor.innerGate.notFound'));
          }
        } else {
          // Offline: load from inner_gate pending cache
          const cachedPending = await loadCachedGateEntries(CACHE_SCOPE_INNER_PENDING);
          const activeTicket = cachedPending.find(
            (tk) => tk.sebayat_id === sebayat.id && (tk.status === "registered" || (tk as any).status === "acknowledged")
          );
          if (activeTicket) {
            setEntry(activeTicket);
            setVerifiedCount(activeTicket.declared_devotee_count);
            loadEntryQuota(activeTicket);
          } else {
            setError(t('supervisor.innerGate.notFound'));
          }
        }
        return;
      }

      const found = await getEntryByCode(searchVal.toUpperCase());
      if (found) {
        if (found.status === "verified") {
          setError(t('supervisor.innerGate.alreadyVerified'));
        } else if (found.status === "cancelled") {
          setError(t('supervisor.innerGate.cancelled'));
        } else if (found.status === "pending") {
          setError(t('supervisor.innerGate.pendingAtWestGate'));
        } else if (found.status === "discrepancy_flagged") {
          setError(t('supervisor.innerGate.flagged'));
        } else {
          setEntry(found);
          setVerifiedCount(found.declared_devotee_count);
          loadEntryQuota(found);
        }
      } else {
        setError(t('supervisor.innerGate.notFound'));
      }
    } catch (err) {
      setError(t('supervisor.innerGate.searchFailed'));
    } finally {
      setSearching(false);
    }
  };

  const handleQRScan = async (data: string) => {
    if (scannerRef.current) return;
    scannerRef.current = true;

    try {
      const resolved = await resolveScannedTicket(data);
      if (!resolved) {
        setError(t('supervisor.innerGate.invalidQr'));
        return;
      }

      if (resolved.source === "server" && resolved.ticket) {
        const found = resolved.ticket;
        if (found.status === "verified") {
          setError(t('supervisor.innerGate.alreadyVerified'));
        } else if (found.status === "cancelled") {
          setError(t('supervisor.innerGate.cancelled'));
        } else if (found.status === "pending") {
          setError(t('supervisor.innerGate.pendingAtWestGate'));
        } else if (found.status === "discrepancy_flagged") {
          setError(t('supervisor.innerGate.flagged'));
        } else {
          setEntry(found);
          setOfflineMode(false);
          setOfflineEntry(null);
          setVerifiedCount(found.declared_devotee_count);
          loadEntryQuota(found);
        }
      } else if (resolved.source === "offline_payload" && resolved.idempotencyKey && resolved.declaredCount !== null && resolved.sebayatId) {
        // Duplicate-scan guard: prevent the same offline ticket from being
        // accepted twice on this supervisor device in the same day.
        const scannedRecord = await getScannedRecord(resolved.idempotencyKey);
        if (scannedRecord) {
          setAlreadyScannedRecord(scannedRecord);
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

        setOfflineMode(true);
        setOfflineEntry({
          idempotencyKey: resolved.idempotencyKey,
          entryCode: resolved.entryCode,
          declaredCount: resolved.declaredCount,
          sebayatId: resolved.sebayatId,
          qrPayload: parsedQr,
        });
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
          status: "registered",
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
        setEntry(synthesized);
        setVerifiedCount(resolved.declaredCount);
        setMaxVerifiedCount(resolved.declaredCount + 50);
      } else {
        setError(t('supervisor.innerGate.invalidQr'));
      }
    } catch (err) {
      setError(t('supervisor.innerGate.failedQr'));
    } finally {
      scannerRef.current = false;
      setShowScanner(false);
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError(t('supervisor.innerGate.cameraPermission'));
        return;
      }
    }
    setShowScanner(true);
    scannerRef.current = false;
  };

  const loadEntryQuota = async (found: GateEntry) => {
    try {
      const quota = connectivity.isOnline()
        ? await getSebayatDailyQuota(found.sebayat_id, found.entry_date)
        : await getEffectiveQuota(found.sebayat_id);
      setMaxVerifiedCount(found.declared_devotee_count + quota.remainingCount);
    } catch {
      setMaxVerifiedCount(found.declared_devotee_count);
    }
  };

  const selectPendingEntry = (selectedEntry: GateEntry) => {
    setEntry(selectedEntry);
    setVerifiedCount(selectedEntry.declared_devotee_count);
    setViewMode("scan");
    loadEntryQuota(selectedEntry);
  };

  const handleVerify = async () => {
    if (!profile) return;

    if (offlineMode && offlineEntry) {
      const needsReason = verifiedCount !== offlineEntry.declaredCount;
      if (needsReason && !adjustReason.trim()) {
        setError(t('supervisor.innerGate.reasonRequired'));
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const r = await recordInnerGateEventResilient({
          idempotencyKey: offlineEntry.idempotencyKey,
          supervisorId: profile.id,
          verifiedCount,
          reason: needsReason ? adjustReason.trim() : undefined,
          sebayatId: offlineEntry.sebayatId,
          entryCode: offlineEntry.entryCode,
          offlineOrigin: true,
          offlineQrPayload: offlineEntry.qrPayload,
        });
        if (r.success) {
          await markIdempotencyKeyScanned({
            idempotencyKey: offlineEntry.idempotencyKey,
            gate: "inner",
            count: verifiedCount,
            entryCode: offlineEntry.entryCode,
            scannedAt: new Date().toISOString(),
          });
        }
        const fakeEntry: GateEntry = {
          id: offlineEntry.idempotencyKey,
          entry_code: offlineEntry.entryCode,
          qr_code_data: null,
          sebayat_id: offlineEntry.sebayatId,
          slot_id: null,
          west_gate_supervisor_id: null,
          inner_gate_supervisor_id: profile.id,
          declared_devotee_count: offlineEntry.declaredCount,
          verified_devotee_count: verifiedCount,
          status: "verified",
          entry_date: new Date().toISOString().split("T")[0],
          west_gate_entry_time: null,
          inner_gate_verification_time: new Date().toISOString(),
          notes: needsReason ? adjustReason.trim() : null,
          created_by_sebayat: true,
          expires_at: null,
          entry_mode: "west_gate",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setResult({ success: r.success, message: r.message, entry: fakeEntry });
      } catch (err) {
        setError(t('supervisor.innerGate.searchFailed'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!entry) return;

    const needsReason = verifiedCount !== entry.declared_devotee_count;
    if (needsReason && !adjustReason.trim()) {
      setError(t('supervisor.innerGate.reasonRequired'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (!connectivity.isOnline() && entry.idempotency_key) {
        const r = await recordInnerGateEventResilient({
          idempotencyKey: entry.idempotency_key,
          supervisorId: profile.id,
          verifiedCount,
          reason: needsReason ? adjustReason.trim() : undefined,
          sebayatId: entry.sebayat_id,
          entryCode: entry.entry_code,
        });
        const merged: GateEntry = {
          ...entry,
          verified_devotee_count: verifiedCount,
          inner_gate_supervisor_id: profile.id,
          inner_gate_verification_time: new Date().toISOString(),
          status: "verified",
          notes: needsReason ? adjustReason.trim() : entry.notes,
        };
        setResult({ success: r.success, message: r.message, entry: merged });
        return;
      }

      const verifyResult = await verifyInnerGateEntry(
        entry.id,
        verifiedCount,
        profile.id,
        needsReason ? adjustReason.trim() : undefined
      );

      setResult(verifyResult);
      if (!verifyResult.success) {
        setError(verifyResult.message);
      }
    } catch (err) {
      setError(t('supervisor.innerGate.searchFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFlag = async () => {
    if (!entry || !profile || !flagReason.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const flagResult = await flagEntryDiscrepancyResilient(
        entry.id,
        flagReason.trim(),
        profile.id
      );

      if (flagResult.success) {
        setResult(flagResult);
        setShowFlagModal(false);
      } else {
        setError(flagResult.message);
      }
    } catch (err) {
      setError(t('supervisor.innerGate.flagging'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEntry(null);
    setOfflineMode(false);
    setOfflineEntry(null);
    setEntryCode("");
    setPhoneValue("");
    setVerifiedCount(0);
    setAdjustReason("");
    setError(null);
    setResult(null);
    setFlagReason("");
    setMaxVerifiedCount(999);
  };

  const adjustCount = (delta: number) => {
    const newCount = verifiedCount + delta;
    if (newCount >= 0 && newCount <= maxVerifiedCount) {
      setVerifiedCount(newCount);
    }
  };

  if (result?.success && result.entry) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.successContent}>
          <View style={styles.successCard}>
            <View
              style={[
                styles.successIcon,
                result.entry.status === "discrepancy_flagged" && {
                  backgroundColor: COLORS.warning,
                },
              ]}
            >
              {result.entry.status === "discrepancy_flagged" ? (
                <Flag size={48} color="#fff" />
              ) : (
                <Check size={48} color="#fff" />
              )}
            </View>
            <Text style={styles.successTitle}>
              {result.entry.status === "discrepancy_flagged"
                ? t('supervisor.innerGate.entryFlaggedTitle')
                : t('supervisor.innerGate.entryVerifiedTitle')}
            </Text>
            <Text style={styles.successSubtitle}>
              {result.entry.status === "discrepancy_flagged"
                ? t('supervisor.innerGate.entryFlaggedBody')
                : t('supervisor.innerGate.entryVerifiedBody')}
            </Text>

            <View style={styles.entryDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('supervisor.innerGate.entryCode')}</Text>
                <Text style={styles.detailValue}>{result.entry.entry_code}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('supervisor.innerGate.darshan')}</Text>
                <Text style={styles.detailValue}>
                  {(result.entry.sebayat as any)?.full_name}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('supervisor.innerGate.declaredCount')}</Text>
                <Text style={styles.detailValue}>
                  {result.entry.declared_devotee_count}
                </Text>
              </View>
              {result.entry.verified_devotee_count !== null && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('supervisor.innerGate.verifiedCount')}</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      result.entry.verified_devotee_count !==
                        result.entry.declared_devotee_count && {
                        color:
                          result.entry.verified_devotee_count >
                          result.entry.declared_devotee_count
                            ? COLORS.success
                            : COLORS.warning,
                      },
                    ]}
                  >
                    {result.entry.verified_devotee_count}
                  </Text>
                </View>
              )}
            </View>

            {printTokenEnabled && result.entry.status === "verified" && (
              <View style={styles.printButtonsRow}>
                <TouchableOpacity
                  style={[styles.printButton, printing && styles.printButtonDisabled]}
                  onPress={() => handlePrint(result.entry!)}
                  disabled={printing}
                  activeOpacity={0.8}
                >
                  <Printer size={18} color={COLORS.primary} />
                  <Text style={styles.printButtonText}>Print Receipt</Text>
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

            <TouchableOpacity
              style={styles.newEntryButton}
              onPress={resetForm}
              activeOpacity={0.8}
            >
              <Text style={styles.newEntryButtonText}>{t('supervisor.innerGate.verifyNext')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

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
          <Text style={styles.title}>{t('supervisor.innerGate.title')}</Text>
          <Text style={styles.subtitle}>{t('supervisor.innerGate.subtitle')}</Text>
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
              {t('supervisor.westGate.pendingTab', { count: pendingList.length })}
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
            {pendingList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Clock size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>{t('supervisor.innerGate.noPendingEntries')}</Text>
              </View>
            ) : (
              pendingList.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.pendingCard}
                  onPress={() => selectPendingEntry(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.pendingLeft}>
                    {(item.sebayat as any)?.photo_url ? (
                      <Image
                        source={{ uri: (item.sebayat as any).photo_url }}
                        style={styles.pendingPhoto}
                      />
                    ) : (
                      <View style={styles.pendingPhotoPlaceholder}>
                        <User size={24} color={COLORS.textMuted} />
                      </View>
                    )}
                    <View style={styles.pendingInfo}>
                      <Text style={styles.pendingName}>{(item.sebayat as any)?.full_name || "Unknown"}</Text>
                      <Text style={styles.pendingCategory}>{(item.sebayat as any)?.category?.name || "No Nijog"}</Text>
                      <View style={styles.pendingMeta}>
                        <Users size={12} color={COLORS.textSecondary} />
                        <Text style={styles.pendingMetaText}>{item.declared_devotee_count} devotees</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.pendingRight}>
                    <Text style={styles.pendingCode}>{item.entry_code}</Text>
                    <View style={styles.pendingTimeRow}>
                      <Clock size={12} color={COLORS.warning} />
                      <Text style={styles.pendingTime}>
                        {new Date(item.west_gate_entry_time ?? item.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <>
            {!entry && (
              <>
                <View style={styles.modeSelector}>
                  <TouchableOpacity
                    style={[styles.modeButton, searchMode === "code" && styles.modeButtonActive, isOffline && styles.modeButtonDisabled]}
                    onPress={() => { if (!isOffline) { setSearchMode("code"); setEntryCode(""); } }}
                    activeOpacity={isOffline ? 1 : 0.8}
                  >
                    <Ticket size={18} color={isOffline ? COLORS.textMuted : searchMode === "code" ? "#fff" : COLORS.textSecondary} />
                    <Text style={[styles.modeButtonText, searchMode === "code" && styles.modeButtonTextActive, isOffline && styles.modeButtonTextDisabled]}>
                      {t('supervisor.westGate.code')}
                    </Text>
                    {isOffline && <Text style={styles.modeButtonDisabledHint}>{t('supervisor.westGate.requiresInternet')}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeButton, searchMode === "qr" && styles.modeButtonActive]}
                    onPress={() => setSearchMode("qr")}
                    activeOpacity={0.8}
                  >
                    <QrCode size={18} color={searchMode === "qr" ? "#fff" : COLORS.textSecondary} />
                    <Text style={[styles.modeButtonText, searchMode === "qr" && styles.modeButtonTextActive]}>
                      {t('supervisor.westGate.qr')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeButton, searchMode === "phone" && styles.modeButtonActive, isOffline && styles.modeButtonDisabled]}
                    onPress={() => { if (!isOffline) { setSearchMode("phone"); setPhoneValue(""); } }}
                    activeOpacity={isOffline ? 1 : 0.8}
                  >
                    <Phone size={18} color={isOffline ? COLORS.textMuted : searchMode === "phone" ? "#fff" : COLORS.textSecondary} />
                    <Text style={[styles.modeButtonText, searchMode === "phone" && styles.modeButtonTextActive, isOffline && styles.modeButtonTextDisabled]}>
                      {t('supervisor.westGate.phone')}
                    </Text>
                    {isOffline && <Text style={styles.modeButtonDisabledHint}>{t('supervisor.westGate.requiresInternet')}</Text>}
                  </TouchableOpacity>
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
                        value={searchMode === "phone" ? phoneValue : entryCode}
                        onChangeText={(text) =>
                          searchMode === "phone"
                            ? setPhoneValue(text)
                            : setEntryCode(text.toUpperCase())
                        }
                        placeholder={
                          searchMode === "code"
                            ? t('supervisor.westGate.enterCode')
                            : t('supervisor.westGate.enterPhone')
                        }
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType={searchMode === "phone" ? "phone-pad" : "default"}
                        maxLength={searchMode === "phone" ? 10 : 6}
                        autoCapitalize={searchMode === "phone" ? "none" : "characters"}
                      />
                      {(searchMode === "phone" ? phoneValue : entryCode).length > 0 && (
                        <TouchableOpacity
                          onPress={() => searchMode === "phone" ? setPhoneValue("") : setEntryCode("")}
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

        {entry && (
          <View style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <View style={styles.entryCodeBadge}>
                <Text style={styles.entryCodeText}>{entry.entry_code}</Text>
              </View>
              {entry.entry_mode === "marjana_mandap" && (
                <View style={styles.directEntryBadge}>
                  <Text style={styles.directEntryBadgeText}>{t('supervisor.innerGate.marjanaMandapDirectEntry')}</Text>
                </View>
              )}
              {(offlineMode || entry.offline_origin) && (
                <View style={[styles.directEntryBadge, { backgroundColor: COLORS.warning + "20", borderColor: COLORS.warning + "40" }] }>
                  <Text style={[styles.directEntryBadgeText, { color: COLORS.warning }]}>Offline-issued</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.changeEntryButton}
                onPress={resetForm}
              >
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.sebayatSection}>
              {(entry.sebayat as any)?.photo_url ? (
                <Image
                  source={{ uri: (entry.sebayat as any).photo_url }}
                  style={styles.sebayatPhoto}
                />
              ) : (
                <View style={styles.sebayatPhotoPlaceholder}>
                  <User size={32} color={COLORS.textMuted} />
                </View>
              )}
              <View style={styles.sebayatInfo}>
                <Text style={styles.sebayatName}>
                  {(entry.sebayat as any)?.full_name || "Unknown"}
                </Text>
                <Text style={styles.sebayatCategory}>
                  {(entry.sebayat as any)?.category?.name || "No Nijog"}
                </Text>
                {entry.west_gate_entry_time ? (
                  <Text style={styles.entryTime}>
                    {t('supervisor.entry.westGate')}:{" "}
                    {new Date(entry.west_gate_entry_time).toLocaleTimeString(
                      "en-IN",
                      { hour: "2-digit", minute: "2-digit" }
                    )}
                  </Text>
                ) : (
                  <Text style={[styles.entryTime, { color: "#0891b2" }]}>
                    {t('supervisor.darshanTickets.entryModeMarjanaMandap')}
                  </Text>
                )}
              </View>
            </View>
            {entryGumasta && <GumastaInfoCard gumasta={entryGumasta} />}

            <View style={styles.declaredCount}>
              <Text style={styles.declaredLabel}>{t('supervisor.entry.declaredAtWestGate')}</Text>
              <View style={styles.declaredValue}>
                <Users size={20} color={COLORS.text} />
                <Text style={styles.declaredNumber}>
                  {entry.declared_devotee_count}
                </Text>
                <Text style={styles.declaredUnit}>devotees</Text>
              </View>
            </View>

            <View style={styles.verifySection}>
              <Text style={styles.verifyLabel}>{t('supervisor.innerGate.actualCount')}</Text>
              <View style={styles.countControl}>
                <TouchableOpacity
                  style={[
                    styles.countButton,
                    verifiedCount <= 0 && styles.countButtonDisabled,
                  ]}
                  onPress={() => adjustCount(-1)}
                  disabled={verifiedCount <= 0}
                  activeOpacity={0.7}
                >
                  <Minus
                    size={24}
                    color={verifiedCount <= 0 ? COLORS.textMuted : COLORS.text}
                  />
                </TouchableOpacity>
                <View
                  style={[
                    styles.countDisplay,
                    verifiedCount !== entry.declared_devotee_count && {
                      backgroundColor:
                        verifiedCount > entry.declared_devotee_count
                          ? "#D1FAE5"
                          : "#FEF3C7",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countValue,
                      verifiedCount !== entry.declared_devotee_count && {
                        color:
                          verifiedCount > entry.declared_devotee_count
                            ? COLORS.success
                            : COLORS.warning,
                      },
                    ]}
                  >
                    {verifiedCount}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.countButton,
                    verifiedCount >= maxVerifiedCount && styles.countButtonDisabled,
                  ]}
                  onPress={() => adjustCount(1)}
                  disabled={verifiedCount >= maxVerifiedCount}
                  activeOpacity={0.7}
                >
                  <Plus size={24} color={verifiedCount >= maxVerifiedCount ? COLORS.textMuted : COLORS.text} />
                </TouchableOpacity>
              </View>

              {verifiedCount !== entry.declared_devotee_count && (
                <View style={styles.reasonSection}>
                  <Text style={styles.reasonLabel}>
                    {t('supervisor.innerGate.reasonLabel')}
                  </Text>
                  <TextInput
                    style={styles.reasonInput}
                    value={adjustReason}
                    onChangeText={setAdjustReason}
                    placeholder={t('supervisor.innerGate.reasonPlaceholder')}
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              )}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.verifyButton,
                  submitting && styles.verifyButtonDisabled,
                ]}
                onPress={handleVerify}
                disabled={submitting}
                activeOpacity={0.8}
              >
                <Check size={20} color="#fff" />
                <Text style={styles.verifyButtonText}>
                  {submitting ? t('supervisor.innerGate.verifying') : t('supervisor.innerGate.verifyEntry')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.flagButton}
                onPress={() => setShowFlagModal(true)}
                activeOpacity={0.7}
              >
                <Flag size={20} color={COLORS.warning} />
                <Text style={styles.flagButtonText}>{t('supervisor.innerGate.flagIssue')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          )}
        </>
        )}

      </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showScanner} animationType="slide">
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>{t('supervisor.innerGate.scanEntryQr')}</Text>
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
                {t('supervisor.innerGate.qrNotSupported')}
              </Text>
              <TouchableOpacity
                style={styles.webCameraButton}
                onPress={() => setShowScanner(false)}
              >
                <Text style={styles.webCameraButtonText}>{t('supervisor.innerGate.useEntryCode')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={showFlagModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.flagModal}>
            <View style={styles.flagModalHeader}>
              <Flag size={24} color={COLORS.warning} />
              <Text style={styles.flagModalTitle}>{t('supervisor.innerGate.flagDiscrepancy')}</Text>
            </View>
            <Text style={styles.flagModalSubtitle}>
              {t('supervisor.innerGate.flagDescription')}
            </Text>
            <TextInput
              style={styles.flagInput}
              value={flagReason}
              onChangeText={setFlagReason}
              placeholder={t('supervisor.innerGate.flagPlaceholder')}
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
                <Text style={styles.flagCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.flagSubmitButton,
                  (!flagReason.trim() || submitting) &&
                    styles.flagSubmitDisabled,
                ]}
                onPress={handleFlag}
                disabled={!flagReason.trim() || submitting}
              >
                <Text style={styles.flagSubmitText}>
                  {submitting ? t('supervisor.innerGate.flagging') : t('supervisor.innerGate.flagEntry')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Already-Scanned Alert Modal */}
      <Modal
        visible={!!alreadyScannedRecord}
        transparent
        animationType="fade"
        onRequestClose={() => setAlreadyScannedRecord(null)}
      >
        <Pressable style={styles.alreadyScannedBackdrop} onPress={() => setAlreadyScannedRecord(null)}>
          <Pressable style={styles.alreadyScannedCard} onPress={() => {}}>
            <View style={styles.alreadyScannedIconRow}>
              <View style={styles.alreadyScannedIconBg}>
                <AlertCircle size={28} color={COLORS.warning} />
              </View>
            </View>
            <Text style={styles.alreadyScannedTitle}>
              {t('supervisor.innerGate.alreadyScannedTitle')}
            </Text>
            <Text style={styles.alreadyScannedBody}>
              {t('supervisor.innerGate.alreadyScannedBody')}
            </Text>
            {alreadyScannedRecord && (
              <View style={styles.alreadyScannedDetails}>
                <Text style={styles.alreadyScannedDetailText}>
                  {t('supervisor.innerGate.alreadyScannedDetails', {
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
  content: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
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
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "500",
  },
  keyboardView: {
    flex: 1,
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: 16,
    gap: 4,
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
  pendingSection: {
    gap: 12,
  },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOWS.small,
  },
  pendingLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    fontWeight: "500",
    marginTop: 1,
  },
  pendingMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  pendingMetaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  pendingRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  pendingCode: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 1,
  },
  pendingTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pendingTime: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.warning,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
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
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeButtonText: {
    fontSize: 12,
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
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 14,
    gap: 8,
  },
  searchIcon: {
    width: 24,
    alignItems: "center",
  },
  phonePrefix: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "600",
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
    flexWrap: "wrap",
    gap: SPACING.xs,
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
  entryTime: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
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
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 100,
    alignItems: "center",
  },
  countValue: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.primary,
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
  directEntryBadge: {
    backgroundColor: "#0891b220",
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#0891b240",
  },
  directEntryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0891b2",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  alreadyScannedBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
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
