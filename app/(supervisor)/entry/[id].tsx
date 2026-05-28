import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  User,
  Users,
  Clock,
  Check,
  Flag,
  X as XCircle,
  MapPin,
  FileText,
  WifiOff,
} from "lucide-react-native";
import { getEntryById, getEntryAuditLogs } from "@/services/entryService";
import { getGumastaById } from "@/services/gumastaService";
import { GumastaInfoCard } from "@/components/tickets/GumastaInfoCard";
import { connectivity, loadCachedGateEntries } from "@/lib/offline";
import { COLORS, SHADOWS } from "@/constants/config";
import type { GateEntry, EntryAuditLog, EntryStatus, EntryAction, Gumasta } from "@/types/database";
import { useTranslation } from "react-i18next";

const STATUS_STYLE: Record<EntryStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  pending: { color: "#8B5CF6", bg: "#EDE9FE", icon: <Clock size={20} color="#8B5CF6" /> },
  registered: { color: "#F59E0B", bg: "#FEF3C7", icon: <Clock size={20} color="#F59E0B" /> },
  verified: { color: "#10B981", bg: "#D1FAE5", icon: <Check size={20} color="#10B981" /> },
  discrepancy_flagged: { color: "#EF4444", bg: "#FEE2E2", icon: <Flag size={20} color="#EF4444" /> },
  cancelled: { color: "#6B7280", bg: "#F3F4F6", icon: <XCircle size={20} color="#6B7280" /> },
};

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tabBarHeight = 0;
  const { t } = useTranslation();
  const [entry, setEntry] = useState<GateEntry | null>(null);
  const [entryGumasta, setEntryGumasta] = useState<Gumasta | null>(null);
  const [auditLogs, setAuditLogs] = useState<EntryAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const STATUS_CONFIG: Record<EntryStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    pending: { label: t('supervisor.entry.statusPending'), ...STATUS_STYLE.pending },
    registered: { label: t('supervisor.entry.statusPending'), ...STATUS_STYLE.registered },
    verified: { label: t('supervisor.history.verified'), ...STATUS_STYLE.verified },
    discrepancy_flagged: { label: t('supervisor.entry.statusFlagged'), ...STATUS_STYLE.discrepancy_flagged },
    cancelled: { label: t('supervisor.entry.statusCancelled'), ...STATUS_STYLE.cancelled },
  };

  const ACTION_LABELS: Record<EntryAction, string> = {
    created: t('supervisor.entry.actionCreated'),
    count_adjusted: t('supervisor.entry.actionAdjusted'),
    verified: t('supervisor.entry.actionVerified'),
    cancelled: t('supervisor.entry.actionCancelled'),
    flagged: t('supervisor.entry.actionFlagged'),
  };

  useEffect(() => {
    if (id) {
      loadEntry();
    }
  }, [id]);

  useEffect(() => {
    if (entry?.gumasta_id) {
      getGumastaById(entry.gumasta_id).then(setEntryGumasta).catch(() => setEntryGumasta(null));
    }
  }, [entry?.gumasta_id]);

  const loadEntry = async () => {
    // Try to find entry in local caches immediately for offline support
    let cachedEntry: GateEntry | null = null;
    const cacheScopes = ["supervisor:today", "supervisor:pending", "inner_gate:pending", "west_gate:pending"];
    for (const scope of cacheScopes) {
      try {
        const cached = await loadCachedGateEntries(scope);
        const found = cached.find((e) => e.id === id);
        if (found) {
          cachedEntry = found;
          setEntry(found);
          setOfflineMode(!connectivity.isOnline());
          break;
        }
      } catch {}
    }

    if (!connectivity.isOnline()) {
      setLoading(false);
      if (!cachedEntry) setNotFound(true);
      return;
    }

    try {
      const [entryData, logs] = await Promise.all([
        getEntryById(id!),
        getEntryAuditLogs(id!),
      ]);
      if (entryData) {
        setEntry(entryData);
        setAuditLogs(logs);
        setOfflineMode(false);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      console.error("Failed to load entry:", err);
      if (!cachedEntry) setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('supervisor.entry.loading')}</Text>
        </View>
      </View>
    );
  }

  if (notFound || !entry) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <WifiOff size={40} color={COLORS.textMuted} />
          <Text style={[styles.loadingText, { marginTop: 12 }]}>{t('common.offlineNotAvailable')}</Text>
          <TouchableOpacity style={styles.backButtonSmall} onPress={() => router.back()}>
            <ArrowLeft size={18} color={COLORS.primary} />
            <Text style={styles.backButtonSmallText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const config = STATUS_CONFIG[entry.status] ?? {
    label: entry.status,
    color: COLORS.textMuted,
    bg: COLORS.surfaceSecondary,
    icon: <Clock size={20} color={COLORS.textMuted} />,
  };
  const sebayat = entry.sebayat as any;
  const westSupervisor = entry.west_gate_supervisor as any;

  return (
    <View style={styles.container}>
      {offlineMode && (
        <View style={styles.offlineBanner}>
          <WifiOff size={14} color="#92400E" />
          <Text style={styles.offlineBannerText}>{t('common.offlineCachedData')}</Text>
        </View>
      )}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>{t('supervisor.entry.entryCode')}</Text>
            <Text style={styles.codeValue}>{entry.entry_code}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            {config.icon}
            <Text style={[styles.statusText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('supervisor.entry.darshanDetails')}</Text>
          <View style={styles.sebayatSection}>
            {sebayat?.photo_url ? (
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
              <Text style={styles.sebayatName}>
                {sebayat?.full_name || "Unknown"}
              </Text>
              <Text style={styles.sebayatCategory}>
                {sebayat?.category?.name || "No Nijog"}
              </Text>
              {sebayat?.temple_health_card_id && (
                <Text style={styles.sebayatHealthCard}>
                  HC: {sebayat.temple_health_card_id}
                </Text>
              )}
            </View>
          </View>
          {entryGumasta && <GumastaInfoCard gumasta={entryGumasta} />}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('supervisor.entry.devoteeCount')}</Text>
          <View style={styles.countSection}>
            <View style={styles.countItem}>
              <View style={styles.countIcon}>
                <MapPin size={20} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.countLabel}>{t('supervisor.entry.declaredAtWestGate')}</Text>
                <View style={styles.countValueRow}>
                  <Users size={18} color={COLORS.text} />
                  <Text style={styles.countValue}>
                    {entry.declared_devotee_count}
                  </Text>
                </View>
              </View>
            </View>

            {entry.verified_devotee_count !== null && (
              <View style={styles.countItem}>
                <View style={[styles.countIcon, { backgroundColor: "#D1FAE5" }]}>
                  <Check size={20} color="#10B981" />
                </View>
                <View>
                  <Text style={styles.countLabel}>{t('supervisor.entry.verifiedAtInnerGate')}</Text>
                  <View style={styles.countValueRow}>
                    <Users size={18} color={COLORS.text} />
                    <Text
                      style={[
                        styles.countValue,
                        entry.verified_devotee_count !==
                          entry.declared_devotee_count && {
                          color:
                            entry.verified_devotee_count >
                            entry.declared_devotee_count
                              ? COLORS.success
                              : COLORS.warning,
                        },
                      ]}
                    >
                      {entry.verified_devotee_count}
                    </Text>
                    {entry.verified_devotee_count !==
                      entry.declared_devotee_count && (
                      <Text style={styles.countDiff}>
                        ({entry.verified_devotee_count > entry.declared_devotee_count
                          ? "+"
                          : ""}
                        {entry.verified_devotee_count - entry.declared_devotee_count})
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('supervisor.entry.timeline')}</Text>
          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>{t('supervisor.entry.westGateEntry')}</Text>
                <Text style={styles.timelineTime}>
                  {new Date(entry.west_gate_entry_time).toLocaleString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "numeric",
                    month: "short",
                  })}
                </Text>
                {westSupervisor && (
                  <Text style={styles.timelineSupervisor}>
                    by {westSupervisor.full_name}
                  </Text>
                )}
              </View>
            </View>

            {entry.inner_gate_verification_time && (
              <View style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineDot,
                    {
                      backgroundColor:
                        entry.status === "discrepancy_flagged"
                          ? COLORS.error
                          : COLORS.success,
                    },
                  ]}
                />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>
                    {entry.status === "discrepancy_flagged"
                      ? t('supervisor.entry.flaggedAtInnerGate')
                      : t('supervisor.entry.innerGateVerification')}
                  </Text>
                  <Text style={styles.timelineTime}>
                    {new Date(entry.inner_gate_verification_time).toLocaleString(
                      "en-IN",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "numeric",
                        month: "short",
                      }
                    )}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {entry.notes && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('supervisor.entry.notes')}</Text>
            <View style={styles.notesContainer}>
              <FileText size={18} color={COLORS.textSecondary} />
              <Text style={styles.notesText}>{entry.notes}</Text>
            </View>
          </View>
        )}

        {auditLogs.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('supervisor.entry.auditLog')}</Text>
            <View style={styles.auditList}>
              {auditLogs.map((log) => (
                <View key={log.id} style={styles.auditItem}>
                  <View style={styles.auditHeader}>
                    <Text style={styles.auditAction}>
                      {ACTION_LABELS[log.action_type]}
                    </Text>
                    <Text style={styles.auditGate}>
                      {log.gate_location === "west_gate"
                        ? t('supervisor.entry.westGate')
                        : t('supervisor.entry.innerGate')}
                    </Text>
                  </View>
                  <Text style={styles.auditTime}>
                    {new Date(log.created_at).toLocaleString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "short",
                    })}
                  </Text>
                  {log.performer && (
                    <Text style={styles.auditPerformer}>
                      by {(log.performer as any).full_name}
                    </Text>
                  )}
                  {log.reason && (
                    <Text style={styles.auditReason}>"{log.reason}"</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
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
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderBottomWidth: 1,
    borderBottomColor: "#F59E0B",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  offlineBannerText: {
    fontSize: 12,
    color: "#92400E",
    flex: 1,
  },
  backButtonSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  backButtonSmallText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "600",
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    ...SHADOWS.small,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  codeContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
    marginBottom: 6,
  },
  codeValue: {
    fontSize: 36,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 6,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sebayatSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
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
  countSection: {
    gap: 16,
  },
  countItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  countIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
  },
  countLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  countValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  countValue: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  countDiff: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 14,
    paddingBottom: 16,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border,
    marginLeft: 7,
    paddingLeft: 20,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    position: "absolute",
    left: -9,
    top: 2,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  timelineTime: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  timelineSupervisor: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  notesContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
  },
  notesText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  auditList: {
    gap: 12,
  },
  auditItem: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
  },
  auditHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  auditAction: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  auditGate: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "500",
  },
  auditTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  auditPerformer: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  auditReason: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: "italic",
    marginTop: 8,
  },
});
