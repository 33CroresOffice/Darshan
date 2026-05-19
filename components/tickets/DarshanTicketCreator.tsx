import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ActivityIndicator,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import {
  Ticket,
  Users,
  Plus,
  Minus,
  Check,
  X,
  Clock,
  CircleAlert as AlertCircle,
  ChevronDown,
  ChevronUp,
  Pencil,
  Printer,
  Share2,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useLocalizedNumber } from "@/hooks/useLocalizedNumber";
import { useSlotName } from "@/hooks/useSlotName";
import {
  getSebayatDailyQuota,
  getSebayatPendingTickets,
  updateDarshanTicketCountByStaff,
  getTicketTimeRemaining,
  isTicketExpired,
} from "@/services/entryService";
import {
  createTicketResilient,
  createTicketForStaffResilient,
  cancelTicketResilient,
  editTicketCountResilient,
  getTodayTicketsResilient,
  getEffectiveQuota,
} from "@/services/offlineEntryService";
import { connectivity, todayString } from "@/lib/offline";
import { getAvailableSlotsForToday, getSlotQuota } from "@/services/slotService";
import { getPrintTokenEnabled, getPrintTokenIncludePhoto } from "@/services/settingsService";
import { printGateToken, shareGateTokenPDF } from "@/services/printTokenService";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";
import type { SebayatQuota, GateEntry, SlotQuota, DarshanSlot, EntryMode } from "@/types/database";
import { OfflineBanner } from "@/components/layout/OfflineBanner";

interface DarshanTicketCreatorProps {
  sebayatRegistrationId: string;
  userName?: string;
  staffMode?: boolean;
  staffUserId?: string;
}

