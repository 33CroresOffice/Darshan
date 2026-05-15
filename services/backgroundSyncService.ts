import {
  saveSettingsCache,
  saveCachedSlots,
  saveLastSyncTime,
  saveServerQuota,
  getCachedTickets,
  setCachedTickets,
  cacheGateEntries,
  todayString,
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
