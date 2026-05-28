import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useLocalizedNumber } from "@/hooks/useLocalizedNumber";
import { useSlotName } from "@/hooks/useSlotName";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Pressable,
  Image,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  IdCard,
  Users,
  X,
  Plus,
  Minus,
  Ticket,
  Clock,
  Check,
  CircleAlert as AlertCircle,
  CalendarClock,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import { FeedbackModal } from "@/components/feedback/FeedbackModal";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "@/context/AuthContext";
import { AdminHeader } from "@/components/layout/AdminHeader";
import {
  getSebayatPendingTickets,
  getSebayatTodayTickets,
  getTicketTimeRemaining,
  isTicketExpired,
} from "@/services/entryService";
import {
  createTicketResilient,
  cancelTicketResilient,
  getEffectiveQuota,
} from "@/services/offlineEntryService";
import { getAvailableSlotsForToday, getSlotQuota } from "@/services/slotService";
import { syncAllDataLocally } from "@/services/backgroundSyncService";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { connectivity, normaliseError, saveCachedSlots, loadLastSyncTime, setCachedTickets, getCachedTickets } from "@/lib/offline";
import { getActiveGumastasBySebayat } from "@/services/gumastaService";
import { isGumastaEnabledForSebayat } from "@/services/settingsService";
import { useRouter } from "expo-router";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";
import type { SebayatQuota, GateEntry, SlotQuota, EntryMode, Gumasta } from "@/types/database";

const CACHE_QUOTA_KEY = (id: string, date: string) => `@sebayat:quota:${id}:${date}`;
const CACHE_PENDING_KEY = (id: string, date: string) => `@sebayat:pending:${id}:${date}`;
const CACHE_TODAY_KEY = (id: string, date: string) => `@sebayat:today:${id}:${date}`;
const CACHE_SLOTS_KEY = (id: string) => `@sebayat:slots:${id}`;

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

