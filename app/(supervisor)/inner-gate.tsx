import { useState, useRef } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  QrCode,
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
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { useTranslation } from "react-i18next";
import {
  getEntryByCode,
  searchEntryByQR,
  verifyInnerGateEntry,
  adjustDevoteeCount,
  flagEntryDiscrepancy,
  getPendingVerifications,
  getSebayatDailyQuota,
} from "@/services/entryService";
import { COLORS, SHADOWS, SPACING, RADIUS } from "@/constants/config";
import type { GateEntry } from "@/types/database";
import type { VerifyEntryResult } from "@/types";

export default function InnerGateScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [entryCode, setEntryCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [entry, setEntry] = useState<GateEntry | null>(null);
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
  const [showPendingList, setShowPendingList] = useState(false);
  const [maxVerifiedCount, setMaxVerifiedCount] = useState<number>(999);

  const handleSearch = async () => {
    if (!entryCode.trim()) {
      setError(t('supervisor.innerGate.emptyCode'));
      return;
    }

    setSearching(true);
    setError(null);
    setEntry(null);

    try {
      const found = await getEntryByCode(entryCode.trim().toUpperCase());
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
      const found = await searchEntryByQR(data);
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
        setShowScanner(false);
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
      const quota = await getSebayatDailyQuota(found.sebayat_id, found.entry_date);
      // declared count is already counted in used; max increase = remainingCount
      setMaxVerifiedCount(found.declared_devotee_count + quota.remainingCount);
    } catch {
      setMaxVerifiedCount(found.declared_devotee_count);
    }
  };

  const loadPendingList = async () => {
    const pending = await getPendingVerifications();
    setPendingList(pending);
    setShowPendingList(true);
  };

  const selectPendingEntry = (selectedEntry: GateEntry) => {
    setEntry(selectedEntry);
    setVerifiedCount(selectedEntry.declared_devotee_count);
    setShowPendingList(false);
    loadEntryQuota(selectedEntry);
  };

  const handleVerify = async () => {
    if (!entry || !profile) return;

    const needsReason = verifiedCount !== entry.declared_devotee_count;
    if (needsReason && !adjustReason.trim()) {
      setError(t('supervisor.innerGate.reasonRequired'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
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
      const flagResult = await flagEntryDiscrepancy(
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
    setEntryCode("");
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
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('supervisor.innerGate.title')}</Text>
          <Text style={styles.subtitle}>{t('supervisor.innerGate.subtitle')}</Text>
        </View>

        {error && (
          <View style={styles.errorCard}>
            <AlertCircle size={20} color={COLORS.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!entry && (
          <>
            <View style={styles.searchActions}>
              <TouchableOpacity
                style={styles.scanButton}
                onPress={openScanner}
                activeOpacity={0.8}
              >
                <Camera size={28} color={COLORS.primary} />
                <Text style={styles.scanButtonText}>{t('supervisor.innerGate.scanQrCode')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.listButton}
                onPress={loadPendingList}
                activeOpacity={0.8}
              >
                <Clock size={24} color={COLORS.warning} />
                <Text style={styles.listButtonText}>{t('supervisor.innerGate.viewPending')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('supervisor.innerGate.orEnterCode')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.searchCard}>
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  value={entryCode}
                  onChangeText={(text) => setEntryCode(text.toUpperCase())}
                  placeholder={t('supervisor.innerGate.enterCode')}
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="characters"
                  maxLength={6}
                />
                {entryCode.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setEntryCode("")}
                    style={styles.clearButton}
                  >
                    <X size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[
                  styles.searchButton,
                  searching && styles.searchButtonDisabled,
                ]}
                onPress={handleSearch}
                disabled={searching}
                activeOpacity={0.8}
              >
                <Search size={20} color="#fff" />
                <Text style={styles.searchButtonText}>
                  {searching ? t('common.searching') : t('supervisor.innerGate.findEntry')}
                </Text>
              </TouchableOpacity>
            </View>
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
      </ScrollView>

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

      <Modal visible={showPendingList} animationType="slide">
        <View style={styles.pendingContainer}>
          <View style={styles.pendingHeader}>
            <Text style={styles.pendingTitle}>{t('supervisor.innerGate.pendingVerifications')}</Text>
            <TouchableOpacity
              style={styles.pendingClose}
              onPress={() => setShowPendingList(false)}
            >
              <X size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pendingContent}>
            {pendingList.length === 0 ? (
              <View style={styles.emptyState}>
                <Clock size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>{t('supervisor.innerGate.noPendingEntries')}</Text>
              </View>
            ) : (
              pendingList.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.pendingItem}
                  onPress={() => selectPendingEntry(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.pendingItemCode}>
                    <Text style={styles.pendingItemCodeText}>
                      {item.entry_code}
                    </Text>
                  </View>
                  <View style={styles.pendingItemInfo}>
                    <Text style={styles.pendingItemName}>
                      {(item.sebayat as any)?.full_name || "Unknown"}
                    </Text>
                    <Text style={styles.pendingItemCount}>
                      {t('supervisor.innerGate.devoteeCount', { count: item.declared_devotee_count })}
                    </Text>
                  </View>
                  <Text style={styles.pendingItemTime}>
                    {new Date(item.west_gate_entry_time).toLocaleTimeString(
                      "en-IN",
                      { hour: "2-digit", minute: "2-digit" }
                    )}
                  </Text>
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
  searchActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  scanButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  scanButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
  },
  listButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.warning,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  listButtonText: {
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
  },
  searchInput: {
    flex: 1,
    fontSize: 20,
    color: COLORS.text,
    fontWeight: "700",
    letterSpacing: 4,
    textAlign: "center",
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
  pendingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pendingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pendingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  pendingClose: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  pendingContent: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  pendingItem: {
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
  pendingItemCode: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pendingItemCodeText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 1,
  },
  pendingItemInfo: {
    flex: 1,
  },
  pendingItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  pendingItemCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pendingItemTime: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "500",
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
});
