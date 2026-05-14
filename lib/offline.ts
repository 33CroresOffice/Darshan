import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { GateEntry, EntryMode, SebayatQuota } from "@/types/database";

const DEVICE_ID_KEY = "@offline:device_id";
const OUTBOX_KEY = "@offline:outbox:v1";
const QUOTA_KEY_PREFIX = "@offline:quota:";
const TICKETS_KEY_PREFIX = "@offline:tickets:";
const GATE_CACHE_PREFIX = "@offline:gate:";

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

// ---------- Gate-side cache (for supervisors) ----------

export async function cacheGateEntries(scope: string, entries: GateEntry[]) {
  await AsyncStorage.setItem(`${GATE_CACHE_PREFIX}${scope}`, JSON.stringify(entries));
}

export async function loadCachedGateEntries(scope: string): Promise<GateEntry[]> {
  const raw = await AsyncStorage.getItem(`${GATE_CACHE_PREFIX}${scope}`);
  return raw ? (JSON.parse(raw) as GateEntry[]) : [];
}

// ---------- Outbox ----------

export type OutboxOpType =
  | "ticket.create"
  | "ticket.cancel"
  | "ticket.edit_count"
  | "gate.west_verify"
  | "gate.inner_verify";

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
    case "gate.west_verify":
      return runWestVerify(item.payload);
    case "gate.inner_verify":
      return runInnerVerify(item.payload);
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
