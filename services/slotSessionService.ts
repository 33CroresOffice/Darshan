import { supabase } from "@/lib/supabase";
import type { SlotSession, SlotSessionLog } from "@/types/database";

export async function getActiveSession(): Promise<SlotSession | null> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("slot_sessions")
    .select("*, slot:darshan_slots(*), starter:profiles!slot_sessions_started_by_fkey(full_name, role)")
    .eq("date", today)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("Error fetching active session:", error);
    return null;
  }

  return data;
}

export async function getTodayAllSessions(): Promise<SlotSession[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("slot_sessions")
    .select("*, slot:darshan_slots(*), starter:profiles!slot_sessions_started_by_fkey(full_name, role), ender:profiles!slot_sessions_ended_by_fkey(full_name, role)")
    .eq("date", today)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("Error fetching today sessions:", error);
    return [];
  }

  return data || [];
}

export async function startSlotSession(
  slotId: string,
  userId: string
): Promise<{ success: boolean; message: string; session?: SlotSession }> {
  const today = new Date().toISOString().split("T")[0];

  const existing = await getActiveSession();
  if (existing) {
    return {
      success: false,
      message: `Another slot (${(existing.slot as any)?.name || "Unknown"}) is already active. End it before starting a new one.`,
    };
  }

  const { data: slotData } = await supabase
    .from("darshan_slots")
    .select("id, name, is_active")
    .eq("id", slotId)
    .maybeSingle();

  if (!slotData || !slotData.is_active) {
    return { success: false, message: "Slot not found or not active" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle();

  const { data: session, error } = await supabase
    .from("slot_sessions")
    .insert({
      slot_id: slotId,
      date: today,
      status: "active",
      started_by: userId,
    })
    .select("*, slot:darshan_slots(*), starter:profiles!slot_sessions_started_by_fkey(full_name, role)")
    .single();

  if (error) {
    console.error("Error starting slot session:", error);
    if (error.code === "23505") {
      return {
        success: false,
        message: "A slot is already active for today. Please end it first.",
      };
    }
    return { success: false, message: error.message };
  }

  await supabase.from("slot_session_logs").insert({
    session_id: session.id,
    slot_id: slotId,
    slot_name: slotData.name,
    action: "started",
    performed_by: userId,
    performed_by_name: profile?.full_name || "Unknown",
    performed_by_role: profile?.role || "unknown",
  });

  return { success: true, message: "Slot session started", session };
}

export async function endSlotSession(
  sessionId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { data: session, error: fetchError } = await supabase
    .from("slot_sessions")
    .select("id, status, slot_id, slot:darshan_slots(name)")
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchError || !session) {
    return { success: false, message: "Session not found" };
  }

  if (session.status !== "active") {
    return { success: false, message: "Session is not active" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("slot_sessions")
    .update({
      status: "ended",
      ended_by: userId,
      ended_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.error("Error ending slot session:", error);
    return { success: false, message: error.message };
  }

  const slotName = (session.slot as any)?.name || "Unknown";

  await supabase.from("slot_session_logs").insert({
    session_id: sessionId,
    slot_id: session.slot_id,
    slot_name: slotName,
    action: "ended",
    performed_by: userId,
    performed_by_name: profile?.full_name || "Unknown",
    performed_by_role: profile?.role || "unknown",
  });

  return { success: true, message: "Slot session ended" };
}

export async function getTodaySessionLogs(limit = 20): Promise<SlotSessionLog[]> {
  const today = new Date().toISOString().split("T")[0];
  const startOfDay = `${today}T00:00:00.000Z`;
  const endOfDay = `${today}T23:59:59.999Z`;

  const { data, error } = await supabase
    .from("slot_session_logs")
    .select("*")
    .gte("performed_at", startOfDay)
    .lte("performed_at", endOfDay)
    .order("performed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching today session logs:", error);
    return [];
  }

  return data || [];
}

export async function resetSlotSession(
  sessionId: string
): Promise<{ success: boolean; message: string }> {
  const { error: logsError } = await supabase
    .from("slot_session_logs")
    .delete()
    .eq("session_id", sessionId);

  if (logsError) {
    return { success: false, message: logsError.message };
  }

  const { error: sessionError } = await supabase
    .from("slot_sessions")
    .delete()
    .eq("id", sessionId);

  if (sessionError) {
    return { success: false, message: sessionError.message };
  }

  return { success: true, message: "Slot session has been reset" };
}

export async function getAllSessionLogs(
  fromDate?: string,
  toDate?: string,
  limit = 100
): Promise<SlotSessionLog[]> {
  let query = supabase
    .from("slot_session_logs")
    .select("*")
    .order("performed_at", { ascending: false })
    .limit(limit);

  if (fromDate) {
    query = query.gte("performed_at", `${fromDate}T00:00:00.000Z`);
  }
  if (toDate) {
    query = query.lte("performed_at", `${toDate}T23:59:59.999Z`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching session logs:", error);
    return [];
  }

  return data || [];
}
