import {
  saveSettingsCache,
  saveCachedSlots,
  saveLastSyncTime,
  saveServerQuota,
  getCachedTickets,
  setCachedTickets,
  cacheGateEntries,
  saveSebayatListCache,
  saveActiveSlotSession,
  loadSebayatListCache,
  todayString,
  type CachedSebayat,
} from "@/lib/offline";
import {
  getDailyBookingCapPerUser,
  getTicketValidityMinutes,
  getMaxDevoteesPerDay,
  getOfflineModeEnabled,
  getDarshanSlotsEnabled,
} from "./settingsService";
import {
  getSebayatDailyQuota,
  getSebayatTodayTickets,
  getEntryStats,
  getPendingVerifications,
  getWestGatePendingAcknowledgments,
  getTodayEntries,
} from "./entryService";
import { getAvailableSlotsForToday, getSlotQuota } from "./slotService";
import { getActiveSession } from "./slotSessionService";
import { supabase } from "@/lib/supabase";

let syncing = false;

export async function syncSupervisorDataLocally(): Promise<void> {
  try {
    const [stats, pending, westPending, todayAll] = await Promise.all([
      getEntryStats(),
      getPendingVerifications(),
      getWestGatePendingAcknowledgments(),
      getTodayEntries(),
    ]);
    await Promise.all([
      cacheGateEntries("supervisor:stats", [stats as any]),
      cacheGateEntries("supervisor:pending", pending),
      cacheGateEntries("west_gate:pending", westPending),
      cacheGateEntries("inner_gate:pending", pending),
      cacheGateEntries("supervisor:today", todayAll),
    ]);
  } catch {
    // Silently fail — screens will use previously cached data
  }

  // Cache the approved sebayat list for offline search
  try {
    const { data } = await supabase
      .from("sebayat_registrations")
      .select("id, full_name, phone_number, temple_health_card_id, temple_id_card_number, allotment_number, photo_url, approval_status, category:categories(name)")
      .eq("approval_status", "approved")
      .order("full_name");

    if (data) {
      const sebayatList: CachedSebayat[] = data.map((s: any) => ({
        id: s.id,
        full_name: s.full_name,
        phone_number: s.phone_number,
        temple_health_card_id: s.temple_health_card_id ?? null,
        temple_id_card_number: s.temple_id_card_number ?? null,
        allotment_number: s.allotment_number ?? null,
        photo_url: s.photo_url,
        category_name: s.category?.name ?? null,
        approval_status: s.approval_status,
      }));
      await saveSebayatListCache(sebayatList);
    }
  } catch {
    // Keep previous cached list
  }

  // Cache active slot session so supervisors know if a session is running
  try {
    const session = await getActiveSession();
    if (session) {
      await saveActiveSlotSession({
        id: session.id,
        slot_id: session.slot_id,
        slot_name: (session as any).slot?.name ?? "",
        status: session.status as "active" | "ended",
        started_at: session.started_at,
        savedAt: new Date().toISOString(),
      });
    } else {
      await saveActiveSlotSession(null);
    }
  } catch {
    // Keep previous cached session state
  }

  await saveLastSyncTime();
}

export async function getSupervisorCacheSummary(): Promise<{ sebayatCount: number; lastSyncedAt: string | null }> {
  const [list, lastSync] = await Promise.all([
    loadSebayatListCache(),
    import("@/lib/offline").then((m) => m.loadLastSyncTime()),
  ]);
  return { sebayatCount: list.length, lastSyncedAt: lastSync };
}

// After outbox flush, refresh quota ledgers for any sebayats that had offline
// gate events so the local ledger aligns with the authoritative server state.
export async function reconcileQuotaLedgersAfterSync(sebayatIds: string[]): Promise<void> {
  const date = todayString();
  const unique = [...new Set(sebayatIds)];
  await Promise.allSettled(
    unique.map(async (id) => {
      const q = await getSebayatDailyQuota(id, date);
      await saveServerQuota(id, date, q);
    })
  );
}

export async function syncAllDataLocally(sebayatId: string): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const date = todayString();

    // Fetch all settings in parallel
    const [
      dailyBookingCapPerUser,
      ticketValidityMinutes,
      maxDevoteesPerDay,
      offlineModeEnabled,
      darshanSlotsEnabled,
    ] = await Promise.all([
      getDailyBookingCapPerUser(),
      getTicketValidityMinutes(),
      getMaxDevoteesPerDay(),
      getOfflineModeEnabled(),
      getDarshanSlotsEnabled(),
    ]);

    await saveSettingsCache({
      dailyBookingCapPerUser,
      ticketValidityMinutes,
      maxDevoteesPerDay,
      offlineModeEnabled,
      darshanSlotsEnabled,
      savedAt: new Date().toISOString(),
    });

    // Fetch quota and tickets in parallel
    const [quota, serverTickets] = await Promise.all([
      getSebayatDailyQuota(sebayatId, date),
      getSebayatTodayTickets(sebayatId),
    ]);

    await saveServerQuota(sebayatId, date, quota);

    // Preserve local-only tickets (offline-created, not yet reconciled) so
    // they are not wiped before the outbox flush can reconcile them.
    const existing = await getCachedTickets(sebayatId, date);
    const serverIds = new Set(serverTickets.map((t) => t.id));
    const localOnly = existing.filter((t) => t.id.startsWith("local_") && !serverIds.has(t.id));
    await setCachedTickets(sebayatId, date, [...localOnly, ...serverTickets]);

    // Fetch slots and save persistently
    const slots = await getAvailableSlotsForToday();
    const slotQuotas = await Promise.all(
      slots.map((slot) => getSlotQuota(slot, sebayatId, date))
    );
    await saveCachedSlots(sebayatId, date, slotQuotas);

    await saveLastSyncTime();
  } catch {
    // Silently fail — caller stays on last cached data
  } finally {
    syncing = false;
  }
}
