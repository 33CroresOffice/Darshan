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
  getOutbox,
  loadServerQuota,
  normaliseError,
  saveServerQuota,
  setCachedTickets,
  todayString,
  upsertCachedTicket,
  upsertStaffCachedTicket,
  loadSebayatListCache,
  searchSebayatListCache,
  upsertCachedGateEntry,
  deductLocalQuota,
  appendGateLog,
  getGateLog,
  getStaffCachedTickets,
} from "@/lib/offline";
import {
  createDarshanTicket,
  createDarshanTicketForStaff,
  cancelDarshanTicket,
  getSebayatDailyQuota,
  getSebayatTodayTickets,
  updateDarshanTicketCount,
  isTicketExpired as isExpired,
  searchSebayatByPhone,
  searchSebayatByTempleId,
  flagEntryDiscrepancy,
} from "./entryService";
import { getTicketValidityMinutes, getOfflineModeEnabled } from "./settingsService";
import type { GateEntry, EntryMode, SebayatQuota, SebayatRegistration } from "@/types/database";
import type { CreateEntryResult, VerifyEntryResult } from "@/types";

// Compute effective remaining, merging server state with any unsynced local tickets.
// Always attempts a live server fetch regardless of connectivity flag (the flag can
// lag reality). On success the ledger is saved for future offline use.
export async function getEffectiveQuota(sebayatId: string): Promise<SebayatQuota> {
  const date = todayString();

  // Always try the network — don't trust connectivity flag alone since it can
  // be stale (e.g. the offline event fires after this call already started).
  try {
    const q = await getSebayatDailyQuota(sebayatId, date);
    // Persist immediately so the offline ledger is always fresh
    await saveServerQuota(sebayatId, date, q);
    // Only add local tickets that are STILL pending in the outbox (not yet
    // flushed to the server). Flushed tickets are already counted in q.usedCount.
    const [local, outbox] = await Promise.all([getCachedTickets(sebayatId, date), getOutbox()]);
    const pendingCreateKeys = new Set(
      outbox.filter((o) => o.op === "ticket.create").map((o) => o.payload.idempotencyKey as string)
    );
    const localPending = local
      .filter(
        (t) =>
          t.status !== "cancelled" &&
          t.id.startsWith("local_") &&
          pendingCreateKeys.has((t.qr_code_data as Record<string, unknown> | null)?.idempotencyKey as string)
      )
      .reduce((sum, t) => sum + t.declared_devotee_count, 0);
    const used = q.usedCount + localPending;
    const remaining = Math.max(0, q.maxLimit - used);
    connectivity.setOnline(true);
    return { maxLimit: q.maxLimit, usedCount: used, remainingCount: remaining };
  } catch {
    // Network unavailable — fall back to last-saved ledger
    connectivity.setOnline(false);
  }

  // Offline path: derive quota from the persisted ledger + local tickets.
  const ledger = await loadServerQuota(sebayatId, date);
  const [local, outbox] = await Promise.all([getCachedTickets(sebayatId, date), getOutbox()]);

  // Only count local_ tickets still pending in outbox — flushed ones are already
  // counted in the ledger's serverUsed (saved from the last successful server fetch).
  const pendingCreateKeys = new Set(
    outbox.filter((o) => o.op === "ticket.create").map((o) => o.payload.idempotencyKey as string)
  );
  const localPending = local
    .filter(
      (t) =>
        t.status !== "cancelled" &&
        t.id.startsWith("local_") &&
        pendingCreateKeys.has((t.qr_code_data as Record<string, unknown> | null)?.idempotencyKey as string)
    )
    .reduce((sum, t) => sum + t.declared_devotee_count, 0);

  // Use the real limit from the ledger. Falls back to 20 (system default)
  // only if no ledger has ever been saved (true first-ever offline session).
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
      // Server is reachable but ticket not found yet — it may still be in the
      // user's outbox (created offline, not yet synced). Fall through to the
      // embedded-payload path so the supervisor can still process it.
    } catch {}
  }

  // Offline OR online-but-not-yet-synced: trust the embedded payload.
  // The QR payload is the authoritative source of truth for offline tickets.
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

  // Last resort: QR has only { entryCode } (legacy online-created ticket format).
  // Look it up in the supervisor's local staff ticket cache so offline scanning works.
  try {
    const staffCache = await getStaffCachedTickets(todayString());
    const cached = staffCache.find((t) => t.entry_code === entryCode);
    if (cached) {
      const qr = cached.qr_code_data as Record<string, unknown> | null;
      const cachedKey = (qr?.idempotencyKey as string | undefined) ?? cached.idempotency_key ?? null;
      return {
        source: "offline_payload",
        idempotencyKey: cachedKey ?? entryCode,
        entryCode,
        declaredCount: cached.declared_devotee_count,
        sebayatId: cached.sebayat_id,
      };
    }
  } catch {}

  return null;
}