export function DarshanTicketCreator({
  sebayatRegistrationId,
  userName,
  staffMode = false,
  staffUserId,
}: DarshanTicketCreatorProps) {
  const { t } = useTranslation();
  const ln = useLocalizedNumber();
  const slotName = useSlotName();
  const [quota, setQuota] = useState<SebayatQuota | null>(null);
  const [slotQuotas, setSlotQuotas] = useState<SlotQuota[]>([]);
  const [availableSlots, setAvailableSlots] = useState<DarshanSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [pendingTickets, setPendingTickets] = useState<GateEntry[]>([]);
  const [todayTickets, setTodayTickets] = useState<GateEntry[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<GateEntry | null>(null);
  const [devoteeCount, setDevoteeCount] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<GateEntry | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [selectedEntryMode, setSelectedEntryMode] = useState<EntryMode>("west_gate");
  const [confirmCancelTicket, setConfirmCancelTicket] = useState<GateEntry | null>(null);
  const [editCountTicket, setEditCountTicket] = useState<GateEntry | null>(null);
  const [editCount, setEditCount] = useState(1);
  const [editCountError, setEditCountError] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(false);
  const [printTokenEnabled, setPrintTokenEnabled] = useState(false);
  const [printTokenIncludePhoto, setPrintTokenIncludePhoto] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [isOffline, setIsOffline] = useState(!connectivity.isOnline());

  useEffect(() => {
    const unsub = connectivity.subscribe(() => setIsOffline(!connectivity.isOnline()));
    return unsub;
  }, []);

  const loadData = useCallback(async () => {
    if (!sebayatRegistrationId) return;
    const today = todayString();
    try {
      const todayData = await getTodayTicketsResilient(sebayatRegistrationId);
      const pending = todayData.filter((t) => t.status === "pending" || t.status === "registered");
      setPendingTickets(pending);
      setTodayTickets(todayData);

      if (connectivity.isOnline()) {
        try {
          const [quotaData, activeSlots] = await Promise.all([
            getEffectiveQuota(sebayatRegistrationId),
            getAvailableSlotsForToday(),
          ]);
          setQuota(quotaData);
          setAvailableSlots(activeSlots);
          if (activeSlots.length > 0) {
            const quotas = await Promise.all(
              activeSlots.map((slot) => getSlotQuota(slot, sebayatRegistrationId, today))
            );
            setSlotQuotas(quotas);
          } else {
            setSlotQuotas([]);
          }
        } catch {
          const offlineQuota = await getEffectiveQuota(sebayatRegistrationId);
          setQuota(offlineQuota);
          setAvailableSlots([]);
          setSlotQuotas([]);
        }
      } else {
        const offlineQuota = await getEffectiveQuota(sebayatRegistrationId);
        setQuota(offlineQuota);
        setAvailableSlots([]);
        setSlotQuotas([]);
      }
    } catch (err) {
      console.error("Failed to load ticket data:", err);
    } finally {
      setLoading(false);
    }
  }, [sebayatRegistrationId]);

  useEffect(() => {
    loadData();
    getPrintTokenEnabled().then(setPrintTokenEnabled);
    getPrintTokenIncludePhoto().then(setPrintTokenIncludePhoto);
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingTickets.length > 0) {
        setPendingTickets((prev) => [...prev]);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [pendingTickets.length]);

  const handleCreateTicket = async () => {
    if (!sebayatRegistrationId || devoteeCount < 1) return;
    setCreating(true);
    setCreateError(null);

    const result =
      staffMode && staffUserId
        ? await createTicketForStaffResilient(
            sebayatRegistrationId,
            staffUserId,
            devoteeCount,
            selectedSlotId,
            selectedEntryMode
          )
        : await createTicketResilient(
            sebayatRegistrationId,
            devoteeCount,
            selectedSlotId,
            selectedEntryMode
          );

    if (result.success && result.entry) {
      setCreatedTicket(result.entry);
      setShowCreateModal(false);
      setSelectedSlotId(null);
      setSelectedEntryMode("west_gate");
      await loadData();
    } else {
      setCreateError(result.message);
    }
    setCreating(false);
  };

  const handleCancelTicket = (ticket: GateEntry) => {
    setConfirmCancelTicket(ticket);
  };

  const handleConfirmCancel = async () => {
    if (!sebayatRegistrationId || !confirmCancelTicket) return;
    setCancelling(confirmCancelTicket.id);
    setConfirmCancelTicket(null);

    const result = await cancelTicketResilient(confirmCancelTicket, sebayatRegistrationId);
    if (result.success) {
      await loadData();
      if (showTicketModal && selectedTicket?.id === confirmCancelTicket.id) {
        setShowTicketModal(false);
        setSelectedTicket(null);
      }
    }
    setCancelling(null);
  };

  const handleOpenEditCount = (ticket: GateEntry) => {
    setEditCountTicket(ticket);
    setEditCount(ticket.declared_devotee_count);
    setEditCountError(null);
  };

  const handleSaveEditCount = async () => {
    if (!sebayatRegistrationId || !editCountTicket) return;
    setSavingCount(true);
    setEditCountError(null);

    const result = staffUserId
      ? await updateDarshanTicketCountByStaff(editCountTicket.id, editCount, staffUserId)
      : await editTicketCountResilient(editCountTicket, sebayatRegistrationId, editCount);

    if (result.success) {
      setEditCountTicket(null);
      await loadData();
    } else {
      setEditCountError(result.message);
    }
    setSavingCount(false);
  };

  const formatTimeRemaining = (ticket: GateEntry) => {
    const remaining = getTicketTimeRemaining(ticket);
    if (remaining <= 0) return t("supervisor.darshanTickets.expired");
    const minutes = Math.floor(remaining / 60000);
    if (minutes < 60) return t("supervisor.darshanTickets.minutesLeft", { minutes: ln(minutes) });
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return t("supervisor.darshanTickets.hoursLeft", { hours: ln(hours), mins: ln(mins) });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return COLORS.warning;
      case "registered": return COLORS.primary;
      case "verified": return COLORS.success;
      case "cancelled": return COLORS.textMuted;
      default: return COLORS.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return t("supervisor.darshanTickets.statusPending");
      case "registered": return t("supervisor.darshanTickets.statusAtInnerGate");
      case "verified": return t("supervisor.darshanTickets.statusVerified");
      case "cancelled": return t("supervisor.darshanTickets.statusCancelled");
      default: return status;
    }
  };

  const openCreateModal = (slotId?: string) => {
    setSelectedSlotId(slotId ?? null);
    setDevoteeCount(1);
    setCreateError(null);
    setSelectedEntryMode("west_gate");
    setShowCreateModal(true);
  };

  const handleSelectEntryMode = (mode: EntryMode) => {
    setSelectedEntryMode(mode);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  if (!quota) return null;

  if (staffMode) {
    return (
      <View style={styles.container}>
        <View style={styles.quotaCard}>
          <View style={styles.quotaHeader}>
            <View style={styles.quotaIcon}>
              <Users size={20} color={COLORS.primary} />
            </View>
            <View style={styles.quotaInfo}>
              <Text style={styles.quotaUsed}>
                {quota.usedCount} / {quota.maxLimit}
              </Text>
              <Text style={styles.quotaLabel}>{t("supervisor.darshanTickets.devoteesToday")}</Text>
            </View>
          </View>
          <View style={styles.quotaProgressBg}>
            <View
              style={[
                styles.quotaProgressFill,
                {
                  width: `${Math.min(100, (quota.usedCount / quota.maxLimit) * 100)}%`,
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
            {t("supervisor.darshanTickets.slotsRemaining", { count: ln(quota.remainingCount) })}
          </Text>
        </View>

        {isOffline ? (
          <View style={styles.offlineBlockBanner}>
            <AlertCircle size={18} color={COLORS.warning} />
            <Text style={styles.offlineBlockText}>{t("supervisor.darshanTickets.offlineCreateDisabled")}</Text>
          </View>
        ) : quota.remainingCount <= 0 ? (
          <View style={styles.quotaExhaustedBanner}>
            <AlertCircle size={18} color={COLORS.error} />
            <Text style={styles.quotaExhaustedText}>{t("supervisor.darshanTickets.quotaExhausted")}</Text>
          </View>
        ) : slotQuotas.length > 0 ? (
          <View style={styles.staffSlotsSection}>
            <Text style={styles.staffSlotsSectionTitle}>{t("supervisor.darshanTickets.selectSlot")}</Text>
            {slotQuotas.map((sq) => {
              const effectiveRemaining = Math.min(sq.remainingCount, sq.userRemainingCount);
              const isFull = effectiveRemaining === 0;
              const fillPct = Math.min(1, sq.userUsedCount / sq.slot.max_bookings_per_user);
              const barColor = isFull
                ? COLORS.error
                : fillPct >= 0.8
                ? COLORS.warning
                : COLORS.success;
              return (
                <TouchableOpacity
                  key={sq.slot.id}
                  style={[styles.staffSlotCard, isFull && styles.staffSlotCardFull]}
                  onPress={() => !isFull && openCreateModal(sq.slot.id)}
                  disabled={isFull}
                  activeOpacity={0.7}
                >
                  <View style={styles.staffSlotTop}>
                    <Text style={[styles.staffSlotName, isFull && styles.staffSlotNameFull]}>
                      {slotName(sq.slot)}
                    </Text>
                    {isFull ? (
                      <View style={styles.slotFullBadge}>
                        <Text style={styles.slotFullBadgeText}>{t("supervisor.darshanTickets.full")}</Text>
                      </View>
                    ) : (
                      <View style={styles.bookSlotBadge}>
                        <Text style={styles.bookSlotBadgeText}>{t("supervisor.darshanTickets.book")}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.slotProgressBg}>
                    <View
                      style={[
                        styles.slotProgressFill,
                        { width: `${fillPct * 100}%`, backgroundColor: barColor },
                      ]}
                    />
                  </View>
                  <Text style={[styles.staffSlotStats, isFull && styles.staffSlotStatsFull]}>
                    {t("supervisor.darshanTickets.slotStats", { booked: ln(sq.userUsedCount), limit: ln(sq.slot.max_bookings_per_user), remaining: ln(Math.min(sq.remainingCount, sq.userRemainingCount)) })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => openCreateModal()}
            activeOpacity={0.8}
          >
            <Ticket size={20} color="#fff" />
            <Text style={styles.createButtonText}>{t("supervisor.darshanTickets.createTicketBtn")}</Text>
          </TouchableOpacity>
        )}

        {pendingTickets.length > 0 && (
          <View style={styles.ticketsSection}>
            <Text style={styles.ticketsTitle}>{t("supervisor.darshanTickets.activeTickets")}</Text>
            {pendingTickets.map((ticket) => {
              const expired = isTicketExpired(ticket);
              return (
                <View
                  key={ticket.id}
                  style={[styles.ticketCard, expired && styles.ticketCardExpired]}
                >
                  <View style={styles.ticketLeft}>
                    <View style={styles.ticketCodeBadge}>
                      <Text style={styles.ticketCode}>{ticket.entry_code}</Text>
                    </View>
                    <View style={styles.ticketInfo}>
                      {(ticket.slot as any)?.name && (
                        <Text style={styles.ticketSlot}>{slotName(ticket.slot as any)}</Text>
                      )}
                      <Text style={styles.ticketDevotees}>
                        {ln(ticket.declared_devotee_count)} {ticket.declared_devotee_count > 1 ? t("supervisor.darshanTickets.devotees") : t("supervisor.darshanTickets.devotee")}
                      </Text>
                      {ticket.entry_mode === "marjana_mandap" ? (
                        <View style={styles.innerGateBadge}>
                          <Text style={styles.innerGateBadgeText}>{t("supervisor.darshanTickets.innerGateBadge")}</Text>
                        </View>
                      ) : (
                        <View style={styles.ticketTimeRow}>
                          <Clock size={12} color={expired ? COLORS.error : COLORS.warning} />
                          <Text style={[styles.ticketTime, expired && styles.ticketTimeExpired]}>
                            {formatTimeRemaining(ticket)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {staffUserId && (
                    <TouchableOpacity
                      style={styles.editCountButton}
                      onPress={() => handleOpenEditCount(ticket)}
                    >
                      <Pencil size={15} color={COLORS.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <Modal visible={showCreateModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.createModal}>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowCreateModal(false)}
              >
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
              <View style={styles.createModalIcon}>
                <Ticket size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.modalTitle}>{t("supervisor.darshanTickets.modalTitle")}</Text>
              {selectedSlotId && (
                <Text style={styles.modalSlotLabel}>
                  {(() => { const s = slotQuotas.find((sq) => sq.slot.id === selectedSlotId)?.slot; return s ? slotName(s) : null; })()}
                </Text>
              )}
              <Text style={styles.modalSubtitle}>
                {t("supervisor.darshanTickets.modalSubtitleStaff", { name: userName ?? "" })}
              </Text>

              <View style={styles.entryModeContainer}>
                <Text style={styles.entryModeTitle}>{t("supervisor.darshanTickets.entryModeTitle")}</Text>
                <View style={styles.entryModeOptions}>
                  <Pressable
                    style={[styles.entryModeOption, selectedEntryMode === "west_gate" && styles.entryModeOptionSelected]}
                    onPress={() => handleSelectEntryMode("west_gate")}
                  >
                    <View style={[styles.entryModeRadio, selectedEntryMode === "west_gate" && styles.entryModeRadioSelected]}>
                      {selectedEntryMode === "west_gate" && <View style={styles.entryModeRadioDot} />}
                    </View>
                    <View style={styles.entryModeTextContainer}>
                      <Text style={[styles.entryModeLabel, selectedEntryMode === "west_gate" && styles.entryModeLabelSelected]}>
                        {t("supervisor.darshanTickets.entryModeWestGate")}
                      </Text>
                      <Text style={styles.entryModeDesc}>{t("supervisor.darshanTickets.entryModeWestGateDesc")}</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={[styles.entryModeOption, selectedEntryMode === "marjana_mandap" && styles.entryModeOptionSelectedAlt]}
                    onPress={() => handleSelectEntryMode("marjana_mandap")}
                  >
                    <View style={[styles.entryModeRadio, selectedEntryMode === "marjana_mandap" && styles.entryModeRadioSelectedAlt]}>
                      {selectedEntryMode === "marjana_mandap" && <View style={styles.entryModeRadioDotAlt} />}
                    </View>
                    <View style={styles.entryModeTextContainer}>
                      <Text style={[styles.entryModeLabel, selectedEntryMode === "marjana_mandap" && styles.entryModeLabelSelectedAlt]}>
                        {t("supervisor.darshanTickets.entryModeMarjanaMandap")}
                      </Text>
                      <Text style={styles.entryModeDesc}>{t("supervisor.darshanTickets.entryModeMarjanaMandapDesc")}</Text>
                    </View>
                  </Pressable>
                </View>
              </View>

              {createError && (
                <View style={styles.errorBanner}>
                  <AlertCircle size={16} color={COLORS.error} />
                  <Text style={styles.errorText}>{createError}</Text>
                </View>
              )}

              <View style={styles.counterContainer}>
                <TouchableOpacity
                  style={[styles.counterButton, devoteeCount <= 1 && styles.counterButtonDisabled]}
                  onPress={() => setDevoteeCount(Math.max(1, devoteeCount - 1))}
                  disabled={devoteeCount <= 1}
                >
                  <Minus size={24} color={devoteeCount <= 1 ? COLORS.textMuted : COLORS.text} />
                </TouchableOpacity>
                <View style={styles.counterValue}>
                  <Text style={styles.counterNumber}>{ln(devoteeCount)}</Text>
                  <Text style={styles.counterLabel}>{devoteeCount > 1 ? t("supervisor.darshanTickets.devotees") : t("supervisor.darshanTickets.devotee")}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.counterButton, devoteeCount >= (quota?.remainingCount ?? 0) && styles.counterButtonDisabled]}
                  onPress={() => setDevoteeCount(Math.min(quota?.remainingCount ?? 1, devoteeCount + 1))}
                  disabled={devoteeCount >= (quota?.remainingCount ?? 0)}
                >
                  <Plus size={24} color={devoteeCount >= (quota?.remainingCount ?? 0) ? COLORS.textMuted : COLORS.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.remainingText}>{t("supervisor.darshanTickets.slotsRemainingToday", { count: ln(quota?.remainingCount ?? 0) })}</Text>

              <TouchableOpacity
                style={[styles.confirmButton, creating && styles.confirmButtonDisabled]}
                onPress={handleCreateTicket}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Check size={20} color="#fff" />
                    <Text style={styles.confirmButtonText}>{t("supervisor.darshanTickets.confirmCreate")}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={!!createdTicket} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.successModal}>
              <View style={styles.successIcon}>
                <Check size={40} color={COLORS.success} />
              </View>
              <Text style={styles.successTitle}>{t("supervisor.darshanTickets.ticketCreated")}</Text>
              <Text style={styles.successSubtitle}>
                {createdTicket?.entry_mode === "marjana_mandap"
                  ? t("supervisor.darshanTickets.ticketActiveAtMarjanaMandap")
                  : t("supervisor.darshanTickets.ticketActiveAtGate")}
              </Text>

              {createdTicket && (
                <>
                  {createdTicket.entry_mode === "marjana_mandap" && (
                    <View style={styles.directEntryBadge}>
                      <Text style={styles.directEntryBadgeText}>{t("supervisor.darshanTickets.entryModeDirectBadge")}</Text>
                    </View>
                  )}
                  <View style={styles.qrContainer}>
                    <QRCode
                      value={JSON.stringify(
                        createdTicket.qr_code_data ?? { entryCode: createdTicket.entry_code }
                      )}
                      size={180}
                    />
                  </View>
                  <View style={styles.ticketDetailsBox}>
                    <Text style={styles.ticketCodeLarge}>{createdTicket.entry_code}</Text>
                    <Text style={styles.ticketDevoteesLarge}>
                      {ln(createdTicket.declared_devotee_count)} {createdTicket.declared_devotee_count > 1 ? t("supervisor.darshanTickets.devotees") : t("supervisor.darshanTickets.devotee")}
                    </Text>
                    {createdTicket.expires_at && (
                      <Text style={styles.ticketExpiry}>
                        {t("supervisor.darshanTickets.validUntil", { time: new Date(createdTicket.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
                      </Text>
                    )}
                  </View>
                </>
              )}

              <TouchableOpacity style={styles.doneButton} onPress={() => setCreatedTicket(null)}>
                <Text style={styles.doneButtonText}>{t("supervisor.darshanTickets.done")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Staff edit devotee count modal */}
        <Modal visible={!!editCountTicket} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.createModal}>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setEditCountTicket(null)}
              >
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
              <View style={[styles.createModalIcon, { backgroundColor: COLORS.primaryLight }]}>
                <Pencil size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.modalTitle}>Edit Devotee Count</Text>
              <Text style={styles.modalSubtitle}>
                Ticket {editCountTicket?.entry_code} — update devotee count
                {editCountTicket?.status === "verified" ? " (verified ticket)" : ""}
              </Text>

              {editCountError && (
                <View style={styles.errorBanner}>
                  <AlertCircle size={16} color={COLORS.error} />
                  <Text style={styles.errorText}>{editCountError}</Text>
                </View>
              )}

              <View style={styles.counterContainer}>
                <TouchableOpacity
                  style={[styles.counterButton, editCount <= 1 && styles.counterButtonDisabled]}
                  onPress={() => setEditCount(Math.max(1, editCount - 1))}
                  disabled={editCount <= 1}
                >
                  <Minus size={24} color={editCount <= 1 ? COLORS.textMuted : COLORS.text} />
                </TouchableOpacity>
                <View style={styles.counterValue}>
                  <Text style={styles.counterNumber}>{editCount}</Text>
                  <Text style={styles.counterLabel}>{editCount > 1 ? t("supervisor.darshanTickets.devotees") : t("supervisor.darshanTickets.devotee")}</Text>
                </View>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => setEditCount(editCount + 1)}
                >
                  <Plus size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.confirmButton, savingCount && styles.confirmButtonDisabled]}
                onPress={handleSaveEditCount}
                disabled={savingCount}
              >
                {savingCount ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Check size={20} color="#fff" />
                    <Text style={styles.confirmButtonText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <View style={styles.sectionHeader}>
        <Ticket size={20} color={COLORS.primary} />
        <Text style={styles.sectionTitle}>{t("supervisor.darshanTickets.title")}</Text>
      </View>

      <View style={styles.quotaCard}>
        <View style={styles.quotaHeader}>
          <View style={styles.quotaIcon}>
            <Users size={20} color={COLORS.primary} />
          </View>
          <View style={styles.quotaInfo}>
            <Text style={styles.quotaUsed}>
              {ln(quota.usedCount)} / {ln(quota.maxLimit)}
            </Text>
            <Text style={styles.quotaLabel}>{t("supervisor.darshanTickets.devoteesToday")}</Text>
          </View>
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
          {t("supervisor.darshanTickets.slotsRemaining", { count: ln(quota.remainingCount) })}
        </Text>
      </View>

      {slotQuotas.length > 0 && (
        <View style={styles.slotsSection}>
          <Text style={styles.slotsSectionTitle}>{t("supervisor.darshanTickets.darshanSlots")}</Text>
          {slotQuotas.map((sq) => {
            const effectiveRemaining = Math.min(sq.remainingCount, sq.userRemainingCount);
            const isFull = effectiveRemaining === 0;
            const fillPct = Math.min(1, sq.userUsedCount / sq.slot.max_bookings_per_user);
            const barColor = isFull
              ? COLORS.error
              : fillPct >= 0.8
              ? COLORS.warning
              : COLORS.success;
            return (
              <View
                key={sq.slot.id}
                style={[styles.slotCard, isFull && styles.slotCardFull]}
              >
                <View style={styles.slotCardTop}>
                  <Text style={[styles.slotName, isFull && styles.slotNameFull]}>
                    {slotName(sq.slot)}
                  </Text>
                  {isFull ? (
                    <View style={styles.slotFullBadge}>
                      <Text style={styles.slotFullBadgeText}>{t("supervisor.darshanTickets.quotaFull")}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.slotRemaining, { color: barColor }]}>
                      {t("supervisor.darshanTickets.remaining", { count: ln(effectiveRemaining) })}
                    </Text>
                  )}
                </View>
                <View style={styles.slotProgressBg}>
                  <View
                    style={[
                      styles.slotProgressFill,
                      { width: `${fillPct * 100}%`, backgroundColor: barColor },
                    ]}
                  />
                </View>
                <Text style={[styles.slotStats, isFull && styles.slotStatsFull]}>
                  {t("supervisor.darshanTickets.slotMeta", { booked: ln(sq.userUsedCount), allowed: ln(sq.slot.max_bookings_per_user) })}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {quota.remainingCount > 0 && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => {
            setDevoteeCount(1);
            setCreateError(null);
            setShowCreateModal(true);
          }}
          activeOpacity={0.8}
        >
          <Ticket size={20} color="#fff" />
          <Text style={styles.createButtonText}>{t("supervisor.darshanTickets.createTicketBtn")}</Text>
        </TouchableOpacity>
      )}

      {pendingTickets.length > 0 && (
        <View style={styles.ticketsSection}>
          <Text style={styles.ticketsTitle}>{t("supervisor.darshanTickets.activeTickets")}</Text>
          {pendingTickets.map((ticket) => {
            const expired = isTicketExpired(ticket);
            return (
              <TouchableOpacity
                key={ticket.id}
                style={[styles.ticketCard, expired && styles.ticketCardExpired]}
                onPress={() => {
                  setSelectedTicket(ticket);
                  setShowTicketModal(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.ticketLeft}>
                  <View style={styles.ticketCodeBadge}>
                    <Text style={styles.ticketCode}>{ticket.entry_code}</Text>
                  </View>
                  <View style={styles.ticketInfo}>
                    {(ticket.slot as any)?.name && (
                      <Text style={styles.ticketSlot}>{(ticket.slot as any).name}</Text>
                    )}
                    <Text style={styles.ticketDevotees}>
                      {ln(ticket.declared_devotee_count)} {ticket.declared_devotee_count > 1 ? t("supervisor.darshanTickets.devotees") : t("supervisor.darshanTickets.devotee")}
                    </Text>
                    {ticket.entry_mode === "marjana_mandap" ? (
                      <View style={styles.innerGateBadge}>
                        <Text style={styles.innerGateBadgeText}>Inner Gate</Text>
                      </View>
                    ) : (
                      <View style={styles.ticketTimeRow}>
                        <Clock size={12} color={expired ? COLORS.error : COLORS.warning} />
                        <Text style={[styles.ticketTime, expired && styles.ticketTimeExpired]}>
                          {formatTimeRemaining(ticket)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.ticketActions}>
                  {ticket.status === "pending" && (
                    <TouchableOpacity
                      style={styles.editCountButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenEditCount(ticket);
                      }}
                    >
                      <Pencil size={15} color={COLORS.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleCancelTicket(ticket);
                    }}
                    disabled={cancelling === ticket.id}
                  >
                    {cancelling === ticket.id ? (
                      <ActivityIndicator size="small" color={COLORS.error} />
                    ) : (
                      <X size={18} color={COLORS.error} />
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {todayTickets.filter((t) => t.status !== "pending").length > 0 && (
        <View style={styles.ticketsSection}>
          <TouchableOpacity
            style={styles.historyHeader}
            onPress={() => setHistoryExpanded((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text style={styles.ticketsTitle}>{t("supervisor.darshanTickets.todayHistory")}</Text>
            <View style={styles.historyHeaderRight}>
              <View style={styles.historyCountBadge}>
                <Text style={styles.historyCountText}>
                  {todayTickets.filter((t) => t.status !== "pending").length}
                </Text>
              </View>
              {historyExpanded ? (
                <ChevronUp size={18} color={COLORS.textSecondary} />
              ) : (
                <ChevronDown size={18} color={COLORS.textSecondary} />
              )}
            </View>
          </TouchableOpacity>
          {historyExpanded &&
            todayTickets
              .filter((t) => t.status !== "pending")
              .map((ticket) => (
                <View key={ticket.id} style={styles.historyCard}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyCode}>{ticket.entry_code}</Text>
                    <Text style={styles.historyDevotees}>
                      {(() => { const c = ticket.verified_devotee_count ?? ticket.declared_devotee_count; return `${ln(c)} ${c > 1 ? t("supervisor.darshanTickets.devotees") : t("supervisor.darshanTickets.devotee")}`; })()}
                    </Text>
                  </View>
                  <View style={[styles.historyStatus, { backgroundColor: getStatusColor(ticket.status) + "20" }]}>
                    <Text style={[styles.historyStatusText, { color: getStatusColor(ticket.status) }]}>
                      {getStatusLabel(ticket.status)}
                    </Text>
                  </View>
                </View>
              ))}
        </View>
      )}

      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.createModal}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowCreateModal(false)}
            >
              <X size={24} color={COLORS.text} />
            </TouchableOpacity>
            <View style={styles.createModalIcon}>
              <Ticket size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>{t("supervisor.darshanTickets.modalTitle")}</Text>
            <Text style={styles.modalSubtitle}>
              {t("supervisor.darshanTickets.modalSubtitle")}
            </Text>

            <View style={styles.entryModeContainer}>
              <Text style={styles.entryModeTitle}>{t("supervisor.darshanTickets.entryModeTitle")}</Text>
              <View style={styles.entryModeOptions}>
                <Pressable
                  style={[styles.entryModeOption, selectedEntryMode === "west_gate" && styles.entryModeOptionSelected]}
                  onPress={() => handleSelectEntryMode("west_gate")}
                >
                  <View style={[styles.entryModeRadio, selectedEntryMode === "west_gate" && styles.entryModeRadioSelected]}>
                    {selectedEntryMode === "west_gate" && <View style={styles.entryModeRadioDot} />}
                  </View>
                  <View style={styles.entryModeTextContainer}>
                    <Text style={[styles.entryModeLabel, selectedEntryMode === "west_gate" && styles.entryModeLabelSelected]}>
                      {t("supervisor.darshanTickets.entryModeWestGate")}
                    </Text>
                    <Text style={styles.entryModeDesc}>{t("supervisor.darshanTickets.entryModeWestGateDesc")}</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={[styles.entryModeOption, selectedEntryMode === "marjana_mandap" && styles.entryModeOptionSelectedAlt]}
                  onPress={() => handleSelectEntryMode("marjana_mandap")}
                >
                  <View style={[styles.entryModeRadio, selectedEntryMode === "marjana_mandap" && styles.entryModeRadioSelectedAlt]}>
                    {selectedEntryMode === "marjana_mandap" && <View style={styles.entryModeRadioDotAlt} />}
                  </View>
                  <View style={styles.entryModeTextContainer}>
                    <Text style={[styles.entryModeLabel, selectedEntryMode === "marjana_mandap" && styles.entryModeLabelSelectedAlt]}>
                      {t("supervisor.darshanTickets.entryModeMarjanaMandap")}
                    </Text>
                    <Text style={styles.entryModeDesc}>{t("supervisor.darshanTickets.entryModeMarjanaMandapDesc")}</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            {createError && (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color={COLORS.error} />
                <Text style={styles.errorText}>{createError}</Text>
              </View>
            )}

            <View style={styles.counterContainer}>
              <TouchableOpacity
                style={[styles.counterButton, devoteeCount <= 1 && styles.counterButtonDisabled]}
                onPress={() => setDevoteeCount(Math.max(1, devoteeCount - 1))}
                disabled={devoteeCount <= 1}
              >
                <Minus size={24} color={devoteeCount <= 1 ? COLORS.textMuted : COLORS.text} />
              </TouchableOpacity>
              <View style={styles.counterValue}>
                <Text style={styles.counterNumber}>{ln(devoteeCount)}</Text>
                <Text style={styles.counterLabel}>{devoteeCount > 1 ? t("supervisor.darshanTickets.devotees") : t("supervisor.darshanTickets.devotee")}</Text>
              </View>
              <TouchableOpacity
                style={[styles.counterButton, devoteeCount >= (quota?.remainingCount ?? 0) && styles.counterButtonDisabled]}
                onPress={() => setDevoteeCount(Math.min(quota?.remainingCount ?? 1, devoteeCount + 1))}
                disabled={devoteeCount >= (quota?.remainingCount ?? 0)}
              >
                <Plus size={24} color={devoteeCount >= (quota?.remainingCount ?? 0) ? COLORS.textMuted : COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.remainingText}>{t("supervisor.darshanTickets.slotsRemainingToday", { count: ln(quota?.remainingCount ?? 0) })}</Text>

            <TouchableOpacity
              style={[styles.confirmButton, creating && styles.confirmButtonDisabled]}
              onPress={handleCreateTicket}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Check size={20} color="#fff" />
                  <Text style={styles.confirmButtonText}>{t("supervisor.darshanTickets.createTicket")}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!createdTicket} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIcon}>
              <Check size={40} color={COLORS.success} />
            </View>
            <Text style={styles.successTitle}>{t("supervisor.darshanTickets.ticketCreated")}</Text>
            <Text style={styles.successSubtitle}>
              {createdTicket?.entry_mode === "marjana_mandap"
                ? t("supervisor.darshanTickets.showQrAtMarjanaMandap")
                : t("supervisor.darshanTickets.showQrAtGate")}
            </Text>

            {createdTicket && (
              <>
                {createdTicket.entry_mode === "marjana_mandap" && (
                  <View style={styles.directEntryBadge}>
                    <Text style={styles.directEntryBadgeText}>{t("supervisor.darshanTickets.entryModeDirectBadge")}</Text>
                  </View>
                )}
                <View style={styles.qrContainer}>
                  <QRCode
                    value={
                      createdTicket.qr_code_data
                        ? JSON.stringify(createdTicket.qr_code_data)
                        : JSON.stringify({ entryCode: createdTicket.entry_code })
                    }
                    size={180}
                  />
                </View>
                <View style={styles.ticketDetailsBox}>
                  <Text style={styles.ticketCodeLarge}>{createdTicket.entry_code}</Text>
                  <Text style={styles.ticketDevoteesLarge}>
                    {ln(createdTicket.declared_devotee_count)} {createdTicket.declared_devotee_count > 1 ? t("supervisor.darshanTickets.devotees") : t("supervisor.darshanTickets.devotee")}
                  </Text>
                  {createdTicket.expires_at && (
                    <Text style={styles.ticketExpiry}>
                      {t("supervisor.darshanTickets.validUntil", { time: new Date(createdTicket.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
                    </Text>
                  )}
                </View>
              </>
            )}

            <TouchableOpacity style={styles.doneButton} onPress={() => setCreatedTicket(null)}>
              <Text style={styles.doneButtonText}>{t("supervisor.darshanTickets.done")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showTicketModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.ticketModal}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                setShowTicketModal(false);
                setSelectedTicket(null);
              }}
            >
              <X size={24} color={COLORS.text} />
            </TouchableOpacity>

            {selectedTicket && (
              <>
                <Text style={styles.modalTitle}>{t("supervisor.darshanTickets.ticketDetails")}</Text>
                <View style={styles.qrContainer}>
                  <QRCode
                    value={JSON.stringify(
                      selectedTicket.qr_code_data ?? { entryCode: selectedTicket.entry_code }
                    )}
                    size={180}
                  />
                </View>
                <View style={styles.ticketDetailsBox}>
                  <Text style={styles.ticketCodeLarge}>{selectedTicket.entry_code}</Text>
                  <Text style={styles.ticketDevoteesLarge}>
                    {ln(selectedTicket.declared_devotee_count)} {selectedTicket.declared_devotee_count > 1 ? t("supervisor.darshanTickets.devotees") : t("supervisor.darshanTickets.devotee")}
                  </Text>
                  <View style={styles.ticketTimeRow}>
                    <Clock size={14} color={isTicketExpired(selectedTicket) ? COLORS.error : COLORS.warning} />
                    <Text style={[styles.ticketExpiry, isTicketExpired(selectedTicket) && { color: COLORS.error }]}>
                      {formatTimeRemaining(selectedTicket)}
                    </Text>
                  </View>
                </View>

                {printTokenEnabled && staffMode && (
                  <View style={styles.ticketPrintRow}>
                    <TouchableOpacity
                      style={[styles.ticketPrintButton, printing && { opacity: 0.5 }]}
                      onPress={async () => {
                        setPrinting(true);
                        await printGateToken(selectedTicket, { includePhoto: printTokenIncludePhoto });
                        setPrinting(false);
                      }}
                      disabled={printing}
                      activeOpacity={0.8}
                    >
                      <Printer size={17} color={COLORS.primary} />
                      <Text style={styles.ticketPrintText}>Print Token</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.ticketShareButton, printing && { opacity: 0.5 }]}
                      onPress={async () => {
                        setPrinting(true);
                        await shareGateTokenPDF(selectedTicket, { includePhoto: printTokenIncludePhoto });
                        setPrinting(false);
                      }}
                      disabled={printing}
                      activeOpacity={0.8}
                    >
                      <Share2 size={17} color={COLORS.textSecondary} />
                      <Text style={styles.ticketShareText}>Share PDF</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.ticketModalActions}>
                  {selectedTicket.status === "pending" && (
                    <TouchableOpacity
                      style={styles.editCountTicketButton}
                      onPress={() => {
                        setShowTicketModal(false);
                        handleOpenEditCount(selectedTicket);
                      }}
                    >
                      <Pencil size={18} color={COLORS.primary} />
                      <Text style={styles.editCountTicketText}>Edit Count</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.cancelTicketButton}
                    onPress={() => {
                      setShowTicketModal(false);
                      setSelectedTicket(null);
                      handleCancelTicket(selectedTicket);
                    }}
                  >
                    <X size={18} color={COLORS.error} />
                    <Text style={styles.cancelTicketText}>{t("supervisor.darshanTickets.cancelTicket")}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Cancel confirmation modal */}
      <Modal visible={!!confirmCancelTicket} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmIconContainer}>
              <X size={28} color={COLORS.error} />
            </View>
            <Text style={styles.confirmTitle}>Cancel Ticket?</Text>
            <Text style={styles.confirmBody}>
              This will cancel ticket{" "}
              <Text style={styles.confirmCode}>{confirmCancelTicket?.entry_code}</Text>
              {" "}for{" "}
              <Text style={styles.confirmCode}>{confirmCancelTicket?.declared_devotee_count}</Text>
              {" "}devotee{(confirmCancelTicket?.declared_devotee_count ?? 1) > 1 ? "s" : ""}.
              {"\n"}This action cannot be undone.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmBtnCancel}
                onPress={() => setConfirmCancelTicket(null)}
              >
                <Text style={styles.confirmBtnCancelText}>Keep Ticket</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtnConfirm}
                onPress={handleConfirmCancel}
              >
                <Text style={styles.confirmBtnConfirmText}>Yes, Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit devotee count modal */}
      <Modal visible={!!editCountTicket} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.createModal}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setEditCountTicket(null)}
            >
              <X size={24} color={COLORS.text} />
            </TouchableOpacity>
            <View style={[styles.createModalIcon, { backgroundColor: COLORS.primaryLight }]}>
              <Pencil size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>Edit Devotee Count</Text>
            <Text style={styles.modalSubtitle}>
              Ticket {editCountTicket?.entry_code} — update how many devotees
            </Text>

            {editCountError && (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color={COLORS.error} />
                <Text style={styles.errorText}>{editCountError}</Text>
              </View>
            )}

            <View style={styles.counterContainer}>
              <TouchableOpacity
                style={[styles.counterButton, editCount <= 1 && styles.counterButtonDisabled]}
                onPress={() => setEditCount(Math.max(1, editCount - 1))}
                disabled={editCount <= 1}
              >
                <Minus size={24} color={editCount <= 1 ? COLORS.textMuted : COLORS.text} />
              </TouchableOpacity>
              <View style={styles.counterValue}>
                <Text style={styles.counterNumber}>{editCount}</Text>
                <Text style={styles.counterLabel}>{editCount > 1 ? t("supervisor.darshanTickets.devotees") : t("supervisor.darshanTickets.devotee")}</Text>
              </View>
              <TouchableOpacity
                style={[styles.counterButton, editCount >= (quota?.remainingCount ?? 0) + (editCountTicket?.declared_devotee_count ?? 0) && styles.counterButtonDisabled]}
                onPress={() => setEditCount(editCount + 1)}
              >
                <Plus size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.confirmButton, savingCount && styles.confirmButtonDisabled]}
              onPress={handleSaveEditCount}
              disabled={savingCount}
            >
              {savingCount ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Check size={20} color="#fff" />
                  <Text style={styles.confirmButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  loadingContainer: {
    padding: SPACING.lg,
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  quotaCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  quotaHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  quotaIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  quotaInfo: {
    flex: 1,
  },
  quotaUsed: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
  },
  quotaLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  quotaProgressBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: SPACING.sm,
  },
  quotaProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
  quotaRemaining: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  offlineBlockBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.warning + "15",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.warning + "30",
  },
  offlineBlockText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.warning,
  },
  quotaExhaustedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.error + "15",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.error + "30",
  },
  quotaExhaustedText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.error,
  },
  staffSlotsSection: {
    marginTop: SPACING.md,
  },
  staffSlotsSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  staffSlotCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
    ...SHADOWS.small,
  },
  staffSlotCardFull: {
    opacity: 0.6,
    borderColor: COLORS.border,
  },
  staffSlotTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  staffSlotName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
  },
  staffSlotNameFull: {
    color: COLORS.textMuted,
  },
  bookSlotBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  bookSlotBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  staffSlotStats: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  staffSlotStatsFull: {
    color: COLORS.error,
  },
  slotsSection: {
    marginTop: SPACING.md,
  },
  slotsSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  slotCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  slotCardFull: {
    opacity: 0.7,
  },
  slotCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  slotName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
  },
  slotNameFull: {
    color: COLORS.textMuted,
  },
  slotRemaining: {
    fontSize: 13,
    fontWeight: "600",
  },
  slotFullBadge: {
    backgroundColor: COLORS.error + "20",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  slotFullBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.error,
  },
  slotProgressBg: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: SPACING.xs,
  },
  slotProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  slotStats: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  slotStatsFull: {
    color: COLORS.error,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.small,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  ticketsSection: {
    marginTop: SPACING.lg,
  },
  ticketsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  historyHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  historyCountBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.xs,
  },
  historyCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  ticketCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  ticketCardExpired: {
    opacity: 0.6,
    borderColor: COLORS.error,
  },
  ticketLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  ticketCodeBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.md,
  },
  ticketCode: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 1,
  },
  ticketInfo: {
    flex: 1,
  },
  ticketSlot: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.primary,
    marginBottom: 2,
  },
  ticketDevotees: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  innerGateBadge: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "#0891b215",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#0891b230",
  },
  innerGateBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0891b2",
    letterSpacing: 0.3,
  },
  ticketTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ticketTime: {
    fontSize: 12,
    color: COLORS.warning,
    fontWeight: "500",
  },
  ticketTimeExpired: {
    color: COLORS.error,
  },
  cancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.error + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  historyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyLeft: {
    flex: 1,
  },
  historyCode: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  historyDevotees: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  historyStatus: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  createModal: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  modalClose: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  createModalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  modalSlotLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.error + "15",
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    flex: 1,
  },
  counterContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginVertical: SPACING.md,
  },
  counterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  counterButtonDisabled: {
    opacity: 0.5,
  },
  counterValue: {
    alignItems: "center",
    minWidth: 80,
  },
  counterNumber: {
    fontSize: 40,
    fontWeight: "700",
    color: COLORS.text,
  },
  counterLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  remainingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
    width: "100%",
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  successModal: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.success + "20",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  successSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: SPACING.lg,
  },
  qrContainer: {
    padding: SPACING.md,
    backgroundColor: "#fff",
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
  },
  ticketDetailsBox: {
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  ticketCodeLarge: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: 2,
  },
  ticketDevoteesLarge: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  ticketExpiry: {
    fontSize: 14,
    color: COLORS.warning,
    marginTop: SPACING.xs,
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    width: "100%",
    alignItems: "center",
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  ticketModal: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  cancelTicketButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.error + "15",
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  cancelTicketText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.error,
  },
  entryModeContainer: {
    width: "100%",
    marginBottom: SPACING.md,
  },
  entryModeTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  entryModeOptions: {
    gap: SPACING.sm,
  },
  entryModeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: SPACING.sm,
  },
  entryModeOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  entryModeOptionSelectedAlt: {
    borderColor: "#0891b2",
    backgroundColor: ("#0891b2") + "15",
  },
  entryModeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  entryModeRadioSelected: {
    borderColor: COLORS.primary,
  },
  entryModeRadioSelectedAlt: {
    borderColor: "#0891b2",
  },
  entryModeRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  entryModeRadioDotAlt: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0891b2",
  },
  entryModeTextContainer: {
    flex: 1,
  },
  entryModeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  entryModeLabelSelected: {
    color: COLORS.primary,
  },
  entryModeLabelSelectedAlt: {
    color: "#0891b2",
  },
  entryModeDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  directEntryBadge: {
    backgroundColor: ("#0891b2") + "20",
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: "#0891b2",
  },
  directEntryBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0891b2",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  ticketActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  editCountButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  ticketPrintRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    width: "100%",
    marginTop: SPACING.sm,
    marginBottom: 2,
  },
  ticketPrintButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  ticketPrintText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  ticketShareButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  ticketShareText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  ticketModalActions: {
    gap: SPACING.sm,
    width: "100%",
    marginTop: SPACING.sm,
  },
  editCountTicketButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  editCountTicketText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
  },
  confirmModal: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  confirmIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.error + "15",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  confirmBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  confirmCode: {
    fontWeight: "700",
    color: COLORS.text,
  },
  confirmButtons: {
    flexDirection: "row",
    gap: SPACING.sm,
    width: "100%",
  },
  confirmBtnCancel: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmBtnCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  confirmBtnConfirm: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    backgroundColor: COLORS.error,
  },
  confirmBtnConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