async function writeCache(key: string, value: unknown) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const tabBarHeight = useBottomTabBarHeight();
  const ln = useLocalizedNumber();
  const slotName = useSlotName();
  const router = useRouter();
  const { registration, profile, refreshRegistration } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [quota, setQuota] = useState<SebayatQuota | null>(null);
  // Pre-load quota from dated cache before the first async call completes, eliminating null→value flicker
  const quotaPreloaded = useRef(false);
  useEffect(() => {
    if (!registration?.id || quotaPreloaded.current) return;
    quotaPreloaded.current = true;
    const todayDate = new Date().toISOString().split("T")[0];
    readCache<SebayatQuota>(CACHE_QUOTA_KEY(registration.id, todayDate)).then((cached) => {
      if (cached) setQuota((prev) => prev ?? cached);
    });
  }, [registration?.id]);
  const [showQRModal, setShowQRModal] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<GateEntry | null>(null);
  const [pendingTickets, setPendingTickets] = useState<GateEntry[]>([]);
  const [todayTickets, setTodayTickets] = useState<GateEntry[]>([]);
  // Pre-load tickets from cache to eliminate [] → data flicker
  const ticketsPreloaded = useRef(false);
  useEffect(() => {
    if (!registration?.id || ticketsPreloaded.current) return;
    ticketsPreloaded.current = true;
    const todayDate = new Date().toISOString().split("T")[0];
    Promise.all([
      readCache<GateEntry[]>(CACHE_TODAY_KEY(registration.id, todayDate)),
      getCachedTickets(registration.id, todayDate),
    ]).then(([cachedToday, offlineToday]) => {
      const merged = new Map([
        ...((cachedToday ?? []).map((t) => [t.id, t] as [string, GateEntry])),
        ...(offlineToday.map((t) => [t.id, t] as [string, GateEntry])),
      ]);
      const list = Array.from(merged.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (list.length > 0) {
        setTodayTickets((prev) => prev.length > 0 ? prev : list);
        setPendingTickets((prev) =>
          prev.length > 0 ? prev : list.filter((t) => t.entry_date === todayDate && (t.status === "pending" || t.status === "registered"))
        );
      }
    });
  }, [registration?.id]);
  const [devoteeCount, setDevoteeCount] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<GateEntry | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [slotQuotas, setSlotQuotas] = useState<SlotQuota[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [showSlots, setShowSlots] = useState(false);
  const [selectedEntryMode, setSelectedEntryMode] = useState<EntryMode>("west_gate");
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => connectivity.isOnline());
  const [gumastas, setGumastas] = useState<Gumasta[]>([]);
  const [gumastaEnabled, setGumastaEnabled] = useState(false);

  const loadQuota = useCallback(async () => {
    if (!registration?.id) return;
    const todayDate = new Date().toISOString().split("T")[0];
    // Paint today's cache immediately; skip if we have no dated entry (avoids painting stale yesterday data)
    const cachedQuota = await readCache<SebayatQuota>(CACHE_QUOTA_KEY(registration.id, todayDate));
    if (cachedQuota) {
      setQuota((prev) => {
        if (prev && prev.usedCount === cachedQuota.usedCount && prev.maxLimit === cachedQuota.maxLimit) return prev;
        return cachedQuota;
      });
    }
    // Always attempt network — getEffectiveQuota handles offline internally
    try {
      const q = await getEffectiveQuota(registration.id);
      setQuota((prev) => {
        if (prev && prev.usedCount === q.usedCount && prev.maxLimit === q.maxLimit && prev.remainingCount === q.remainingCount) return prev;
        return q;
      });
      await writeCache(CACHE_QUOTA_KEY(registration.id, todayDate), q);
    } catch {
      // Leave the cached value that was painted above
    }
  }, [registration?.id]);

  // Cancellation token: each loadTickets call gets a unique id; only the latest
  // call is allowed to commit state/cache writes. This prevents concurrent calls
  // (useFocusEffect + Realtime + post-create) from interleaving and flickering.
  const ticketCallId = useRef(0);

  const loadTickets = useCallback(async () => {
    if (!registration?.id) return;
    const callId = ++ticketCallId.current;
    const todayDate = new Date().toISOString().split("T")[0];

    // Read both caches: UI cache and offline ticket cache
    const [cachedToday, offlineToday] = await Promise.all([
      readCache<GateEntry[]>(CACHE_TODAY_KEY(registration.id, todayDate)),
      getCachedTickets(registration.id, todayDate),
    ]);

    // Merge: offline cache wins on duplicate ids
    const uiById = new Map((cachedToday ?? []).map((t) => [t.id, t]));
    const offlineById = new Map(offlineToday.map((t) => [t.id, t]));
    const mergedMap = new Map([...uiById, ...offlineById]);
    const cachedMerged = Array.from(mergedMap.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    // Paint cache immediately (stale-while-revalidate)
    if (callId !== ticketCallId.current) return;
    if (cachedMerged.length > 0) {
      setTodayTickets((prev) => {
        const prevIds = prev.map((t) => t.id + t.status + (t.gumasta_id ?? "")).join(",");
        const nextIds = cachedMerged.map((t) => t.id + t.status + (t.gumasta_id ?? "")).join(",");
        return prevIds === nextIds ? prev : cachedMerged;
      });
      setPendingTickets((prev) => {
        const filtered = cachedMerged.filter(
          (tk) => tk.entry_date === todayDate && (tk.status === "pending" || tk.status === "registered")
        );
        const prevIds = prev.map((t) => t.id + t.status + (t.gumasta_id ?? "")).join(",");
        const nextIds = filtered.map((t) => t.id + t.status + (t.gumasta_id ?? "")).join(",");
        return prevIds === nextIds ? prev : filtered;
      });
    }

    // Always attempt server fetch — try/catch handles offline gracefully
    try {
      const [serverPending, serverToday] = await Promise.all([
        getSebayatPendingTickets(registration.id),
        getSebayatTodayTickets(registration.id),
      ]);

      // Discard if a newer call has started
      if (callId !== ticketCallId.current) return;

      // Keep local-only tickets the server doesn't know about yet.
      // Also filter by entry_code so a synced offline ticket (local_xxx vs real UUID,
      // same entry_code) doesn't appear twice once the server has it.
      const serverIds = new Set(serverToday.map((t) => t.id));
      const serverCodes = new Set(serverToday.map((t) => t.entry_code));
      const localOnly = cachedMerged.filter(
        (t) => t.id.startsWith("local_") && !serverIds.has(t.id) && !serverCodes.has(t.entry_code)
      );
      const finalToday = [...localOnly, ...serverToday];

      const serverPendingIds = new Set(serverPending.map((t) => t.id));
      const serverPendingCodes = new Set(serverPending.map((t) => t.entry_code));
      const extraPending = localOnly.filter(
        (t) => t.status === "pending" && !serverPendingIds.has(t.id) && !serverPendingCodes.has(t.entry_code)
      );
      const finalPending = [...extraPending, ...serverPending];

      setTodayTickets((prev) => {
        const prevSig = prev.map((t) => t.id + t.status + (t.gumasta_id ?? "")).join(",");
        const nextSig = finalToday.map((t) => t.id + t.status + (t.gumasta_id ?? "")).join(",");
        return prevSig === nextSig ? prev : finalToday;
      });
      setPendingTickets((prev) => {
        const prevSig = prev.map((t) => t.id + t.status + (t.gumasta_id ?? "")).join(",");
        const nextSig = finalPending.map((t) => t.id + t.status + (t.gumasta_id ?? "")).join(",");
        return prevSig === nextSig ? prev : finalPending;
      });

      await Promise.all([
        writeCache(CACHE_TODAY_KEY(registration.id, todayDate), finalToday),
        writeCache(CACHE_PENDING_KEY(registration.id, todayDate), finalPending),
        setCachedTickets(registration.id, todayDate, finalToday),
      ]);
    } catch {
      // Network failed — cache was already painted above, nothing to do
      if (callId !== ticketCallId.current) return;
    }
  }, [registration?.id]);

  const loadSlots = useCallback(async () => {
    if (!registration?.id) return;
    // Paint from cache immediately
    const cachedSlots = await readCache<SlotQuota[]>(CACHE_SLOTS_KEY(registration.id));
    if (cachedSlots) setSlotQuotas(cachedSlots);
    try {
      if (connectivity.isOnline()) {
        const today = new Date().toISOString().slice(0, 10);
        const data = await getAvailableSlotsForToday();
        const quotas = await Promise.all(
          data.map((slot) => getSlotQuota(slot, registration.id, today))
        );
        setSlotQuotas(quotas);
        // Save to both UI cache and persistent offline slots cache
        await writeCache(CACHE_SLOTS_KEY(registration.id), quotas);
        await saveCachedSlots(registration.id, today, quotas);
      }
    } catch {}
  }, [registration?.id]);

  useEffect(() => {
    return connectivity.subscribe(() => {
      const online = connectivity.isOnline();
      setIsOnline(online);
      if (online) {
        loadQuota();
        loadTickets();
        loadSlots();
      }
    });
  }, [loadQuota, loadTickets, loadSlots]);

  // One-time migration: clear old undated cache keys so stale yesterday data never bleeds in
  useEffect(() => {
    if (!registration?.id) return;
    const id = registration.id;
    Promise.all([
      AsyncStorage.removeItem(`@sebayat:quota:${id}`),
      AsyncStorage.removeItem(`@sebayat:pending:${id}`),
      AsyncStorage.removeItem(`@sebayat:today:${id}`),
    ]).catch(() => {});
  }, [registration?.id]);

  useFocusEffect(
    useCallback(() => {
      if (connectivity.isOnline()) refreshRegistration();
      loadQuota();
      loadTickets();
      loadSlots();
      loadLastSyncTime().then(setLastSyncTime);
    }, [refreshRegistration, loadQuota, loadTickets, loadSlots])
  );

  useEffect(() => {
    if (!registration?.id) return;
    isGumastaEnabledForSebayat(registration.id).then(setGumastaEnabled).catch(() => {});
    getActiveGumastasBySebayat(registration.id).then(setGumastas).catch(() => {});
  }, [registration?.id]);

  const [tickTock, setTickTock] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTickTock((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const realtimeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!registration?.id) return;
    const channel = supabase
      .channel(`sebayat-entries-${registration.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "gate_entries",
        filter: `sebayat_id=eq.${registration.id}`,
      }, () => {
        if (!connectivity.isOnline()) return;
        if (realtimeDebounce.current) clearTimeout(realtimeDebounce.current);
        realtimeDebounce.current = setTimeout(() => {
          loadQuota();
          loadTickets();
        }, 500);
      })
      .subscribe();
    return () => {
      if (realtimeDebounce.current) clearTimeout(realtimeDebounce.current);
      supabase.removeChannel(channel);
    };
  }, [registration?.id, loadQuota, loadTickets]);

  const qrData = registration
    ? JSON.stringify({
        sebayatId: registration.id,
        name: registration.full_name,
        healthCard: registration.temple_health_card_id,
        phone: profile?.phone_number?.slice(-4),
      })
    : "";

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshRegistration(), loadQuota(), loadTickets(), loadSlots()]);
    setRefreshing(false);
  };

  const selectedSlotQuota = slotQuotas.find((q) => q.slot.id === selectedSlotId) ?? null;
  const allSlotsFull = slotQuotas.length > 0 && slotQuotas.every((q) => q.userRemainingCount === 0);

  const handleCreateTicket = async () => {
    if (!registration?.id || devoteeCount < 1) return;
    if (slotQuotas.length > 0 && !selectedSlotId) {
      setCreateError(t("app.home.slotRequired"));
      return;
    }
    if (selectedSlotQuota && devoteeCount > selectedSlotQuota.userRemainingCount) {
      setCreateError(t("app.home.quotaWarning", { quota: selectedSlotQuota.userRemainingCount }));
      return;
    }
    setCreating(true);
    setCreateError(null);

    try {
      const result = await createTicketResilient(registration.id, devoteeCount, selectedSlotId, selectedEntryMode);
      if (result.success && result.entry) {
        const todayDate = new Date().toISOString().split("T")[0];
        // createTicketResilient already wrote to the offline cache via upsertCachedTicket.
        // Sync the UI cache from offline cache so loadTickets sees the new ticket.
        const freshOffline = await getCachedTickets(registration.id, todayDate);
        await writeCache(CACHE_TODAY_KEY(registration.id, todayDate), freshOffline);

        setCreatedTicket(result.entry);
        setShowCreateModal(false);
        setSelectedEntryMode("west_gate");
        await Promise.all([loadQuota(), loadTickets()]);
        loadLastSyncTime().then(setLastSyncTime);
      } else {
        setCreateError(typeof result.message === "string" ? result.message : normaliseError(result.message));
      }
    } catch (err) {
      setCreateError(normaliseError(err));
    }
    setCreating(false);
  };

  const handleCancelTicket = async (ticketId: string) => {
    if (!registration?.id) return;
    setCancelling(ticketId);

    const ticket = [...pendingTickets, ...todayTickets].find((t) => t.id === ticketId);
    try {
      if (ticket) {
        const result = await cancelTicketResilient(ticket, registration.id);
        if (result.success) {
          await Promise.all([loadQuota(), loadTickets()]);
        }
      }
    } catch {}
    setCancelling(null);
  };

  const openTicketDetails = (ticket: GateEntry) => {
    setSelectedTicket(ticket);
    setShowTicketModal(true);
  };

  const handleSelectEntryMode = (mode: EntryMode) => {
    setSelectedEntryMode(mode);
  };

  const formatTimeRemaining = (ticket: GateEntry) => {
    const remaining = getTicketTimeRemaining(ticket);
    if (remaining <= 0) return t("app.home.expired");
    const minutes = Math.floor(remaining / 60000);
    if (minutes < 60) return t("app.home.minutesLeft", { minutes });
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return t("app.home.hoursLeft", { hours, mins });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return COLORS.warning;
      case "registered":
        return COLORS.primary;
      case "verified":
        return COLORS.success;
      case "cancelled":
        return COLORS.textMuted;
      case "discrepancy_flagged":
        return COLORS.error;
      default:
        return COLORS.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return t("app.home.statusPending");
      case "registered": return t("app.home.statusAtInnerGate");
      case "verified": return t("app.home.statusVerified");
      case "cancelled": return t("app.home.statusCancelled");
      case "discrepancy_flagged": return t("app.home.statusFlagged");
      default: return status;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerWrapper}>
        <AdminHeader
          showSignOut={false}
          showSettings={false}
          notificationsRoute="/(app)/notifications"
          nameOverride={registration?.full_name || profile?.full_name || "Sebayat"}
          phoneOverride={profile?.phone_number ?? undefined}
          onQrPress={registration?.approval_status === "approved" ? () => setShowQRModal(true) : undefined}
          onFeedbackPress={() => setFeedbackVisible(true)}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {registration?.approval_status === "approved" && !quota && !isOnline && (
          <View style={styles.section}>
            <View style={styles.offlinePlaceholderCard}>
              <AlertCircle size={20} color={COLORS.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.offlinePlaceholderTitle}>{t("app.home.offlineNoDataTitle")}</Text>
                <Text style={styles.offlinePlaceholderBody}>{t("app.home.offlineNoDataBody")}</Text>
              </View>
            </View>
          </View>
        )}

        {registration?.approval_status === "approved" && quota && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("app.home.todayQuota")}</Text>
            <View style={styles.quotaCard}>
              <View style={styles.quotaHeader}>
                <View style={styles.quotaIcon}>
                  <Users size={20} color={COLORS.primary} />
                </View>
                <View style={styles.quotaInfo}>
                  <Text style={styles.quotaUsed}>
                    {ln(quota.usedCount)} / {ln(quota.maxLimit)}
                  </Text>
                  <Text style={styles.quotaLabel}>{t("app.home.devoteesToday")}</Text>
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
                {t("app.home.slotsRemaining", { count: quota.remainingCount })}
              </Text>
              {!isOnline && lastSyncTime && (
                <Text style={styles.lastSyncText}>
                  {t("app.home.lastSynced", {
                    time: new Date(lastSyncTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  })}
                </Text>
              )}
            </View>

            {quota.remainingCount > 0 && !allSlotsFull && (
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => {
                  setDevoteeCount(1);
                  setCreateError(null);
                  setSelectedSlotId(null);
                  setSelectedEntryMode("west_gate");
                  setShowCreateModal(true);
                }}
                activeOpacity={0.8}
              >
                <Ticket size={20} color="#fff" />
                <Text style={styles.createButtonText}>{t("app.home.createTicket")}</Text>
              </TouchableOpacity>
            )}
            {(quota.remainingCount === 0 || allSlotsFull) && (
              <View style={styles.quotaFullBanner}>
                <AlertCircle size={16} color={COLORS.error} />
                <Text style={styles.quotaFullBannerText}>{t("app.home.dailyQuotaFull")}</Text>
              </View>
            )}
          </View>
        )}

        {registration?.approval_status === "approved" && slotQuotas.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("app.home.slotAvailability")}</Text>
            <View style={styles.slotCollapsibleCard}>
              <TouchableOpacity
                style={styles.slotCollapsibleCardHeader}
                onPress={() => setShowSlots((v) => !v)}
                activeOpacity={0.75}
              >
                <View style={styles.slotHeaderLeft}>
                  <View style={styles.slotStatusDot} />
                  <View>
                    <Text style={styles.slotCardTitle}>{t("app.home.todaySlots")}</Text>
                    <Text style={styles.slotCardMeta}>
                      {t("app.home.slotCapacityBooked", {
                        booked: ln(slotQuotas.reduce((a, s) => a + s.userUsedCount, 0)),
                      })}
                    </Text>
                  </View>
                </View>
                {showSlots ? (
                  <ChevronUp size={18} color={COLORS.textSecondary} />
                ) : (
                  <ChevronDown size={18} color={COLORS.textSecondary} />
                )}
              </TouchableOpacity>

              {showSlots && (
                <View style={styles.slotCollapseBody}>
                  {slotQuotas.map((sq, idx) => {
                    const booked = sq.userUsedCount;
                    const capacity = sq.slot.max_bookings_per_user;
                    const fillRatio = capacity > 0 ? Math.min(1, booked / capacity) : 0;
                    const isFull = sq.userRemainingCount <= 0;
                    const fillColor = isFull
                      ? COLORS.error
                      : sq.userRemainingCount <= Math.ceil(capacity * 0.2)
                      ? COLORS.warning
                      : COLORS.success;
                    const isLast = idx === slotQuotas.length - 1;
                    return (
                      <TouchableOpacity
                        key={sq.slot.id}
                        style={[styles.slotInnerRow, isLast && styles.slotInnerRowLast]}
                        onPress={() => {
                          if (!isFull) {
                            setDevoteeCount(1);
                            setCreateError(null);
                            setSelectedSlotId(sq.slot.id);
                            setSelectedEntryMode("west_gate");
                            setShowCreateModal(true);
                          }
                        }}
                        activeOpacity={isFull ? 1 : 0.65}
                        disabled={isFull}
                      >
                        <View style={styles.dashSlotTop}>
                          <Text style={styles.dashSlotName}>{slotName(sq.slot)}</Text>
                          {isFull ? (
                            <View style={styles.slotFullBadge}>
                              <Text style={styles.slotFullBadgeText}>{t("app.home.quotaFull")}</Text>
                            </View>
                          ) : (
                            <Text style={[styles.dashSlotRemaining, { color: fillColor }]}>
                              {t("app.home.remaining", { count: sq.userRemainingCount })}
                            </Text>
                          )}
                        </View>
                        <View style={styles.dashSlotBar}>
                          <View style={[styles.dashSlotBarFill, { width: `${fillRatio * 100}%`, backgroundColor: fillColor }]} />
                        </View>
                        <Text style={styles.dashSlotMeta}>
                          {t("app.home.slotMeta", { booked: ln(booked), allowed: ln(capacity) })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}

        {registration?.approval_status === "approved" && pendingTickets.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t("app.home.activeTickets")}</Text>
              {gumastaEnabled && (
                <TouchableOpacity
                  style={styles.assignGumastaBtn}
                  onPress={() => router.push("/(app)/assign-gumasta")}
                >
                  <Text style={styles.assignGumastaBtnText}>{t("gumasta.assignGumasta")}</Text>
                </TouchableOpacity>
              )}
            </View>
            {pendingTickets.map((ticket) => {
              const expired = isTicketExpired(ticket);
              const isRegistered = ticket.status === "registered";
              const isInnerGate = ticket.entry_mode === "marjana_mandap";
              return (
                <TouchableOpacity
                  key={ticket.id}
                  style={[styles.ticketCard, expired && styles.ticketCardExpired, isRegistered && styles.ticketCardRegistered]}
                  onPress={() => openTicketDetails(ticket)}
                  activeOpacity={0.7}
                >
                  <View style={styles.ticketLeft}>
                    <View style={styles.ticketCodeBadge}>
                      <Text style={styles.ticketCode}>{ticket.entry_code}</Text>
                    </View>
                    <View style={styles.ticketInfo}>
                      {(ticket.slot as any)?.name && (
                        <Text style={styles.ticketSlotName}>{slotName(ticket.slot as any)}</Text>
                      )}
                      <Text style={styles.ticketDevotees}>
                        {ln(ticket.declared_devotee_count)} {ticket.declared_devotee_count > 1 ? t("app.home.devotees") : t("app.home.devotee")}
                      </Text>
                      {isInnerGate ? (
                        <View style={styles.innerGateBadge}>
                          <Text style={styles.innerGateBadgeText}>{t("app.home.innerGateBadge")}</Text>
                        </View>
                      ) : isRegistered ? (
                        <View style={styles.ticketAtGateRow}>
                          <Check size={12} color={COLORS.success} />
                          <Text style={styles.ticketAtGateText}>{t("app.home.atWestGate")}</Text>
                        </View>
                      ) : null}
                      {gumastaEnabled && ticket.gumasta_id ? (
                        <View style={styles.gumastaLabel}>
                          <Text style={styles.gumastaLabelText} numberOfLines={1}>
                            {gumastas.find((g) => g.id === ticket.gumasta_id)?.name ?? t("gumasta.assignedTo")}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  {!isRegistered && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleCancelTicket(ticket.id);
                      }}
                      disabled={cancelling === ticket.id}
                    >
                      {cancelling === ticket.id ? (
                        <ActivityIndicator size="small" color={COLORS.error} />
                      ) : (
                        <X size={18} color={COLORS.error} />
                      )}
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}


        {registration?.category_name && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("app.home.category")}</Text>
            <View style={styles.categoryCard}>
              <View style={styles.categoryIcon}>
                <User size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.categoryName}>
                {registration.category_name}
              </Text>
            </View>
          </View>
        )}

        {(registration?.temple_health_card_number ||
          registration?.temple_health_card_relation) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("app.home.templeHealthCard")}</Text>
            <View style={styles.detailsCard}>
              {registration?.temple_health_card_number && (
                <>
                  <DetailRow
                    icon={<IdCard size={18} color={COLORS.warning} />}
                    label={t("app.home.cardNumber")}
                    value={registration.temple_health_card_number}
                  />
                  {registration?.temple_health_card_relation && (
                    <View style={styles.divider} />
                  )}
                </>
              )}
              {registration?.temple_health_card_relation && (
                <DetailRow
                  icon={<User size={18} color={COLORS.warning} />}
                  label={t("app.home.relation")}
                  value={registration.temple_health_card_relation}
                />
              )}
            </View>
          </View>
        )}

      </ScrollView>

      {profile && (
        <FeedbackModal
          visible={feedbackVisible}
          onClose={() => setFeedbackVisible(false)}
          userId={profile.id}
          role="sebayat"
        />
      )}

      {showQRModal && <Modal visible animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.qrModal}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowQRModal(false)}
            >
              <X size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t("app.home.qrTitle")}</Text>
            <Text style={styles.modalSubtitle}>
              {t("app.home.qrSubtitle")}
            </Text>
            <View style={styles.qrContainer}>
              <QRCode value={qrData} size={220} />
            </View>
            <View style={styles.modalInfo}>
              <Text style={styles.modalName}>{registration?.full_name}</Text>
              {registration?.temple_health_card_id && (
                <Text style={styles.modalHealthCard}>
                  HC: {registration.temple_health_card_id}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Modal>}

      {showCreateModal && <Modal visible animationType="slide" transparent>
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
            <Text style={styles.modalTitle}>{t("app.home.createTicket")}</Text>
            <Text style={styles.modalSubtitle}>
              {t("app.home.selectSlotPrompt")}
            </Text>

            <View style={styles.entryModeContainer}>
              <Text style={styles.entryModeTitle}>{t("app.home.entryModeTitle")}</Text>
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
                      {t("app.home.entryModeWestGate")}
                    </Text>
                    <Text style={styles.entryModeDesc}>{t("app.home.entryModeWestGateDesc")}</Text>
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
                      {t("app.home.entryModeMarjanaMandap")}
                    </Text>
                    <Text style={styles.entryModeDesc}>{t("app.home.entryModeMarjanaMandapDesc")}</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            {slotQuotas.length > 0 && (
              <View style={styles.slotSection}>
                <View style={styles.slotSectionHeader}>
                  <CalendarClock size={14} color={COLORS.primary} />
                  <Text style={styles.slotSectionLabel}>{t("app.home.darshanSlot")}</Text>
                  <View style={styles.slotRequiredBadge}>
                    <Text style={styles.slotRequiredText}>{t("app.home.required")}</Text>
                  </View>
                </View>
                <View style={styles.slotList}>
                  {slotQuotas.map((sq) => {
                    const isSelected = selectedSlotId === sq.slot.id;
                    const isFull = sq.userRemainingCount === 0;
                    const fillPct = sq.slot.max_bookings_per_user > 0
                      ? Math.min(1, sq.userUsedCount / sq.slot.max_bookings_per_user)
                      : 0;
                    return (
                      <TouchableOpacity
                        key={sq.slot.id}
                        style={[
                          styles.slotRow,
                          isSelected && styles.slotRowSelected,
                          isFull && styles.slotRowFull,
                        ]}
                        onPress={() => !isFull && setSelectedSlotId(sq.slot.id)}
                        activeOpacity={isFull ? 1 : 0.7}
                        disabled={isFull}
                      >
                        <View style={[styles.slotRowIndicator, isSelected && styles.slotRowIndicatorSelected, isFull && styles.slotRowIndicatorFull]} />
                        <View style={styles.slotRowContent}>
                          <View style={styles.slotRowTop}>
                            <Text style={[styles.slotRowName, isSelected && styles.slotRowNameSelected, isFull && styles.slotRowNameFull]}>
                              {slotName(sq.slot)}
                            </Text>
                            {isFull ? (
                              <View style={styles.slotFullBadge}>
                                <Text style={styles.slotFullBadgeText}>{t("app.home.quotaFull")}</Text>
                              </View>
                            ) : (
                              <Text style={[styles.slotQuotaText, isSelected && styles.slotQuotaTextSelected]}>
                                {t("app.home.remaining", { count: sq.userRemainingCount })}
                              </Text>
                            )}
                          </View>
                          <View style={styles.slotProgressBg}>
                            <View style={[styles.slotProgressFill, { width: `${fillPct * 100}%` as any }, isFull && styles.slotProgressFull, isSelected && !isFull && styles.slotProgressSelected]} />
                          </View>
                          <Text style={[styles.slotQuotaSubText, isFull && styles.slotQuotaSubTextFull]}>
                            {t("app.home.slotMeta", { booked: ln(sq.userUsedCount), allowed: ln(sq.slot.max_bookings_per_user) })}
                          </Text>
                        </View>
                        {isSelected && !isFull && (
                          <View style={styles.slotRowCheck}>
                            <Check size={14} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {createError && (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color={COLORS.error} />
                <Text style={styles.errorText}>{createError}</Text>
              </View>
            )}

            {(() => {
              const slotCap = selectedSlotQuota ? selectedSlotQuota.userRemainingCount : (quota?.remainingCount ?? 0);
              const maxAllowed = Math.min(quota?.remainingCount ?? 0, slotCap);
              const isAtMax = devoteeCount >= maxAllowed;
              const isAtMin = devoteeCount <= 1;
              return (
                <View style={styles.counterContainer}>
                  <TouchableOpacity
                    style={[styles.counterButton, isAtMin && styles.counterButtonDisabled]}
                    onPress={() => setDevoteeCount(Math.max(1, devoteeCount - 1))}
                    disabled={isAtMin}
                  >
                    <Minus size={24} color={isAtMin ? COLORS.textMuted : COLORS.text} />
                  </TouchableOpacity>
                  <View style={styles.counterValue}>
                    <Text style={styles.counterNumber}>{ln(devoteeCount)}</Text>
                    <Text style={styles.counterLabel}>{devoteeCount > 1 ? t("app.home.devotees") : t("app.home.devotee")}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.counterButton, isAtMax && styles.counterButtonDisabled]}
                    onPress={() => setDevoteeCount(Math.min(maxAllowed, devoteeCount + 1))}
                    disabled={isAtMax}
                  >
                    <Plus size={24} color={isAtMax ? COLORS.textMuted : COLORS.text} />
                  </TouchableOpacity>
                </View>
              );
            })()}

            <Text style={styles.remainingText}>
              {t("app.home.slotsRemaining", { count: quota?.remainingCount ?? 0 })}
            </Text>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (creating || (slotQuotas.length > 0 && !selectedSlotId)) && styles.confirmButtonDisabled,
              ]}
              onPress={handleCreateTicket}
              disabled={creating || (slotQuotas.length > 0 && !selectedSlotId)}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Check size={20} color="#fff" />
                  <Text style={styles.confirmButtonText}>{t("app.home.createTicketBtn")}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>}

      {!!createdTicket && <Modal visible animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIcon}>
              <Check size={40} color={COLORS.success} />
            </View>
            <Text style={styles.successTitle}>{t("app.home.ticketCreated")}</Text>
            <Text style={styles.successSubtitle}>
              {createdTicket?.entry_mode === "marjana_mandap"
                ? t("app.home.showQrAtMarjanaMandap")
                : t("app.home.showQrAtGate")}
            </Text>

            {createdTicket && (
              <>
                {createdTicket.entry_mode === "marjana_mandap" && (
                  <View style={styles.directEntryBadge}>
                    <Text style={styles.directEntryBadgeText}>{t("app.home.entryModeDirectBadge")}</Text>
                  </View>
                )}
                <View style={styles.qrContainer}>
                  <QRCode
                    value={JSON.stringify({ entryCode: createdTicket.entry_code })}
                    size={180}
                  />
                </View>
                <View style={styles.ticketDetailsBox}>
                  <Text style={styles.ticketCodeLarge}>{createdTicket.entry_code}</Text>
                  <Text style={styles.ticketDevoteesLarge}>
                    {ln(createdTicket.declared_devotee_count)} {createdTicket.declared_devotee_count > 1 ? t("app.home.devotees") : t("app.home.devotee")}
                  </Text>
                  {createdTicket.expires_at && (
                    <Text style={styles.ticketExpiry}>
                      {t("app.home.validUntil", { time: new Date(createdTicket.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
                    </Text>
                  )}
                </View>
              </>
            )}

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setCreatedTicket(null)}
            >
              <Text style={styles.doneButtonText}>{t("common.done")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>}

      {showTicketModal && (
        <Modal visible animationType="fade" transparent>
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
                  <Text style={styles.modalTitle}>{t("app.home.ticketDetails")}</Text>
                  <View style={styles.qrContainer}>
                    <QRCode
                      value={JSON.stringify({ entryCode: selectedTicket.entry_code })}
                      size={180}
                    />
                  </View>
                  <View style={styles.ticketDetailsBox}>
                    <Text style={styles.ticketCodeLarge}>{selectedTicket.entry_code}</Text>
                    <Text style={styles.ticketDevoteesLarge}>
                      {ln(selectedTicket.declared_devotee_count)} {selectedTicket.declared_devotee_count > 1 ? t("app.home.devotees") : t("app.home.devotee")}
                    </Text>
                  </View>

                  {selectedTicket.status !== "registered" && (
                    <TouchableOpacity
                      style={styles.cancelTicketButton}
                      onPress={() => {
                        handleCancelTicket(selectedTicket.id);
                        setShowTicketModal(false);
                        setSelectedTicket(null);
                      }}
                    >
                      <X size={18} color={COLORS.error} />
                      <Text style={styles.cancelTicketText}>Cancel Ticket</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        </Modal>
      )}

    </SafeAreaView>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconContainer}>{icon}</View>
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.border,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.surface,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  profilePhone: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  assignGumastaBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
  },
  assignGumastaBtnText: {
    fontSize: 11,
    color: COLORS.surface,
    fontWeight: "600",
  },
  gumastaLabel: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "rgba(13, 148, 136, 0.1)",
    borderRadius: RADIUS.sm,
    alignSelf: "flex-start",
  },
  gumastaLabelText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: "500",
    maxWidth: 120,
  },
  collapsibleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  collapsibleCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  collapsibleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  collapsibleDateText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 2,
  },
  collapsibleSummaryText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  collapseChevron: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: "300",
    marginLeft: SPACING.sm,
  },
  historyList: {
    marginTop: SPACING.sm,
  },
  detailsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
  },
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.xs,
  },
  categoryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.text,
  },
  offlinePlaceholderCard: {
    backgroundColor: COLORS.warning + "12",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.warning + "40",
  },
  offlinePlaceholderTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  offlinePlaceholderBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
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
  lastSyncText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  qrModal: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  modalClose: {
    position: "absolute",
    top: SPACING.md,
    right: SPACING.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
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
  modalInfo: {
    alignItems: "center",
  },
  modalName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  modalHealthCard: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
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
  quotaFullBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: "#FEE2E2",
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  quotaFullBannerText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.error,
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
  ticketCardRegistered: {
    borderColor: COLORS.success,
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
  ticketAtGateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ticketAtGateText: {
    fontSize: 11,
    color: COLORS.success,
    fontWeight: "600",
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
  ticketSlotName: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
    marginBottom: 2,
  },
  ticketDevotees: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
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
    marginBottom: SPACING.xs,
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
  createModal: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  createModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
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
    gap: SPACING.lg,
    marginVertical: SPACING.lg,
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
    fontSize: 48,
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
  slotSection: {
    width: "100%",
    marginBottom: SPACING.md,
  },
  slotSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: SPACING.sm,
  },
  slotSectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
  },
  slotRequiredBadge: {
    backgroundColor: COLORS.error + "18",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  slotRequiredText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.error,
  },
  slotList: {
    gap: 8,
  },
  dashSlotCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  dashSlotTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  dashSlotName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  dashSlotRemaining: {
    fontSize: 14,
    fontWeight: "700",
  },
  dashSlotBar: {
    height: 5,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  dashSlotBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  dashSlotMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  slotCollapsibleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOWS.small,
  },
  slotCollapsibleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
  },
  slotHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  slotStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  slotCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 2,
  },
  slotCardMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  slotCollapseBody: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  slotInnerRow: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  slotInnerRowLast: {
    borderBottomWidth: 0,
    paddingBottom: SPACING.xs,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  slotRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  slotRowIndicator: {
    width: 4,
    alignSelf: "stretch",
    backgroundColor: COLORS.border,
  },
  slotRowIndicatorSelected: {
    backgroundColor: COLORS.primary,
  },
  slotRowContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
  },
  slotRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  slotRowName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  slotRowNameSelected: {
    color: COLORS.primary,
  },
  slotRowNameFull: {
    color: COLORS.textMuted,
  },
  slotRowFull: {
    opacity: 0.55,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
  },
  slotRowIndicatorFull: {
    backgroundColor: COLORS.textMuted,
  },
  slotQuotaText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.success,
  },
  slotQuotaTextSelected: {
    color: COLORS.primary,
  },
  slotFullBadge: {
    backgroundColor: COLORS.error + "20",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  slotFullBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.error,
  },
  slotProgressBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: 5,
    overflow: "hidden",
  },
  slotProgressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.success,
  },
  slotProgressFull: {
    backgroundColor: COLORS.error,
  },
  slotProgressSelected: {
    backgroundColor: COLORS.primary,
  },
  slotQuotaSubText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "400",
  },
  slotQuotaSubTextFull: {
    color: COLORS.error + "99",
  },
  slotRowCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
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
    backgroundColor: "#0891b215",
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
    backgroundColor: "#0891b220",
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
});