export async function recordWestGateEventResilient(args: {
  idempotencyKey: string;
  supervisorId: string;
  actualCount: number;
  sebayatId?: string;
  entryCode?: string;
  // Provided when the ticket was created offline and may not be on the server yet
  offlineOrigin?: boolean;
  offlineQrPayload?: Record<string, unknown>;
}): Promise<{ success: boolean; message: string; offline: boolean }> {
  const deviceId = await getDeviceId();
  const capturedAt = new Date().toISOString();

  if (connectivity.isOnline()) {
    // If ticket was created offline and hasn't synced yet, reconcile it first
    // so apply_west_gate_event can find it by idempotency key.
    if (args.offlineOrigin && args.offlineQrPayload) {
      const qr = args.offlineQrPayload;
      await supabase.rpc("reconcile_offline_ticket", {
        p_idempotency_key: args.idempotencyKey,
        p_entry_code: qr.entryCode as string,
        p_qr_code_data: qr,
        p_sebayat_id: qr.sebayatId as string,
        p_slot_id: (qr.slotId as string) ?? null,
        p_declared_count: qr.count as number,
        p_entry_date: qr.date as string,
        p_entry_mode: (qr.entryMode as string) ?? "west_gate",
        p_expires_at: null,
        p_client_created_at: qr.timestamp as string,
        p_device_id: (qr.deviceId as string) ?? deviceId,
      });
      // Remove the pending ticket.create from the outbox to avoid a duplicate
      // reconcile when the outbox flushes later (the RPC is idempotent anyway,
      // but this keeps the outbox clean).
      const { removeOutboxByIdempotencyKey } = await import("@/lib/offline");
      await removeOutboxByIdempotencyKey(args.idempotencyKey);
    }

    const { error } = await supabase.rpc("apply_west_gate_event", {
      p_idempotency_key: args.idempotencyKey,
      p_supervisor_id: args.supervisorId,
      p_actual_count: args.actualCount,
      p_captured_at: capturedAt,
      p_device_id: deviceId,
    });
    // Online path: return immediately regardless of outcome — do NOT fall
    // through to the offline queue when the device has a live connection.
    if (error) return { success: false, message: normaliseError(error), offline: false };
    return { success: true, message: "West gate verified", offline: false };
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
    // Store QR payload so the sync runner can buffer-create the ticket on the
    // server if it hasn't been reconciled yet when this op is flushed.
    offlineQrPayload: args.offlineQrPayload ?? null,
  });

  if (args.sebayatId) {
    await deductLocalQuota(args.sebayatId, args.actualCount);
    await appendGateLog(args.sebayatId, {
      timestamp: capturedAt,
      count: args.actualCount,
      gate: "west",
      entryCode: args.entryCode ?? "",
    });
  }

  return { success: true, message: "Captured offline. Will sync.", offline: true };
}

export async function recordInnerGateEventResilient(args: {
  idempotencyKey: string;
  supervisorId: string;
  verifiedCount: number;
  reason?: string;
  sebayatId?: string;
  entryCode?: string;
  // Provided when the ticket was created offline and may not be on the server yet
  offlineOrigin?: boolean;
  offlineQrPayload?: Record<string, unknown>;
}): Promise<{ success: boolean; message: string; offline: boolean }> {
  const deviceId = await getDeviceId();
  const capturedAt = new Date().toISOString();

  if (connectivity.isOnline()) {
    // If ticket was created offline and hasn't synced yet, reconcile it first.
    if (args.offlineOrigin && args.offlineQrPayload) {
      const qr = args.offlineQrPayload;
      await supabase.rpc("reconcile_offline_ticket", {
        p_idempotency_key: args.idempotencyKey,
        p_entry_code: qr.entryCode as string,
        p_qr_code_data: qr,
        p_sebayat_id: qr.sebayatId as string,
        p_slot_id: (qr.slotId as string) ?? null,
        p_declared_count: qr.count as number,
        p_entry_date: qr.date as string,
        p_entry_mode: (qr.entryMode as string) ?? "marjana_mandap",
        p_expires_at: null,
        p_client_created_at: qr.timestamp as string,
        p_device_id: (qr.deviceId as string) ?? deviceId,
      });
      const { removeOutboxByIdempotencyKey } = await import("@/lib/offline");
      await removeOutboxByIdempotencyKey(args.idempotencyKey);
    }

    const { error } = await supabase.rpc("apply_inner_gate_event", {
      p_idempotency_key: args.idempotencyKey,
      p_supervisor_id: args.supervisorId,
      p_verified_count: args.verifiedCount,
      p_captured_at: capturedAt,
      p_device_id: deviceId,
      p_reason: args.reason ?? null,
    });
    // Online path: return immediately regardless of outcome — do NOT fall
    // through to the offline queue when the device has a live connection.
    if (error) return { success: false, message: normaliseError(error), offline: false };
    return { success: true, message: "Inner gate verified", offline: false };
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
    offlineQrPayload: args.offlineQrPayload ?? null,
  });

  if (args.sebayatId) {
    await deductLocalQuota(args.sebayatId, args.verifiedCount);
    await appendGateLog(args.sebayatId, {
      timestamp: capturedAt,
      count: args.verifiedCount,
      gate: "inner",
      entryCode: args.entryCode ?? "",
    });
  }

  return { success: true, message: "Captured offline. Will sync.", offline: true };
}

