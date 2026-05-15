import { supabase } from "@/lib/supabase";
import type {
  GateEntry,
  EntryAuditLog,
  SebayatRegistration,
  SebayatQuota,
  GateLocation,
  EntryAction,
  EntryMode,
} from "@/types/database";
import type { CreateEntryResult, VerifyEntryResult, EntryStats } from "@/types";
import { getDailyBookingCapPerUser, getTicketValidityMinutes } from "./settingsService";
import { getSlotBookingCount, getUserSlotBookingCount } from "./slotService";
import { getActiveSession } from "./slotSessionService";
import { buildIdempotencyKey, getDeviceId, normaliseError } from "@/lib/offline";

function generateEntryCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function searchSebayatByPhone(
  phone: string
): Promise<SebayatRegistration | null> {
  const formattedPhone = phone.startsWith("+91") ? phone : `+91${phone}`;

  const { data, error } = await supabase
    .from("sebayat_registrations")
    .select("*, category:categories(*)")
    .eq("phone_number", formattedPhone)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (error) {
    console.error("Error searching sebayat by phone:", error);
    return null;
  }

  return data;
}

export async function searchSebayatByHealthCard(
  healthCardId: string
): Promise<SebayatRegistration | null> {
  const { data, error } = await supabase
    .from("sebayat_registrations")
    .select("*, category:categories(*)")
    .ilike("temple_health_card_id", healthCardId)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (error) {
    console.error("Error searching sebayat by health card:", error);
    return null;
  }

  return data;
}

export async function searchSebayatByTempleId(
  templeId: string
): Promise<SebayatRegistration | null> {
  const { data, error } = await supabase
    .from("sebayat_registrations")
    .select("*, category:categories(*)")
    .ilike("temple_id_card_number", templeId)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (error) {
    console.error("Error searching sebayat by temple ID:", error);
    return null;
  }

  return data;
}

export async function searchSebayatByName(
  name: string
): Promise<SebayatRegistration[]> {
  const { data, error } = await supabase
    .from("sebayat_registrations")
    .select("*, category:categories(*)")
    .ilike("full_name", `%${name}%`)
    .eq("approval_status", "approved")
    .order("full_name")
    .limit(20);

  if (error) {
    console.error("Error searching sebayat by name:", error);
    return [];
  }

  return (data || []) as SebayatRegistration[];
}

