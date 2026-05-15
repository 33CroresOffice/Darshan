import {
  saveSettingsCache,
  saveCachedSlots,
  saveLastSyncTime,
  saveServerQuota,
  setCachedTickets,
  todayString,
} from "@/lib/offline";
import {
  getDailyBookingCapPerUser,
  getTicketValidityMinutes,
  getMaxDevoteesPerDay,
  getOfflineModeEnabled,
  getDarshanSlotsEnabled,
} from "./settingsService";
import { getSebayatDailyQuota, getSebayatTodayTickets } from "./entryService";
import { getAvailableSlotsForToday, getSlotQuota } from "./slotService";

let syncing = false;

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
    const [quota, tickets] = await Promise.all([
      getSebayatDailyQuota(sebayatId, date),
      getSebayatTodayTickets(sebayatId),
    ]);

    await saveServerQuota(sebayatId, date, quota);
    await setCachedTickets(sebayatId, date, tickets);

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
