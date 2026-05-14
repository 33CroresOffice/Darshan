import { supabase } from "@/lib/supabase";
import {
  buildIdempotencyKey,
  buildLocalTicket,
  connectivity,
  enqueue,
  flushOutbox,
  generateEntryCode,
  generateUUID,
  getCachedTickets,
  getDeviceId,
  loadServerQuota,
  saveServerQuota,
  setCachedTickets,
  todayString,
  upsertCachedTicket,
} from "@/lib/offline";
import {
  createDarshanTicket,
  cancelDarshanTicket,
  getSebayatDailyQuota,
  getSebayatTodayTickets,
  updateDarshanTicketCount,
  isTicketExpired as isExpired,
} from "./entryService";
import { getTicketValidityMinutes, getOfflineModeEnabled } from "./settingsService";
import type { GateEntry, EntryMode, SebayatQuota } from "@/types/database";
import type { CreateEntryResult } from "@/types";

// Compute effective remaining offline by subtracting any local-only tickets
// (those still in the outbox / cache that haven't synced) from the server's
// last-known used count.
export async function getEffectiveQuota(sebayatId: string): Promise<SebayatQuota> {
  const date = todayString();

  if (connectivity.isOnline()) {
    try {
      const q = await getSebayatDailyQuota(sebayatId, date);
      await saveServerQuota(sebayatId, date, q);
      // Merge with any not-yet-synced local tickets
      const local = await getCachedTickets(sebayatId, date);
      const localPending = local
        .filter((t) => t.status === "pending" && t.id === t.entry_code) // synthetic local id
        .reduce((sum, t) => sum + t.declared_devotee_count, 0);
      const used = q.usedCount;
      const remaining = Math.max(0, q.maxLimit - used - localPending);
      return { maxLimit: q.maxLimit, usedCount: used + localPending, remainingCount: remaining };
    } catch {
      // fall through to offline path
    }
  }

  const ledger = await loadServerQuota(sebayatId, date);
  const local = await getCachedTickets(sebayatId, date);
  const localPending = local
    .filter((t) => t.status !== "cancelled" && t.id.startsWith("local_"))
    .reduce((sum, t) => sum + t.declared_devotee_count, 0);
  const maxLimit = ledger?.maxLimit ?? 20;
  const serverUsed = ledger?.serverUsed ?? 0;
  const remaining = Math.max(0, maxLimit - serverUsed - localPending);
  return { maxLimit, usedCount: serverUsed + localPending, remainingCount: remaining };
}

// Online path delegates to existing service. If offline, we mint locally,
// enqueue a reconcile op, and return the synthetic ticket immediately.
export async function createTicketResilient(
  sebayatId: string,
  devoteeCount: number,
  slotId: string | null | undefined,
  entryMode: EntryMode
): Promise<CreateEntryResult> {
  const date = todayString();

  if (connectivity.isOnline()) {
    const result = await createDarshanTicket(sebayatId, devoteeCount, slotId ?? null, entryMode);
    if (result.success && result.entry) {
      await upsertCachedTicket(sebayatId, date, result.entry);
      try {
        const q = await getSebayatDailyQuota(sebayatId, date);
        await saveServerQuota(sebayatId, date, q);
      } catch {}
    }
    return result;
  }

  // Check if offline queuing is allowed before falling back to local path
  let offlineModeEnabled = true;
  try {
    offlineModeEnabled = await getOfflineModeEnabled();
  } catch {}
  if (!offlineModeEnabled) {
    return {
      success: false,
      message: "No internet connection. Offline mode has been disabled by the administrator. Please connect to the internet and try again.",
    };
  }

  // Offline path — enforce local quota
  const quota = await getEffectiveQuota(sebayatId);
  if (devoteeCount > quota.remainingCount) {
    return {
      success: false,
      message: `Cannot create ticket for ${devoteeCount} devotees. Only ${quota.remainingCount} slots remaining offline.`,
    };
  }

  const idempotencyKey = buildIdempotencyKey("tk");
  const entryCode = generateEntryCode();
  const deviceId = await getDeviceId();
  const clientCreatedAt = new Date().toISOString();
  let validityMinutes = 240;
  try {
    validityMinutes = await getTicketValidityMinutes();
  } catch {}
  const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000).toISOString();

  const qrCodeData = {
    entryCode,
    sebayatId,
    date,
    count: devoteeCount,
    slotId: slotId || null,
    timestamp: clientCreatedAt,
    idempotencyKey,
    offline: true,
    deviceId,
  };

  const localTicket = buildLocalTicket({
    idempotencyKey: `local_${idempotencyKey}`,
    entryCode,
    sebayatId,
    slotId: slotId || null,
    declaredCount: devoteeCount,
    entryDate: date,
    entryMode,
    expiresAt,
    clientCreatedAt,
    deviceId,
    qrCodeData,
  });

  await upsertCachedTicket(sebayatId, date, localTicket);
  await enqueue("ticket.create", {
    idempotencyKey,
    entryCode,
    qrCodeData,
    sebayatId,
    slotId: slotId || null,
    declaredCount: devoteeCount,
    entryDate: date,
    entryMode,
    expiresAt,
    clientCreatedAt,
    deviceId,
  });

  return {
    success: true,
    message: "Ticket created offline. It will sync automatically when connection returns.",
    entry: localTicket,
  };
}