// Resilient sebayat search: online delegates to server, offline searches local cache.
// Returns a SebayatRegistration-shaped object (may lack full join data when offline).
export async function searchSebayatResilient(
  query: string,
  mode: "phone" | "templeid"
): Promise<SebayatRegistration | null> {
  if (connectivity.isOnline()) {
    try {
      const result =
        mode === "phone"
          ? await searchSebayatByPhone(query)
          : await searchSebayatByTempleId(query);
      return result;
    } catch {}
  }

  // Offline: search the locally cached sebayat list
  const list = await loadSebayatListCache();
  const found = searchSebayatListCache(list, query, mode);
  if (!found) return null;

  // Shape the cached data to match SebayatRegistration
  return {
    id: found.id,
    full_name: found.full_name,
    phone_number: found.phone_number,
    temple_health_card_id: found.temple_health_card_id,
    temple_id_card_number: found.temple_id_card_number,
    allotment_number: found.allotment_number,
    photo_url: found.photo_url,
    approval_status: found.approval_status as "approved",
    category: found.category_name ? { name: found.category_name } : null,
    // Fields not stored in cache — set to safe defaults
    user_id: "",
    email: null,
    address: null,
    city: null,
    state: null,
    pincode: null,
    date_of_birth: null,
    aadhar_number: null,
    temple_affiliation: null,
    experience_years: null,
    id_proof_url: null,
    rejection_reason: null,
    approved_by: null,
    approved_at: null,
    submission_count: 1,
    created_at: "",
    updated_at: "",
    category_id: null,
    temple_health_card_url: null,
    temple_id_card_url: null,
    submission_round: 1,
    old_data: null,
    rejection_type: null,
    father_name: null,
    aadhar_card_url: null,
    permanent_address: null,
    permanent_city: null,
    permanent_state: null,
    permanent_pincode: null,
    present_same_as_permanent: false,
    present_address: null,
    present_city: null,
    present_state: null,
    present_pincode: null,
    age: null,
    category_ids: null,
  } as unknown as SebayatRegistration;
}

