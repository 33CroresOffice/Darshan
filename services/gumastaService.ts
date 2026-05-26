import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { normaliseError } from "@/lib/offline";
import { uriToBlob, uriToBase64DataUrl } from "@/lib/fileUtils";
import type { Gumasta, GateEntry, GumastaApproval, GumastaVoteSummary } from "@/types/database";

export async function getGumastasBySebayat(sebayatId: string): Promise<Gumasta[]> {
  const { data, error } = await supabase
    .from("gumastas")
    .select("*")
    .eq("sebayat_id", sebayatId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(normaliseError(error));
  return data ?? [];
}

export async function getActiveGumastasBySebayat(sebayatId: string): Promise<Gumasta[]> {
  const { data, error } = await supabase
    .from("gumastas")
    .select("*")
    .eq("sebayat_id", sebayatId)
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .order("name");

  if (error) throw new Error(normaliseError(error));
  return data ?? [];
}

export async function getGumastaById(id: string): Promise<Gumasta | null> {
  const { data, error } = await supabase
    .from("gumastas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(normaliseError(error));
  return data;
}

export async function checkDuplicateGumasta(
  sebayatId: string,
  name: string,
  contactNumber: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("gumastas")
    .select("id")
    .eq("sebayat_id", sebayatId)
    .ilike("name", name)
    .eq("contact_number", contactNumber)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(normaliseError(error));
  return data !== null;
}

export async function createGumasta(
  sebayatId: string,
  input: { name: string; contact_number: string; photo_url?: string | null; aadhar_card_url?: string | null }
): Promise<Gumasta> {
  const { data, error } = await supabase
    .from("gumastas")
    .insert({
      sebayat_id: sebayatId,
      name: input.name,
      contact_number: input.contact_number,
      photo_url: input.photo_url ?? null,
      aadhar_card_url: input.aadhar_card_url ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(normaliseError(error));
  return data;
}

export async function updateGumasta(
  id: string,
  input: { name?: string; contact_number?: string; photo_url?: string | null; aadhar_card_url?: string | null }
): Promise<Gumasta> {
  const { data, error } = await supabase
    .from("gumastas")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(normaliseError(error));
  return data;
}

export async function toggleGumastaActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("gumastas")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(normaliseError(error));
}

export async function deleteGumasta(id: string): Promise<void> {
  const { error } = await supabase.from("gumastas").delete().eq("id", id);
  if (error) throw new Error(normaliseError(error));
}

export async function assignGumastaToTickets(
  entryIds: string[],
  gumastaId: string
): Promise<void> {
  const serverIds = entryIds.filter((id) => !id.startsWith("local_"));
  for (const entryId of serverIds) {
    const { error } = await supabase.rpc("assign_gumasta_to_ticket", {
      p_entry_id: entryId,
      p_gumasta_id: gumastaId,
    });
    if (error) throw new Error(normaliseError(error));
  }
}

export async function assignGumastaToAllPendingTickets(
  sebayatId: string,
  gumastaId: string
): Promise<number> {
  const { data, error } = await supabase.rpc("assign_gumasta_to_all_pending", {
    p_sebayat_id: sebayatId,
    p_gumasta_id: gumastaId,
  });

  if (error) throw new Error(normaliseError(error));
  return data ?? 0;
}

export async function removeGumastaFromTicket(entryId: string): Promise<void> {
  if (entryId.startsWith("local_")) return;
  const { error } = await supabase.rpc("remove_gumasta_from_ticket", {
    p_entry_id: entryId,
  });

  if (error) throw new Error(normaliseError(error));
}

export async function removeGumastaFromAllTickets(
  sebayatId: string,
  gumastaId: string
): Promise<void> {
  const { error } = await supabase
    .from("gate_entries")
    .update({ gumasta_id: null })
    .eq("sebayat_id", sebayatId)
    .eq("gumasta_id", gumastaId);

  if (error) throw new Error(normaliseError(error));
}

export async function getTicketsByGumasta(
  gumastaId: string,
  dateFilter?: string
): Promise<GateEntry[]> {
  let query = supabase
    .from("gate_entries")
    .select("*, slot:darshan_slots(*)")
    .eq("gumasta_id", gumastaId)
    .order("created_at", { ascending: false });

  if (dateFilter) {
    query = query.eq("entry_date", dateFilter);
  }

  const { data, error } = await query;
  if (error) throw new Error(normaliseError(error));
  return data ?? [];
}

async function uploadToStorage(bucket: string, path: string, uri: string, errorPrefix: string): Promise<void> {
  let uploadError: string | null = null;

  if (Platform.OS !== "web") {
    const dataUrl = await uriToBase64DataUrl(uri);
    const [header, base64Data] = dataUrl.split(",");
    const mimeMatch = header.match(/data:([^;]+)/);
    const contentType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const byteChars = atob(base64Data);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
    if (error) uploadError = error.message;
  } else {
    const blob = await uriToBlob(uri);
    const contentType = blob.type || "image/jpeg";
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType, upsert: true });
    if (error) uploadError = error.message;
  }

  if (uploadError) throw new Error(`${errorPrefix}: ${uploadError}`);
}

export async function uploadGumastaPhoto(
  sebayatId: string,
  gumastaId: string,
  uri: string
): Promise<string> {
  const filePath = `gumastas/${sebayatId}/${gumastaId}.jpg`;
  await uploadToStorage("profile-photos", filePath, uri, "Photo upload failed");
  const { data } = supabase.storage.from("profile-photos").getPublicUrl(filePath);
  return data.publicUrl;
}

// ── Approval system ───────────────────────────────────────────────────────────

export async function getGumastasByApprovalStatus(
  status: "pending" | "approved" | "rejected"
): Promise<Gumasta[]> {
  const { data, error } = await supabase
    .from("gumastas")
    .select("*, sebayat:sebayat_registrations(id, full_name, phone_number, allotment_number, photo_url)")
    .eq("approval_status", status)
    .order("created_at", { ascending: false });

  if (error) throw new Error(normaliseError(error));
  return data ?? [];
}

export async function getGumastaVoteSummary(gumastaId: string): Promise<GumastaVoteSummary> {
  const [{ data: approvals, error: appErr }, { data: adminProfiles, error: profErr }] =
    await Promise.all([
      supabase
        .from("gumasta_approvals")
        .select("*, admin:profiles(full_name, phone_number)")
        .eq("gumasta_id", gumastaId)
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .eq("is_active", true),
    ]);

  if (appErr) throw new Error(normaliseError(appErr));
  if (profErr) throw new Error(normaliseError(profErr));

  const totalAdmins = adminProfiles?.length ?? 0;
  const approvedCount = approvals?.filter((a) => a.action === "approved").length ?? 0;
  const rejectedCount = approvals?.filter((a) => a.action === "rejected").length ?? 0;

  return {
    totalAdmins,
    approvedCount,
    rejectedCount,
    pendingCount: Math.max(0, totalAdmins - approvedCount - rejectedCount),
    approvals: (approvals ?? []) as GumastaApproval[],
  };
}

export async function voteOnGumasta(
  gumastaId: string,
  adminId: string,
  action: "approved" | "rejected",
  rejectionReason?: string
): Promise<void> {
  const { error } = await supabase
    .from("gumasta_approvals")
    .upsert(
      {
        gumasta_id: gumastaId,
        admin_id: adminId,
        action,
        rejection_reason: rejectionReason ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "gumasta_id,admin_id" }
    );

  if (error) throw new Error(normaliseError(error));
}

export async function superadminApproveGumasta(gumastaId: string): Promise<void> {
  const { error } = await supabase
    .from("gumastas")
    .update({
      approval_status: "approved",
      rejection_reason: null,
      approved_at: new Date().toISOString(),
      rejected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gumastaId);

  if (error) throw new Error(normaliseError(error));
}

export async function uploadGumastaAadhar(
  sebayatId: string,
  gumastaId: string,
  uri: string
): Promise<string> {
  const filePath = `gumastas/${sebayatId}/${gumastaId}_aadhar.jpg`;
  await uploadToStorage("id-documents", filePath, uri, "Aadhaar upload failed");
  const { data } = supabase.storage.from("id-documents").getPublicUrl(filePath);
  return data.publicUrl;
}