export async function cancelTicketResilient(
  ticket: GateEntry,
  sebayatId: string
): Promise<{ success: boolean; message: string }> {
  if (connectivity.isOnline() && !ticket.id.startsWith("local_")) {
    const r = await cancelDarshanTicket(ticket.id, sebayatId);
    if (r.success) {
      const list = (await getCachedTickets(sebayatId, ticket.entry_date)).map((t) =>
        t.id === ticket.id ? { ...t, status: "cancelled" as const } : t
      );
      await setCachedTickets(sebayatId, ticket.entry_date, list);
    }
    return r;
  }

  let offlineModeEnabled = true;
  try {
    offlineModeEnabled = await getOfflineModeEnabled();
  } catch {}
  if (!offlineModeEnabled) {
    return {
      success: false,
      message: "No internet connection. Offline mode has been disabled by the administrator.",
    };
  }

  // Offline cancel — mark locally and enqueue
  const list = (await getCachedTickets(sebayatId, ticket.entry_date)).map((t) =>
    t.id === ticket.id ? { ...t, status: "cancelled" as const } : t
  );
  await setCachedTickets(sebayatId, ticket.entry_date, list);
  const idempotencyKey =
    (ticket.qr_code_data as Record<string, unknown> | null)?.idempotencyKey ||
    ticket.id.replace(/^local_/, "");
  await enqueue("ticket.cancel", { idempotencyKey });
  return { success: true, message: "Ticket cancelled offline. Will sync." };
}

export async function editTicketCountResilient(
  ticket: GateEntry,
  sebayatId: string,
  newCount: number
): Promise<{ success: boolean; message: string }> {
  if (connectivity.isOnline() && !ticket.id.startsWith("local_")) {
    const r = await updateDarshanTicketCount(ticket.id, newCount, sebayatId);
    if (r.success) {
      const list = (await getCachedTickets(sebayatId, ticket.entry_date)).map((t) =>
        t.id === ticket.id ? { ...t, declared_devotee_count: newCount } : t
      );
      await setCachedTickets(sebayatId, ticket.entry_date, list);
    }
    return r;
  }

  let offlineModeEnabled = true;
  try {
    offlineModeEnabled = await getOfflineModeEnabled();
  } catch {}
  if (!offlineModeEnabled) {
    return {
      success: false,
      message: "No internet connection. Offline mode has been disabled by the administrator.",
    };
  }

  const quota = await getEffectiveQuota(sebayatId);
  const diff = newCount - ticket.declared_devotee_count;
  if (diff > 0 && diff > quota.remainingCount) {
    return {
      success: false,
      message: `Cannot increase by ${diff}. Only ${quota.remainingCount} slots remaining offline.`,
    };
  }

  const list = (await getCachedTickets(sebayatId, ticket.entry_date)).map((t) =>
    t.id === ticket.id ? { ...t, declared_devotee_count: newCount } : t
  );
  await setCachedTickets(sebayatId, ticket.entry_date, list);
  const idempotencyKey =
    (ticket.qr_code_data as Record<string, unknown> | null)?.idempotencyKey ||
    ticket.id.replace(/^local_/, "");
  await enqueue("ticket.edit_count", { idempotencyKey, newCount });
  return { success: true, message: "Updated offline. Will sync." };
}

export async function getTodayTicketsResilient(sebayatId: string): Promise<GateEntry[]> {
  const date = todayString();
  if (connectivity.isOnline()) {
    try {
      const tickets = await getSebayatTodayTickets(sebayatId);
      // Merge in any local-only tickets that haven't synced yet
      const cached = await getCachedTickets(sebayatId, date);
      const localOnly = cached.filter((t) => t.id.startsWith("local_"));
      const merged = [...localOnly, ...tickets];
      await setCachedTickets(sebayatId, date, merged);
      return merged;
    } catch {}
  }
  return getCachedTickets(sebayatId, date);
}