// Resilient discrepancy flag: queues the flag for offline sync.
export async function flagEntryDiscrepancyResilient(
  entryId: string,
  reason: string,
  supervisorId: string
): Promise<VerifyEntryResult> {
  const capturedAt = new Date().toISOString();

  if (connectivity.isOnline() && !entryId.startsWith("local_")) {
    try {
      return await flagEntryDiscrepancy(entryId, reason, supervisorId);
    } catch {}
  }

  if (entryId.startsWith("local_")) {
    return {
      success: false,
      message: "Cannot flag an offline-created entry. Please wait for it to sync first.",
    };
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

  // Optimistically update the local caches
  const optimisticUpdate = (entry: GateEntry): GateEntry => ({
    ...entry,
    status: "discrepancy_flagged",
    inner_gate_supervisor_id: supervisorId,
    inner_gate_verification_time: capturedAt,
    notes: reason,
  });

  for (const scope of ["inner_gate:pending", "supervisor:today", "supervisor:pending"]) {
    try {
      const entries = await import("@/lib/offline").then((m) =>
        m.loadCachedGateEntries(scope)
      );
      const entry = entries.find((e) => e.id === entryId);
      if (entry) {
        await upsertCachedGateEntry(scope, optimisticUpdate(entry));
      }
    } catch {}
  }

  await enqueue("gate.flag_discrepancy", {
    entryId,
    reason,
    supervisorId,
    capturedAt,
  });

  return {
    success: true,
    message: "Discrepancy flagged offline. Will sync when connection returns.",
  };
}

// Resilient staff ticket creation: supervisor creates a ticket on behalf of a sebayat.
// Online: calls createDarshanTicketForStaff() directly.
// Offline: mints a local ticket, saves it to the staff ticket cache, and queues
//          a ticket.staff_create op (which reconciles via the same RPC as ticket.create).
export async function createTicketForStaffResilient(
  sebayatRegistrationId: string,
  staffUserId: string,
  devoteeCount: number,
  slotId: string | null | undefined,
  entryMode: EntryMode
): Promise<CreateEntryResult> {
  const date = todayString();

  if (connectivity.isOnline()) {
    // Build a direct call that uses the sebayatRegistrationId we already have
    const result = await createDarshanTicket(sebayatRegistrationId, devoteeCount, slotId ?? null, entryMode);
    if (result.success && result.entry) {
      await upsertStaffCachedTicket(date, result.entry);
    }
    return result;
  }

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

  const idempotencyKey = buildIdempotencyKey("stk");
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
    sebayatId: sebayatRegistrationId,
    date,
    count: devoteeCount,
    slotId: slotId || null,
    timestamp: clientCreatedAt,
    idempotencyKey,
    offline: true,
    staffCreated: true,
    staffUserId,
    deviceId,
  };

  const localTicket = buildLocalTicket({
    idempotencyKey: `local_${idempotencyKey}`,
    entryCode,
    sebayatId: sebayatRegistrationId,
    slotId: slotId || null,
    declaredCount: devoteeCount,
    entryDate: date,
    entryMode,
    expiresAt,
    clientCreatedAt,
    deviceId,
    qrCodeData,
  });

  await upsertStaffCachedTicket(date, localTicket);
  // Also cache into the sebayat's ticket cache so it shows in the main ticket view
  await upsertCachedTicket(sebayatRegistrationId, date, localTicket);

  await enqueue("ticket.staff_create", {
    idempotencyKey,
    entryCode,
    qrCodeData,
    sebayatId: sebayatRegistrationId,
    staffUserId,
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

// Resilient west gate entry registration: supervisor manually creates a gate entry
// for a sebayat looked up by phone when no pre-existing ticket exists.
export async function registerWestGateEntryResilient(
  sebayatId: string,
  devoteeCount: number,
  supervisorId: string
): Promise<CreateEntryResult> {
  const date = todayString();

  if (connectivity.isOnline()) {
    const { registerWestGateEntry } = await import("./entryService");
    const result = await registerWestGateEntry(sebayatId, devoteeCount, supervisorId);
    if (result.success && result.entry) {
      await upsertCachedGateEntry("supervisor:today", result.entry);
      try {
        const q = await getSebayatDailyQuota(sebayatId, date);
        await saveServerQuota(sebayatId, date, q);
      } catch {}
    }
    return result;
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
  if (devoteeCount > quota.remainingCount) {
    return {
      success: false,
      message: `Cannot register ${devoteeCount} devotees. Only ${quota.remainingCount} slots remaining.`,
    };
  }

  const idempotencyKey = buildIdempotencyKey("wg");
  const entryCode = generateEntryCode();
  const deviceId = await getDeviceId();
  const clientCreatedAt = new Date().toISOString();

  const qrCodeData = {
    entryCode,
    sebayatId,
    date,
    count: devoteeCount,
    timestamp: clientCreatedAt,
    idempotencyKey,
    offline: true,
    deviceId,
  };

  const localEntry = buildLocalTicket({
    idempotencyKey: `local_${idempotencyKey}`,
    entryCode,
    sebayatId,
    slotId: null,
    declaredCount: devoteeCount,
    entryDate: date,
    entryMode: "west_gate" as EntryMode,
    expiresAt: null,
    clientCreatedAt,
    deviceId,
    qrCodeData,
  });
  // Mark as registered (supervisor-created entries skip "pending")
  (localEntry as any).status = "registered";
  (localEntry as any).west_gate_supervisor_id = supervisorId;
  (localEntry as any).west_gate_entry_time = clientCreatedAt;

  await upsertCachedGateEntry("supervisor:today", localEntry);
  await deductLocalQuota(sebayatId, devoteeCount);
  await appendGateLog(sebayatId, {
    timestamp: clientCreatedAt,
    count: devoteeCount,
    gate: "west",
    entryCode,
  });

  await enqueue("gate.west_register", {
    idempotencyKey,
    entryCode,
    qrCodeData,
    sebayatId,
    slotId: null,
    declaredCount: devoteeCount,
    entryDate: date,
    entryMode: "west_gate",
    expiresAt: null,
    clientCreatedAt,
    deviceId,
    supervisorId,
  });

  return {
    success: true,
    message: "Entry registered offline. Will sync when connection returns.",
    entry: localEntry,
  };
}

export { flushOutbox, isExpired, getGateLog };
