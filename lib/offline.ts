import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { GateEntry, EntryMode, SebayatQuota } from "@/types/database";

const DEVICE_ID_KEY = "@offline:device_id";
const OUTBOX_KEY = "@offline:outbox:v1";
const QUOTA_KEY_PREFIX = "@offline:quota:";
const TICKETS_KEY_PREFIX = "@offline:tickets:";
const GATE_CACHE_PREFIX = "@offline:gate:";
const SETTINGS_CACHE_KEY = "@offline:settings";
const SLOTS_CACHE_KEY_PREFIX = "@offline:slots:";
const LAST_SYNC_KEY = "@offline:last_sync";
const SEBAYAT_LIST_KEY = "@offline:supervisor:sebayat_list";
const ACTIVE_SLOT_SESSION_KEY = "@offline:supervisor:active_slot_session";
const STAFF_TICKETS_KEY_PREFIX = "@offline:supervisor:staff_tickets:";

const ENTRY_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type Listener = () => void;

// ---------- Device ID ----------

function generateRandomString(length: number): string {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateRandomString(8);
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function generateUUID(): string {
  // RFC4122 v4
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

export function generateEntryCode(): string {
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += ENTRY_CODE_CHARS.charAt(Math.floor(Math.random() * ENTRY_CODE_CHARS.length));
  }
  return result;
}

// ---------- Connectivity ----------

class ConnectivityState {
  private online = true;
  private listeners = new Set<Listener>();

  isOnline() {
    return this.online;
  }

  setOnline(value: boolean) {
    if (this.online === value) return;
    this.online = value;
    this.listeners.forEach((l) => l());
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export const connectivity = new ConnectivityState();

// Lightweight probe: try a HEAD-style call to Supabase REST. Falls back to
// `navigator.onLine` on web for instant signal.
export async function probeConnectivity(): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" && !navigator.onLine) {
      connectivity.setOnline(false);
      return false;
    }
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!url) return connectivity.isOnline();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${url}/auth/v1/health`, {
      method: "GET",
      signal: ctrl.signal,
      headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "" },
    });
    clearTimeout(timer);
    const ok = res.ok || res.status === 401 || res.status === 404;
    connectivity.setOnline(ok);
    return ok;
  } catch {
    connectivity.setOnline(false);
    return false;
  }
}

// ---------- Quota ledger ----------

export interface LocalQuotaLedger {
  sebayatId: string;
  date: string;
  maxLimit: number;
  serverUsed: number;
  syncedAt: string;
}

function quotaKey(sebayatId: string, date: string) {
  return `${QUOTA_KEY_PREFIX}${sebayatId}:${date}:v1`;
}

export async function saveServerQuota(sebayatId: string, date: string, q: SebayatQuota) {
  const ledger: LocalQuotaLedger = {
    sebayatId,
    date,
    maxLimit: q.maxLimit,
    serverUsed: q.usedCount,
    syncedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(quotaKey(sebayatId, date), JSON.stringify(ledger));
}

export async function loadServerQuota(sebayatId: string, date: string): Promise<LocalQuotaLedger | null> {
  const raw = await AsyncStorage.getItem(quotaKey(sebayatId, date));
  return raw ? (JSON.parse(raw) as LocalQuotaLedger) : null;
}

// ---------- Local tickets cache ----------

function ticketsKey(sebayatId: string, date: string) {
  return `${TICKETS_KEY_PREFIX}${sebayatId}:${date}`;
}

export async function getCachedTickets(sebayatId: string, date: string): Promise<GateEntry[]> {
  const raw = await AsyncStorage.getItem(ticketsKey(sebayatId, date));
  return raw ? (JSON.parse(raw) as GateEntry[]) : [];
}

export async function setCachedTickets(sebayatId: string, date: string, tickets: GateEntry[]) {
  await AsyncStorage.setItem(ticketsKey(sebayatId, date), JSON.stringify(tickets));
}

export async function upsertCachedTicket(sebayatId: string, date: string, ticket: GateEntry) {
  const list = await getCachedTickets(sebayatId, date);
  const idx = list.findIndex((t) => t.id === ticket.id || t.entry_code === ticket.entry_code);
  if (idx >= 0) list[idx] = ticket;
  else list.unshift(ticket);
  await setCachedTickets(sebayatId, date, list);
}

// ---------- Settings cache ----------

export interface CachedSettings {
  dailyBookingCapPerUser: number;
  ticketValidityMinutes: number;
  maxDevoteesPerDay: number;
  offlineModeEnabled: boolean;
  darshanSlotsEnabled: boolean;
  savedAt: string;
}

export async function saveSettingsCache(settings: CachedSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
}

export async function loadSettingsCache(): Promise<CachedSettings | null> {
  const raw = await AsyncStorage.getItem(SETTINGS_CACHE_KEY);
  return raw ? (JSON.parse(raw) as CachedSettings) : null;
}

// ---------- Slots cache ----------

function slotsKey(sebayatId: string, date: string) {
  return `${SLOTS_CACHE_KEY_PREFIX}${sebayatId}:${date}`;
}

export async function saveCachedSlots(sebayatId: string, date: string, slots: unknown[]): Promise<void> {
  await AsyncStorage.setItem(slotsKey(sebayatId, date), JSON.stringify(slots));
}

export async function loadCachedSlots<T>(sebayatId: string, date: string): Promise<T[] | null> {
  const raw = await AsyncStorage.getItem(slotsKey(sebayatId, date));
  return raw ? (JSON.parse(raw) as T[]) : null;
}

// ---------- Last sync timestamp ----------

export async function saveLastSyncTime(): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

export async function loadLastSyncTime(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNC_KEY);
}

// ---------- Gate-side cache (for supervisors) ----------

export async function cacheGateEntries(scope: string, entries: GateEntry[]) {
  await AsyncStorage.setItem(`${GATE_CACHE_PREFIX}${scope}`, JSON.stringify(entries));
}

export async function loadCachedGateEntries(scope: string): Promise<GateEntry[]> {
  const raw = await AsyncStorage.getItem(`${GATE_CACHE_PREFIX}${scope}`);
  return raw ? (JSON.parse(raw) as GateEntry[]) : [];
}

export async function upsertCachedGateEntry(scope: string, entry: GateEntry): Promise<void> {
  const list = await loadCachedGateEntries(scope);
  const idx = list.findIndex((e) => e.id === entry.id);
  if (idx >= 0) list[idx] = entry;
  else list.unshift(entry);
  await cacheGateEntries(scope, list);
}

// ---------- Supervisor sebayat list cache ----------

export interface CachedSebayat {
  id: string;
  full_name: string;
  phone_number: string;
  temple_health_card_id: string | null;
  temple_id_card_number: string | null;
  allotment_number: string | null;
  photo_url: string;
  category_name: string | null;
  approval_status: string;
}

export async function saveSebayatListCache(sebayats: CachedSebayat[]): Promise<void> {
  await AsyncStorage.setItem(SEBAYAT_LIST_KEY, JSON.stringify(sebayats));
}

export async function loadSebayatListCache(): Promise<CachedSebayat[]> {
  const raw = await AsyncStorage.getItem(SEBAYAT_LIST_KEY);
  return raw ? (JSON.parse(raw) as CachedSebayat[]) : [];
}

export function searchSebayatListCache(
  list: CachedSebayat[],
  query: string,
  mode: "phone" | "templeid"
): CachedSebayat | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const last10 = (n: string) => n.replace(/\D/g, "").slice(-10);
  for (const s of list) {
    if (mode === "phone" && last10(s.phone_number ?? "") === last10(q)) {
      return s;
    }
    if (mode === "templeid") {
      const cardNum = (s.temple_id_card_number ?? "").toLowerCase();
      const hcNum = (s.temple_health_card_id ?? "").toLowerCase();
      if (cardNum === q || hcNum === q) return s;
    }
  }
  return null;
}

// ---------- Supervisor active slot session cache ----------

export interface CachedSlotSession {
  id: string;
  slot_id: string;
  slot_name: string;
  status: "active" | "ended";
  started_at: string;
  savedAt: string;
}

export async function saveActiveSlotSession(session: CachedSlotSession | null): Promise<void> {
  if (session) {
    await AsyncStorage.setItem(ACTIVE_SLOT_SESSION_KEY, JSON.stringify(session));
  } else {
    await AsyncStorage.removeItem(ACTIVE_SLOT_SESSION_KEY);
  }
}

export async function loadActiveSlotSession(): Promise<CachedSlotSession | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_SLOT_SESSION_KEY);
  return raw ? (JSON.parse(raw) as CachedSlotSession) : null;
}

// ---------- Local quota deduction (supervisor gate events) ----------

export async function deductLocalQuota(sebayatId: string, devoteeCount: number): Promise<void> {
  const date = todayString();
  const ledger = await loadServerQuota(sebayatId, date);
  const maxLimit = ledger?.maxLimit ?? 20;
  const serverUsed = (ledger?.serverUsed ?? 0) + devoteeCount;
  await saveServerQuota(sebayatId, date, {
    maxLimit,
    usedCount: serverUsed,
    remainingCount: Math.max(0, maxLimit - serverUsed),
  });
}

// ---------- Per-sebayat gate activity log ----------

const GATE_LOG_PREFIX = "@offline:supervisor:gate_log:";

export interface GateLogEntry {
  timestamp: string;
  count: number;
  gate: "west" | "inner";
  entryCode: string;
}

function gateLogKey(sebayatId: string, date: string) {
  return `${GATE_LOG_PREFIX}${sebayatId}:${date}`;
}

export async function appendGateLog(
  sebayatId: string,
  entry: GateLogEntry
): Promise<void> {
  const date = todayString();
  const key = gateLogKey(sebayatId, date);
  const raw = await AsyncStorage.getItem(key);
  const list: GateLogEntry[] = raw ? JSON.parse(raw) : [];
  list.push(entry);
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

export async function getGateLog(sebayatId: string): Promise<GateLogEntry[]> {
  const date = todayString();
  const key = gateLogKey(sebayatId, date);
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as GateLogEntry[]) : [];
}

// ---------- Staff tickets cache (supervisor-created, offline-pending) ----------

export async function getStaffCachedTickets(date: string): Promise<GateEntry[]> {
  const raw = await AsyncStorage.getItem(`${STAFF_TICKETS_KEY_PREFIX}${date}`);
  return raw ? (JSON.parse(raw) as GateEntry[]) : [];
}

export async function upsertStaffCachedTicket(date: string, ticket: GateEntry): Promise<void> {
  const list = await getStaffCachedTickets(date);
  const idx = list.findIndex((t) => t.id === ticket.id || t.entry_code === ticket.entry_code);
  if (idx >= 0) list[idx] = ticket;
  else list.unshift(ticket);
  await AsyncStorage.setItem(`${STAFF_TICKETS_KEY_PREFIX}${date}`, JSON.stringify(list));
}

// ---------- Outbox ----------

export type OutboxOpType =
  | "ticket.create"
  | "ticket.cancel"
  | "ticket.edit_count"
  | "ticket.staff_create"
  | "gate.west_verify"
  | "gate.west_register"
  | "gate.inner_verify"
  | "gate.flag_discrepancy";

export interface OutboxOp {
  id: string;
  op: OutboxOpType;
  payload: Record<string, unknown>;
  attempts: number;
  lastError?: string;
  createdAt: string;
}

const outboxListeners = new Set<Listener>();

export function subscribeOutbox(l: Listener): () => void {
  outboxListeners.add(l);
  return () => outboxListeners.delete(l);
}

function emitOutboxChanged() {
  outboxListeners.forEach((l) => l());
}

export async function getOutbox(): Promise<OutboxOp[]> {
  const raw = await AsyncStorage.getItem(OUTBOX_KEY);
  return raw ? (JSON.parse(raw) as OutboxOp[]) : [];
}

export async function getOutboxCount(): Promise<number> {
  return (await getOutbox()).length;
}

async function setOutbox(items: OutboxOp[]) {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  emitOutboxChanged();
}

export async function enqueue(op: OutboxOpType, payload: Record<string, unknown>): Promise<OutboxOp> {
  const items = await getOutbox();
  const entry: OutboxOp = {
    id: generateUUID(),
    op,
    payload,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  items.push(entry);
  await setOutbox(items);
  return entry;
}

async function removeFromOutbox(id: string) {
  const items = (await getOutbox()).filter((o) => o.id !== id);
  await setOutbox(items);
}

async function bumpAttempt(id: string, error: string) {
  const items = await getOutbox();
  const idx = items.findIndex((o) => o.id === id);
  if (idx >= 0) {
    items[idx].attempts += 1;
    items[idx].lastError = error;
    await setOutbox(items);
  }
}

// ---------- Sync runner ----------

let syncing = false;

export async function flushOutbox(): Promise<{ processed: number; remaining: number; errors: string[] }> {
  if (syncing) return { processed: 0, remaining: (await getOutbox()).length, errors: [] };
  syncing = true;
  const errors: string[] = [];
  let processed = 0;
  try {
    const items = await getOutbox();
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const item of items) {
      try {
        await runOp(item);
        await removeFromOutbox(item.id);
        processed += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await bumpAttempt(item.id, msg);
        errors.push(`${item.op}: ${msg}`);
        // Stop on error so dependent ops (e.g. gate verify before create) wait
        if (item.op === "ticket.create") break;
      }
    }
  } finally {
    syncing = false;
  }
  const remaining = (await getOutbox()).length;
  return { processed, remaining, errors };
}

async function runOp(item: OutboxOp): Promise<void> {
  switch (item.op) {
    case "ticket.create":
      return runTicketCreate(item.payload);
    case "ticket.cancel":
      return runTicketCancel(item.payload);
    case "ticket.edit_count":
      return runTicketEditCount(item.payload);
    case "ticket.staff_create":
      return runStaffTicketCreate(item.payload);
    case "gate.west_verify":
      return runWestVerify(item.payload);
    case "gate.west_register":
      return runWestRegister(item.payload);
    case "gate.inner_verify":
      return runInnerVerify(item.payload);
    case "gate.flag_discrepancy":
      return runFlagDiscrepancy(item.payload);
  }
}

async function runTicketCreate(p: Record<string, unknown>) {
  const { error, data } = await supabase.rpc("reconcile_offline_ticket", {
    p_idempotency_key: p.idempotencyKey,
    p_entry_code: p.entryCode,
    p_qr_code_data: p.qrCodeData,
    p_sebayat_id: p.sebayatId,
    p_slot_id: p.slotId ?? null,
    p_declared_count: p.declaredCount,
    p_entry_date: p.entryDate,
    p_entry_mode: p.entryMode,
    p_expires_at: p.expiresAt,
    p_client_created_at: p.clientCreatedAt,
    p_device_id: p.deviceId,
  });
  if (error) throw new Error(error.message);
  if (data && typeof p.sebayatId === "string" && typeof p.entryDate === "string") {
    await upsertCachedTicket(p.sebayatId, p.entryDate, data as GateEntry);
  }
}

async function runTicketCancel(p: Record<string, unknown>) {
  const { error } = await supabase
    .from("gate_entries")
    .update({ status: "cancelled" })
    .eq("idempotency_key", p.idempotencyKey as string);
  if (error) throw new Error(error.message);
}

async function runTicketEditCount(p: Record<string, unknown>) {
  const { error } = await supabase
    .from("gate_entries")
    .update({ declared_devotee_count: p.newCount })
    .eq("idempotency_key", p.idempotencyKey as string)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

async function runWestVerify(p: Record<string, unknown>) {
  const { error } = await supabase.rpc("apply_west_gate_event", {
    p_idempotency_key: p.idempotencyKey,
    p_supervisor_id: p.supervisorId,
    p_actual_count: p.actualCount,
    p_captured_at: p.capturedAt,
    p_device_id: p.deviceId,
  });
  if (error) throw new Error(error.message);
}

async function runWestRegister(p: Record<string, unknown>) {
  const { error, data } = await supabase.rpc("reconcile_offline_ticket", {
    p_idempotency_key: p.idempotencyKey,
    p_entry_code: p.entryCode,
    p_qr_code_data: p.qrCodeData,
    p_sebayat_id: p.sebayatId,
    p_slot_id: p.slotId ?? null,
    p_declared_count: p.declaredCount,
    p_entry_date: p.entryDate,
    p_entry_mode: p.entryMode ?? "west_gate",
    p_expires_at: p.expiresAt ?? null,
    p_client_created_at: p.clientCreatedAt,
    p_device_id: p.deviceId,
  });
  if (error) throw new Error(error.message);
  if (data && typeof p.sebayatId === "string" && typeof p.entryDate === "string") {
    await upsertCachedTicket(p.sebayatId, p.entryDate, data as GateEntry);
  }
}

async function runInnerVerify(p: Record<string, unknown>) {
  const { error } = await supabase.rpc("apply_inner_gate_event", {
    p_idempotency_key: p.idempotencyKey,
    p_supervisor_id: p.supervisorId,
    p_verified_count: p.verifiedCount,
    p_captured_at: p.capturedAt,
    p_device_id: p.deviceId,
    p_reason: p.reason ?? null,
  });
  if (error) throw new Error(error.message);
}

async function runStaffTicketCreate(p: Record<string, unknown>) {
  // Reconcile via the same RPC as a regular offline ticket — the server treats
  // staff-created tickets identically; the distinction is only for client-side tracking.
  const { error, data } = await supabase.rpc("reconcile_offline_ticket", {
    p_idempotency_key: p.idempotencyKey,
    p_entry_code: p.entryCode,
    p_qr_code_data: p.qrCodeData,
    p_sebayat_id: p.sebayatId,
    p_slot_id: p.slotId ?? null,
    p_declared_count: p.declaredCount,
    p_entry_date: p.entryDate,
    p_entry_mode: p.entryMode,
    p_expires_at: p.expiresAt,
    p_client_created_at: p.clientCreatedAt,
    p_device_id: p.deviceId,
  });
  if (error) throw new Error(error.message);
  if (data && typeof p.sebayatId === "string" && typeof p.entryDate === "string") {
    await upsertCachedTicket(p.sebayatId, p.entryDate, data as GateEntry);
  }
}

async function runFlagDiscrepancy(p: Record<string, unknown>) {
  const { error } = await supabase
    .from("gate_entries")
    .update({
      status: "discrepancy_flagged",
      inner_gate_supervisor_id: p.supervisorId as string,
      inner_gate_verification_time: p.capturedAt as string,
      notes: p.reason as string,
    })
    .eq("id", p.entryId as string);
  if (error) throw new Error(error.message);
}

// ---------- Network error normaliser ----------

const NETWORK_ERROR_PATTERNS = [
  "network request failed",
  "failed to fetch",
  "networkerror",
  "load failed",
  "the internet connection appears to be offline",
];

/**
 * Returns a clean user-facing message for network errors so raw
 * "TypeError: Network request failed" never reaches the UI.
 */
export function normaliseError(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (NETWORK_ERROR_PATTERNS.some((p) => msg.includes(p))) {
    return "You are offline. Please check your internet connection.";
  }
  return err instanceof Error ? err.message : String(err);
}

// ---------- Helpers ----------

export function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function buildIdempotencyKey(prefix: string): string {
  return `${prefix}_${generateUUID()}`;
}

// Build a minimally-shaped GateEntry that local UI can render before sync.
export function buildLocalTicket(args: {
  idempotencyKey: string;
  entryCode: string;
  sebayatId: string;
  slotId: string | null;
  declaredCount: number;
  entryDate: string;
  entryMode: EntryMode;
  expiresAt: string | null;
  clientCreatedAt: string;
  deviceId: string;
  qrCodeData: Record<string, unknown>;
}): GateEntry {
  return {
    id: args.idempotencyKey, // stable local id
    entry_code: args.entryCode,
    qr_code_data: args.qrCodeData,
    sebayat_id: args.sebayatId,
    slot_id: args.slotId,
    west_gate_supervisor_id: null,
    inner_gate_supervisor_id: null,
    declared_devotee_count: args.declaredCount,
    verified_devotee_count: null,
    status: args.entryMode === "marjana_mandap" ? "registered" : "pending",
    entry_date: args.entryDate,
    west_gate_entry_time: null,
    inner_gate_verification_time: null,
    notes: null,
    created_by_sebayat: true,
    expires_at: args.expiresAt,
    entry_mode: args.entryMode,
    created_at: args.clientCreatedAt,
    updated_at: args.clientCreatedAt,
  } as GateEntry;
}