// Resolve a scanned QR payload to a ticket — either a server lookup, or by
// trusting the embedded offline payload when the server has nothing yet.
export interface ResolvedQrTicket {
  source: "server" | "offline_payload" | "cache";
  idempotencyKey: string | null;
  entryCode: string;
  declaredCount: number | null;
  sebayatId: string | null;
  ticket?: GateEntry;
}

export async function resolveScannedTicket(qrData: string): Promise<ResolvedQrTicket | null> {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(qrData);
  } catch {
    return null;
  }
  const entryCode = (parsed?.entryCode as string | undefined)?.toUpperCase();
  if (!entryCode) return null;

  if (connectivity.isOnline()) {
    try {
      const { data } = await supabase
        .from("gate_entries")
        .select(
          "*, sebayat:sebayat_registrations(*, category:categories(*)), west_gate_supervisor:profiles!gate_entries_west_gate_supervisor_id_fkey(full_name, phone_number)"
        )
        .eq("entry_code", entryCode)
        .maybeSingle();
      if (data) {
        return {
          source: "server",
          idempotencyKey: (data as GateEntry).idempotency_key ?? null,
          entryCode,
          declaredCount: (data as GateEntry).declared_devotee_count,
          sebayatId: (data as GateEntry).sebayat_id,
          ticket: data as GateEntry,
        };
      }
    } catch {}
  }

  // Offline: trust the embedded payload
  const idempotencyKey = (parsed?.idempotencyKey as string) ?? null;
  if (idempotencyKey) {
    return {
      source: "offline_payload",
      idempotencyKey,
      entryCode,
      declaredCount: (parsed?.count as number) ?? null,
      sebayatId: (parsed?.sebayatId as string) ?? null,
    };
  }
  return null;
}

export async function recordWestGateEventResilient(args: {
  idempotencyKey: string;
  supervisorId: string;
  actualCount: number;
}): Promise<{ success: boolean; message: string; offline: boolean }> {
  const deviceId = await getDeviceId();
  const capturedAt = new Date().toISOString();

  if (connectivity.isOnline()) {
    const { error } = await supabase.rpc("apply_west_gate_event", {
      p_idempotency_key: args.idempotencyKey,
      p_supervisor_id: args.supervisorId,
      p_actual_count: args.actualCount,
      p_captured_at: capturedAt,
      p_device_id: deviceId,
    });
    if (!error) return { success: true, message: "West gate verified", offline: false };
    // If ticket not synced yet, fall through to enqueue
  }

  let offlineModeWest = true;
  try {
    offlineModeWest = await getOfflineModeEnabled();
  } catch {}
  if (!offlineModeWest) {
    return {
      success: false,
      message: "No internet connection. Offline mode has been disabled by the administrator.",
      offline: false,
    };
  }

  await enqueue("gate.west_verify", {
    idempotencyKey: args.idempotencyKey,
    supervisorId: args.supervisorId,
    actualCount: args.actualCount,
    capturedAt,
    deviceId,
  });
  return { success: true, message: "Captured offline. Will sync.", offline: true };
}

export async function recordInnerGateEventResilient(args: {
  idempotencyKey: string;
  supervisorId: string;
  verifiedCount: number;
  reason?: string;
}): Promise<{ success: boolean; message: string; offline: boolean }> {
  const deviceId = await getDeviceId();
  const capturedAt = new Date().toISOString();

  if (connectivity.isOnline()) {
    const { error } = await supabase.rpc("apply_inner_gate_event", {
      p_idempotency_key: args.idempotencyKey,
      p_supervisor_id: args.supervisorId,
      p_verified_count: args.verifiedCount,
      p_captured_at: capturedAt,
      p_device_id: deviceId,
      p_reason: args.reason ?? null,
    });
    if (!error) return { success: true, message: "Inner gate verified", offline: false };
  }

  let offlineModeInner = true;
  try {
    offlineModeInner = await getOfflineModeEnabled();
  } catch {}
  if (!offlineModeInner) {
    return {
      success: false,
      message: "No internet connection. Offline mode has been disabled by the administrator.",
      offline: false,
    };
  }

  await enqueue("gate.inner_verify", {
    idempotencyKey: args.idempotencyKey,
    supervisorId: args.supervisorId,
    verifiedCount: args.verifiedCount,
    reason: args.reason,
    capturedAt,
    deviceId,
  });
  return { success: true, message: "Captured offline. Will sync.", offline: true };
}

export { flushOutbox, isExpired };