export async function searchSebayatByQR(
  qrData: string
): Promise<SebayatRegistration | null> {
  try {
    const parsed = JSON.parse(qrData);
    if (parsed.sebayatId) {
      const { data, error } = await supabase
        .from("sebayat_registrations")
        .select("*, category:categories(*)")
        .eq("id", parsed.sebayatId)
        .eq("approval_status", "approved")
        .maybeSingle();

      if (error) {
        console.error("Error searching sebayat by QR:", error);
        return null;
      }
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSebayatDailyQuota(
  sebayatId: string,
  date: string = new Date().toISOString().split("T")[0]
): Promise<SebayatQuota> {
  const maxLimit = await getDailyBookingCapPerUser();

  const { data, error } = await supabase
    .from("gate_entries")
    .select("declared_devotee_count, verified_devotee_count, status")
    .eq("sebayat_id", sebayatId)
    .eq("entry_date", date)
    .neq("status", "cancelled");

  if (error) throw new Error(error.message);

  const usedCount = (data || []).reduce((sum, entry) => {
    return sum + (entry.verified_devotee_count ?? entry.declared_devotee_count);
  }, 0);

  return {
    maxLimit,
    usedCount,
    remainingCount: Math.max(0, maxLimit - usedCount),
  };
}

export async function registerWestGateEntry(
  sebayatId: string,
  devoteeCount: number,
  supervisorId: string
): Promise<CreateEntryResult> {
  const today = new Date().toISOString().split("T")[0];
  const quota = await getSebayatDailyQuota(sebayatId, today);

  if (devoteeCount > quota.remainingCount) {
    return {
      success: false,
      message: `Cannot register ${devoteeCount} devotees. Only ${quota.remainingCount} slots remaining for today.`,
    };
  }

  let entryCode = generateEntryCode();
  let attempts = 0;
  while (attempts < 10) {
    const { data: existing } = await supabase
      .from("gate_entries")
      .select("id")
      .eq("entry_code", entryCode)
      .maybeSingle();

    if (!existing) break;
    entryCode = generateEntryCode();
    attempts++;
  }

  const qrCodeData = {
    entryCode,
    sebayatId,
    date: today,
    count: devoteeCount,
    timestamp: new Date().toISOString(),
  };

  const { data: entry, error } = await supabase
    .from("gate_entries")
    .insert({
      entry_code: entryCode,
      qr_code_data: qrCodeData,
      sebayat_id: sebayatId,
      west_gate_supervisor_id: supervisorId,
      declared_devotee_count: devoteeCount,
      status: "registered",
      entry_date: today,
    })
    .select("*, sebayat:sebayat_registrations(*, category:categories(*))")
    .single();

  if (error) {
    console.error("Error creating entry:", error);
    return { success: false, message: normaliseError(error) };
  }

  await createAuditLog(entry.id, "created", supervisorId, "west_gate", null, {
    entry_code: entryCode,
    declared_devotee_count: devoteeCount,
  });

  return {
    success: true,
    message: "Entry registered successfully",
    entry,
  };
}

export async function getEntryByCode(
  entryCode: string
): Promise<GateEntry | null> {
  const { data, error } = await supabase
    .from("gate_entries")
    .select(
      "*, sebayat:sebayat_registrations(*, category:categories(*)), west_gate_supervisor:profiles!gate_entries_west_gate_supervisor_id_fkey(full_name, phone_number)"
    )
    .eq("entry_code", entryCode.toUpperCase())
    .maybeSingle();

  if (error) {
    console.error("Error fetching entry:", error);
    return null;
  }

  return data;
}

export async function getEntryById(entryId: string): Promise<GateEntry | null> {
  const { data, error } = await supabase
    .from("gate_entries")
    .select(
      "*, sebayat:sebayat_registrations(*, category:categories(*)), west_gate_supervisor:profiles!gate_entries_west_gate_supervisor_id_fkey(full_name, phone_number)"
    )
    .eq("id", entryId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching entry:", error);
    return null;
  }

  return data;
}

export async function verifyInnerGateEntry(
  entryId: string,
  verifiedCount: number,
  supervisorId: string,
  reason?: string
): Promise<VerifyEntryResult> {
  const entry = await getEntryById(entryId);
  if (!entry) {
    return { success: false, message: "Entry not found" };
  }

  if (entry.status === "verified") {
    return { success: false, message: "Entry already verified" };
  }

  if (entry.status === "cancelled") {
    return { success: false, message: "Entry was cancelled" };
  }

  const oldValues = {
    declared_devotee_count: entry.declared_devotee_count,
    verified_devotee_count: entry.verified_devotee_count,
    status: entry.status,
  };

  const countDifference = verifiedCount - entry.declared_devotee_count;

  if (countDifference > 0) {
    const today = entry.entry_date;
    const quota = await getSebayatDailyQuota(entry.sebayat_id, today);
    if (countDifference > quota.remainingCount) {
      return {
        success: false,
        message: `Cannot increase count by ${countDifference}. Only ${quota.remainingCount} additional slots available.`,
      };
    }
  }

  const { data, error } = await supabase
    .from("gate_entries")
    .update({
      verified_devotee_count: verifiedCount,
      inner_gate_supervisor_id: supervisorId,
      inner_gate_verification_time: new Date().toISOString(),
      status: "verified",
      notes: reason || entry.notes,
    })
    .eq("id", entryId)
    .select("*, sebayat:sebayat_registrations(*, category:categories(*))")
    .single();

  if (error) {
    console.error("Error verifying entry:", error);
    return { success: false, message: normaliseError(error) };
  }

  const actionType: EntryAction =
    verifiedCount !== entry.declared_devotee_count
      ? "count_adjusted"
      : "verified";

  await createAuditLog(
    entryId,
    actionType,
    supervisorId,
    "inner_gate",
    oldValues,
    {
      verified_devotee_count: verifiedCount,
      status: "verified",
    },
    reason
  );

  return {
    success: true,
    message: "Entry verified successfully",
    entry: data,
  };
}

export async function adjustDevoteeCount(
  entryId: string,
  newCount: number,
  supervisorId: string,
  reason: string,
  gateLocation: GateLocation
): Promise<VerifyEntryResult> {
  const entry = await getEntryById(entryId);
  if (!entry) {
    return { success: false, message: "Entry not found" };
  }

  if (entry.status === "cancelled") {
    return { success: false, message: "Cannot adjust cancelled entry" };
  }

  const currentCount =
    entry.verified_devotee_count ?? entry.declared_devotee_count;
  const difference = newCount - currentCount;

  if (difference > 0) {
    const quota = await getSebayatDailyQuota(entry.sebayat_id, entry.entry_date);
    if (difference > quota.remainingCount) {
      return {
        success: false,
        message: `Cannot increase by ${difference}. Only ${quota.remainingCount} slots available.`,
      };
    }
  }

  const oldValues = {
    declared_devotee_count: entry.declared_devotee_count,
    verified_devotee_count: entry.verified_devotee_count,
  };

  const updateData: Record<string, unknown> =
    gateLocation === "west_gate"
      ? { declared_devotee_count: newCount }
      : { verified_devotee_count: newCount };

  const { data, error } = await supabase
    .from("gate_entries")
    .update(updateData)
    .eq("id", entryId)
    .select("*, sebayat:sebayat_registrations(*, category:categories(*))")
    .single();

  if (error) {
    console.error("Error adjusting count:", error);
    return { success: false, message: normaliseError(error) };
  }

  await createAuditLog(
    entryId,
    "count_adjusted",
    supervisorId,
    gateLocation,
    oldValues,
    updateData,
    reason
  );

  return {
    success: true,
    message: "Count adjusted successfully",
    entry: data,
  };
}

export async function flagEntryDiscrepancy(
  entryId: string,
  reason: string,
  supervisorId: string
): Promise<VerifyEntryResult> {
  const entry = await getEntryById(entryId);
  if (!entry) {
    return { success: false, message: "Entry not found" };
  }

  const oldValues = { status: entry.status, notes: entry.notes };

  const { data, error } = await supabase
    .from("gate_entries")
    .update({
      status: "discrepancy_flagged",
      inner_gate_supervisor_id: supervisorId,
      inner_gate_verification_time: new Date().toISOString(),
      notes: reason,
    })
    .eq("id", entryId)
    .select("*, sebayat:sebayat_registrations(*, category:categories(*))")
    .single();

  if (error) {
    console.error("Error flagging entry:", error);
    return { success: false, message: normaliseError(error) };
  }

  await createAuditLog(
    entryId,
    "flagged",
    supervisorId,
    "inner_gate",
    oldValues,
    { status: "discrepancy_flagged", notes: reason },
    reason
  );

  return {
    success: true,
    message: "Entry flagged for discrepancy",
    entry: data,
  };
}

export async function cancelEntry(
  entryId: string,
  reason: string,
  supervisorId: string,
  gateLocation: GateLocation
): Promise<VerifyEntryResult> {
  const entry = await getEntryById(entryId);
  if (!entry) {
    return { success: false, message: "Entry not found" };
  }

  if (entry.status === "verified") {
    return { success: false, message: "Cannot cancel verified entry" };
  }

  const oldValues = { status: entry.status };

  const { data, error } = await supabase
    .from("gate_entries")
    .update({
      status: "cancelled",
      notes: reason,
    })
    .eq("id", entryId)
    .select("*, sebayat:sebayat_registrations(*, category:categories(*))")
    .single();

  if (error) {
    console.error("Error cancelling entry:", error);
    return { success: false, message: normaliseError(error) };
  }

  await createAuditLog(
    entryId,
    "cancelled",
    supervisorId,
    gateLocation,
    oldValues,
    { status: "cancelled" },
    reason
  );

  return {
    success: true,
    message: "Entry cancelled",
    entry: data,
  };
}

export async function getTodayEntries(
  status?: string
): Promise<GateEntry[]> {
  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("gate_entries")
    .select(
      "*, sebayat:sebayat_registrations(full_name, photo_url, category:categories(name))"
    )
    .eq("entry_date", today)
    .order("west_gate_entry_time", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching today entries:", error);
    return [];
  }

  return data || [];
}

export async function getPendingVerifications(): Promise<GateEntry[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("gate_entries")
    .select(
      "*, sebayat:sebayat_registrations(full_name, photo_url, category:categories(name))"
    )
    .eq("entry_date", today)
    .eq("status", "registered")
    .order("west_gate_entry_time", { ascending: true });

  if (error) {
    console.error("Error fetching pending verifications:", error);
    return [];
  }

  return data || [];
}

export async function getSebayatEntries(
  sebayatId: string,
  limit: number = 20
): Promise<GateEntry[]> {
  const { data, error } = await supabase
    .from("gate_entries")
    .select("*")
    .eq("sebayat_id", sebayatId)
    .order("entry_date", { ascending: false })
    .order("west_gate_entry_time", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching sebayat entries:", error);
    return [];
  }

  return data || [];
}

export async function getEntryStats(): Promise<EntryStats> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("gate_entries")
    .select("declared_devotee_count, verified_devotee_count, status")
    .eq("entry_date", today)
    .neq("status", "cancelled");

  if (error) {
    console.error("Error fetching entry stats:", error);
    return { todayEntries: 0, todayDevotees: 0, pendingVerifications: 0 };
  }

  const entries = data || [];
  const todayEntries = entries.length;
  const todayDevotees = entries.reduce((sum, e) => {
    return sum + (e.verified_devotee_count ?? e.declared_devotee_count);
  }, 0);
  const pendingVerifications = entries.filter(
    (e) => e.status === "registered"
  ).length;

  return { todayEntries, todayDevotees, pendingVerifications };
}

export async function getEntryAuditLogs(
  entryId: string
): Promise<EntryAuditLog[]> {
  const { data, error } = await supabase
    .from("entry_audit_logs")
    .select("*, performer:profiles!entry_audit_logs_performed_by_fkey(full_name)")
    .eq("entry_id", entryId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching audit logs:", error);
    return [];
  }

  return data || [];
}

async function createAuditLog(
  entryId: string,
  actionType: EntryAction,
  performedBy: string,
  gateLocation: GateLocation,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown>,
  reason?: string
): Promise<void> {
  const { error } = await supabase.from("entry_audit_logs").insert({
    entry_id: entryId,
    action_type: actionType,
    performed_by: performedBy,
    old_values: oldValues,
    new_values: newValues,
    reason,
    gate_location: gateLocation,
  });

  if (error) {
    console.error("Error creating audit log:", error);
  }
}

export async function searchEntryByQR(
  qrData: string
): Promise<GateEntry | null> {
  try {
    const parsed = JSON.parse(qrData);
    if (parsed.entryCode) {
      return getEntryByCode(parsed.entryCode);
    }
    return null;
  } catch {
    return null;
  }
}

export async function createDarshanTicket(
  sebayatId: string,
  devoteeCount: number,
  slotId?: string | null,
  entryMode: EntryMode = "west_gate"
): Promise<CreateEntryResult> {
  const today = new Date().toISOString().split("T")[0];

  if (slotId) {
    const { data: slotData } = await supabase
      .from("darshan_slots")
      .select("max_bookings, max_bookings_per_user, name")
      .eq("id", slotId)
      .eq("is_active", true)
      .maybeSingle();

    if (slotData) {
      const [slotUsed, userSlotUsed] = await Promise.all([
        getSlotBookingCount(slotId, today),
        getUserSlotBookingCount(slotId, sebayatId, today),
      ]);

      if (slotUsed + devoteeCount > slotData.max_bookings) {
        const remaining = Math.max(0, slotData.max_bookings - slotUsed);
        return {
          success: false,
          message: `${slotData.name} can only accommodate ${remaining} more devotee${remaining === 1 ? "" : "s"} today (capacity: ${slotData.max_bookings}).`,
        };
      }

      if (userSlotUsed + devoteeCount > slotData.max_bookings_per_user) {
        const userRemaining = Math.max(0, slotData.max_bookings_per_user - userSlotUsed);
        return {
          success: false,
          message: `You can only bring ${userRemaining} more devotee${userRemaining === 1 ? "" : "s"} to ${slotData.name} (limit: ${slotData.max_bookings_per_user} per user).`,
        };
      }
    }
  }

  const quota = await getSebayatDailyQuota(sebayatId, today);

  if (devoteeCount > quota.remainingCount) {
    return {
      success: false,
      message: `Cannot create ticket for ${devoteeCount} devotees. Only ${quota.remainingCount} slots remaining for today.`,
    };
  }

  const validityMinutes = await getTicketValidityMinutes();
  const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000).toISOString();

  let entryCode = generateEntryCode();
  let attempts = 0;
  while (attempts < 10) {
    const { data: existing } = await supabase
      .from("gate_entries")
      .select("id")
      .eq("entry_code", entryCode)
      .maybeSingle();

    if (!existing) break;
    entryCode = generateEntryCode();
    attempts++;
  }

  const idempotencyKey = buildIdempotencyKey("tk");
  const deviceId = await getDeviceId();
  const clientCreatedAt = new Date().toISOString();

  const qrCodeData = {
    entryCode,
    sebayatId,
    date: today,
    count: devoteeCount,
    slotId: slotId || null,
    timestamp: clientCreatedAt,
    idempotencyKey,
    deviceId,
  };

  const { data: entry, error } = await supabase
    .from("gate_entries")
    .insert({
      entry_code: entryCode,
      qr_code_data: qrCodeData,
      sebayat_id: sebayatId,
      slot_id: slotId || null,
      west_gate_supervisor_id: null,
      declared_devotee_count: devoteeCount,
      status: entryMode === "marjana_mandap" ? "registered" : "pending",
      entry_date: today,
      west_gate_entry_time: null,
      created_by_sebayat: true,
      expires_at: expiresAt,
      entry_mode: entryMode,
      idempotency_key: idempotencyKey,
      device_id: deviceId,
      client_created_at: clientCreatedAt,
    })
    .select("*, sebayat:sebayat_registrations(*, category:categories(*)), slot:darshan_slots(*)")
    .single();

  if (error) {
    console.error("Error creating ticket:", error);
    return { success: false, message: normaliseError(error) };
  }

  return {
    success: true,
    message: "Darshan ticket created successfully",
    entry,
  };
}

export async function updateDarshanTicketCount(
  entryId: string,
  newCount: number,
  sebayatId: string
): Promise<{ success: boolean; message: string }> {
  const { data: entry, error: fetchError } = await supabase
    .from("gate_entries")
    .select("id, status, sebayat_id, declared_devotee_count, entry_date")
    .eq("id", entryId)
    .maybeSingle();

  if (fetchError || !entry) {
    return { success: false, message: "Ticket not found" };
  }

  if (entry.sebayat_id !== sebayatId) {
    return { success: false, message: "Not authorized to edit this ticket" };
  }

  if (entry.status !== "pending") {
    return { success: false, message: "Only pending tickets can be edited" };
  }

  if (newCount < 1) {
    return { success: false, message: "Count must be at least 1" };
  }

  const diff = newCount - entry.declared_devotee_count;
  if (diff > 0) {
    const quota = await getSebayatDailyQuota(sebayatId, entry.entry_date);
    if (diff > quota.remainingCount) {
      return {
        success: false,
        message: `Cannot increase by ${diff}. Only ${quota.remainingCount} slots remaining today.`,
      };
    }
  }

  const { error } = await supabase
    .from("gate_entries")
    .update({ declared_devotee_count: newCount })
    .eq("id", entryId);

  if (error) {
    return { success: false, message: normaliseError(error) };
  }

  return { success: true, message: "Ticket updated successfully" };
}

export async function updateDarshanTicketCountByStaff(
  entryId: string,
  newCount: number,
  staffUserId: string
): Promise<{ success: boolean; message: string }> {
  const { data: entry, error: fetchError } = await supabase
    .from("gate_entries")
    .select("id, status, sebayat_id, declared_devotee_count, verified_devotee_count, entry_date")
    .eq("id", entryId)
    .maybeSingle();

  if (fetchError || !entry) {
    return { success: false, message: "Ticket not found" };
  }

  if (entry.status === "cancelled") {
    return { success: false, message: "Cannot edit a cancelled ticket" };
  }

  if (newCount < 1) {
    return { success: false, message: "Count must be at least 1" };
  }

  const currentCount = entry.verified_devotee_count ?? entry.declared_devotee_count;
  const diff = newCount - currentCount;
  if (diff > 0) {
    const quota = await getSebayatDailyQuota(entry.sebayat_id, entry.entry_date);
    if (diff > quota.remainingCount) {
      return {
        success: false,
        message: `Cannot increase by ${diff}. Only ${quota.remainingCount} slots remaining today.`,
      };
    }
  }

  const isVerified = entry.status === "verified";
  const updateField = isVerified ? "verified_devotee_count" : "declared_devotee_count";

  const { error } = await supabase
    .from("gate_entries")
    .update({ [updateField]: newCount })
    .eq("id", entryId);

  if (error) {
    return { success: false, message: normaliseError(error) };
  }

  await createAuditLog(
    entryId,
    "count_adjusted",
    staffUserId,
    isVerified ? "inner_gate" : "west_gate",
    { [updateField]: currentCount },
    { [updateField]: newCount },
    "Staff adjustment from ticket screen"
  );

  return { success: true, message: "Ticket updated successfully" };
}

export async function cancelDarshanTicket(
  entryId: string,
  sebayatId: string
): Promise<{ success: boolean; message: string }> {
  const { data: entry, error: fetchError } = await supabase
    .from("gate_entries")
    .select("id, status, sebayat_id")
    .eq("id", entryId)
    .maybeSingle();

  if (fetchError || !entry) {
    return { success: false, message: "Ticket not found" };
  }

  if (entry.sebayat_id !== sebayatId) {
    return { success: false, message: "Not authorized to cancel this ticket" };
  }

  if (entry.status !== "pending") {
    return { success: false, message: "Only pending tickets can be cancelled" };
  }

  const { error } = await supabase
    .from("gate_entries")
    .update({ status: "cancelled" })
    .eq("id", entryId);

  if (error) {
    console.error("Error cancelling ticket:", error);
    return { success: false, message: normaliseError(error) };
  }

  return { success: true, message: "Ticket cancelled successfully" };
}

export async function acknowledgeWestGateEntry(
  entryId: string,
  supervisorId: string
): Promise<CreateEntryResult> {
  const entry = await getEntryById(entryId);
  if (!entry) {
    return { success: false, message: "Ticket not found" };
  }

  if (entry.entry_mode === "marjana_mandap") {
    return {
      success: false,
      message: "This ticket is for Majana Mandapa direct entry. West Gate entry is not allowed.",
    };
  }

  if (entry.status !== "pending") {
    return { success: false, message: "Ticket has already been processed" };
  }

  if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
    return { success: false, message: "Ticket has expired" };
  }

  if (entry.slot_id) {
    const activeSession = await getActiveSession();
    if (!activeSession) {
      return {
        success: false,
        message: "No slot is currently active. Ask a supervisor to start the slot before processing tickets.",
      };
    }
    if (activeSession.slot_id !== entry.slot_id) {
      const activeSlotName = (activeSession.slot as any)?.name || "another slot";
      return {
        success: false,
        message: `This ticket is for a different slot. Currently active slot is "${activeSlotName}".`,
      };
    }
  }

  const { data, error } = await supabase
    .from("gate_entries")
    .update({
      status: "registered",
      west_gate_supervisor_id: supervisorId,
      west_gate_entry_time: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select("*, sebayat:sebayat_registrations(*, category:categories(*))")
    .single();

  if (error) {
    console.error("Error acknowledging entry:", error);
    return { success: false, message: normaliseError(error) };
  }

  await createAuditLog(entryId, "created", supervisorId, "west_gate", null, {
    entry_code: entry.entry_code,
    declared_devotee_count: entry.declared_devotee_count,
    acknowledged_from_pending: true,
  });

  return {
    success: true,
    message: "Entry acknowledged successfully",
    entry: data,
  };
}

export async function getSebayatPendingTickets(
  sebayatId: string
): Promise<GateEntry[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("gate_entries")
    .select("*, slot:darshan_slots(id, name)")
    .eq("sebayat_id", sebayatId)
    .eq("entry_date", today)
    .in("status", ["pending", "registered"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return data || [];
}

export async function getSebayatTodayTickets(
  sebayatId: string
): Promise<GateEntry[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("gate_entries")
    .select("*, slot:darshan_slots(id, name)")
    .eq("sebayat_id", sebayatId)
    .eq("entry_date", today)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return data || [];
}

export async function getWestGatePendingAcknowledgments(): Promise<GateEntry[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("gate_entries")
    .select(
      "*, sebayat:sebayat_registrations(full_name, photo_url, temple_health_card_id, category:categories(name)), slot:darshan_slots(id, name)"
    )
    .eq("entry_date", today)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching pending acknowledgments:", error);
    return [];
  }

  return data || [];
}

export async function getSebayatEntriesByDateRange(
  sebayatId: string,
  fromDate: string,
  toDate: string
): Promise<GateEntry[]> {
  const { data, error } = await supabase
    .from("gate_entries")
    .select("*")
    .eq("sebayat_id", sebayatId)
    .gte("entry_date", fromDate)
    .lte("entry_date", toDate)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return data || [];
}

export function isTicketExpired(entry: GateEntry): boolean {
  if (!entry.expires_at) return false;
  return new Date(entry.expires_at) < new Date();
}

export function getTicketTimeRemaining(entry: GateEntry): number {
  if (!entry.expires_at) return 0;
  const remaining = new Date(entry.expires_at).getTime() - Date.now();
  return Math.max(0, remaining);
}

export async function createDarshanTicketForStaff(
  userId: string,
  devoteeCount: number,
  slotId?: string | null
): Promise<CreateEntryResult> {
  const { data: registration, error } = await supabase
    .from("sebayat_registrations")
    .select("id")
    .eq("user_id", userId)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (error || !registration) {
    return {
      success: false,
      message: "No approved sebayat registration found for this user",
    };
  }

  return createDarshanTicket(registration.id, devoteeCount, slotId);
}
