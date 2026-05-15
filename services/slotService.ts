import { supabase } from "@/lib/supabase";
import { normaliseError } from "@/lib/offline";
import { getDarshanSlotsEnabled } from "@/services/settingsService";
import type { DarshanSlot, SlotQuota } from "@/types/database";

export async function getAllSlots(): Promise<DarshanSlot[]> {
  const { data, error } = await supabase
    .from("darshan_slots")
    .select("*")
    .order("start_time");

  if (error) {
    console.error("Error fetching slots:", error);
    return [];
  }

  return data || [];
}

export async function getActiveSlots(): Promise<DarshanSlot[]> {
  const { data, error } = await supabase
    .from("darshan_slots")
    .select("*")
    .eq("is_active", true)
    .order("start_time");

  if (error) {
    console.error("Error fetching active slots:", error);
    return [];
  }

  return data || [];
}

export async function getAvailableSlotsForToday(): Promise<DarshanSlot[]> {
  const enabled = await getDarshanSlotsEnabled();
  if (!enabled) return [];

  const today = new Date().toISOString().split("T")[0];

  const [activeSlots, endedSessionsResult] = await Promise.all([
    getActiveSlots(),
    supabase
      .from("slot_sessions")
      .select("slot_id")
      .eq("date", today)
      .eq("status", "ended"),
  ]);

  if (endedSessionsResult.error) {
    console.error("Error fetching ended sessions:", endedSessionsResult.error);
    return activeSlots;
  }

  const endedSlotIds = new Set(
    (endedSessionsResult.data || []).map((s) => s.slot_id as string)
  );

  return activeSlots.filter((slot) => !endedSlotIds.has(slot.id));
}

export async function createSlot(
  slotData: {
    name: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    max_bookings: number;
    max_bookings_per_user: number;
  },
  userId: string
): Promise<{ success: boolean; message: string; slot?: DarshanSlot }> {
  if (!slotData.name.trim()) {
    return { success: false, message: "Slot name is required" };
  }

  if (slotData.start_time >= slotData.end_time) {
    return { success: false, message: "End time must be after start time" };
  }

  if (slotData.duration_minutes < 1) {
    return { success: false, message: "Duration must be at least 1 minute" };
  }

  if (slotData.max_bookings < 1) {
    return { success: false, message: "Max bookings must be at least 1" };
  }

  if (slotData.max_bookings_per_user < 1) {
    return { success: false, message: "Max bookings per user must be at least 1" };
  }

  const { data, error } = await supabase
    .from("darshan_slots")
    .insert({
      ...slotData,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating slot:", error);
    return { success: false, message: normaliseError(error) };
  }

  return { success: true, message: "Slot created successfully", slot: data };
}

export async function updateSlot(
  id: string,
  slotData: Partial<{
    name: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    max_bookings: number;
    max_bookings_per_user: number;
    is_active: boolean;
  }>
): Promise<{ success: boolean; message: string; slot?: DarshanSlot }> {
  if (
    slotData.start_time !== undefined &&
    slotData.end_time !== undefined &&
    slotData.start_time >= slotData.end_time
  ) {
    return { success: false, message: "End time must be after start time" };
  }

  const { data, error } = await supabase
    .from("darshan_slots")
    .update(slotData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating slot:", error);
    return { success: false, message: normaliseError(error) };
  }

  return { success: true, message: "Slot updated successfully", slot: data };
}

export async function toggleSlotActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("darshan_slots")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    console.error("Error toggling slot status:", error);
    return { success: false, message: normaliseError(error) };
  }

  return { success: true, message: isActive ? "Slot activated" : "Slot deactivated" };
}

export async function getSlotBookingCount(
  slotId: string,
  date: string
): Promise<number> {
  const { data, error } = await supabase
    .from("gate_entries")
    .select("declared_devotee_count")
    .eq("slot_id", slotId)
    .eq("entry_date", date)
    .neq("status", "cancelled");

  if (error) {
    console.error("Error fetching slot booking count:", error);
    return 0;
  }

  return (data || []).reduce((sum, e) => sum + (e.declared_devotee_count ?? 0), 0);
}

export async function getUserSlotBookingCount(
  slotId: string,
  sebayatId: string,
  date: string
): Promise<number> {
  const { data, error } = await supabase
    .from("gate_entries")
    .select("declared_devotee_count")
    .eq("slot_id", slotId)
    .eq("sebayat_id", sebayatId)
    .eq("entry_date", date)
    .neq("status", "cancelled");

  if (error) {
    console.error("Error fetching user slot booking count:", error);
    return 0;
  }

  return (data || []).reduce((sum, e) => sum + (e.declared_devotee_count ?? 0), 0);
}

export async function getDailyUserBookingCount(
  sebayatId: string,
  date: string
): Promise<number> {
  const { data, error } = await supabase
    .from("gate_entries")
    .select("declared_devotee_count")
    .eq("sebayat_id", sebayatId)
    .eq("entry_date", date)
    .neq("status", "cancelled");

  if (error) {
    console.error("Error fetching daily user booking count:", error);
    return 0;
  }

  return (data || []).reduce((sum, e) => sum + (e.declared_devotee_count ?? 0), 0);
}

export async function getSlotQuota(
  slot: DarshanSlot,
  sebayatId: string,
  date: string
): Promise<SlotQuota> {
  const [slotUsed, userUsed] = await Promise.all([
    getSlotBookingCount(slot.id, date),
    getUserSlotBookingCount(slot.id, sebayatId, date),
  ]);

  return {
    slot,
    totalCapacity: slot.max_bookings,
    usedCount: slotUsed,
    remainingCount: Math.max(0, slot.max_bookings - slotUsed),
    userUsedCount: userUsed,
    userRemainingCount: Math.max(0, slot.max_bookings_per_user - userUsed),
  };
}
