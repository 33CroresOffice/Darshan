import { supabase } from "@/lib/supabase";
import type { AdminStats, SebayatRegistration, RegistrationApproval, AdminVoteSummary, PreviousRoundVotes } from "@/types";

export async function getAdminStats(): Promise<AdminStats> {
  const [pendingRes, approvedRes, rejectedRes, recentRes] = await Promise.all([
    supabase
      .from("sebayat_registrations")
      .select("*", { count: "exact", head: true })
      .eq("approval_status", "pending"),
    supabase
      .from("sebayat_registrations")
      .select("*", { count: "exact", head: true })
      .eq("approval_status", "approved"),
    supabase
      .from("sebayat_registrations")
      .select("*", { count: "exact", head: true })
      .eq("approval_status", "rejected"),
    supabase
      .from("sebayat_registrations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    totalPending: pendingRes.count || 0,
    totalApproved: approvedRes.count || 0,
    totalRejected: rejectedRes.count || 0,
    recentRegistrations: (recentRes.data || []) as SebayatRegistration[],
  };
}

export interface DateFilter {
  startDate: string;
  endDate: string;
}

export async function getRegistrationsByStatus(
  status: "pending" | "approved" | "rejected",
  categoryId?: string,
  dateFilter?: DateFilter,
  excludeUserId?: string
): Promise<SebayatRegistration[]> {
  let query = supabase
    .from("sebayat_registrations")
    .select("*, category:categories(*), profile:profiles(phone_number)")
    .eq("approval_status", status);

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (dateFilter) {
    const dateField = status === "pending" ? "created_at" : "approved_at";
    query = query
      .gte(dateField, `${dateFilter.startDate}T00:00:00`)
      .lte(dateField, `${dateFilter.endDate}T23:59:59`);
  }

  if (excludeUserId) {
    query = query.neq("user_id", excludeUserId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as SebayatRegistration[];
}

function extractStoragePath(url: string, bucket: string): string | null {
  if (!url) return null;
  const pattern = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
  const match = url.match(pattern);
  return match ? match[1] : null;
}

async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function getRegistrationById(
  id: string
): Promise<SebayatRegistration | null> {
  const { data, error } = await supabase
    .from("sebayat_registrations")
    .select("*, category:categories(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const registration = data as SebayatRegistration;

  // Newer registrations use category_ids (array) instead of category_id FK.
  // If the join produced no category, resolve names from category_ids.
  if (!registration.category && registration.category_ids?.length) {
    const { data: cats } = await supabase
      .from("categories")
      .select("id, name")
      .in("id", registration.category_ids);
    if (cats?.length) {
      registration.category = { id: cats[0].id, name: cats.map((c) => c.name).join(", ") } as any;
    }
  }

  return registration;
}

export async function getRegistrationVotes(registrationId: string): Promise<AdminVoteSummary> {
  const regRes = await supabase
    .from("sebayat_registrations")
    .select("submission_round")
    .eq("id", registrationId)
    .maybeSingle();

  const currentRound = (regRes.data as { submission_round: number } | null)?.submission_round ?? 1;

  const [approvalsRes, adminCountRes] = await Promise.all([
    supabase
      .from("registration_approvals")
      .select("*, admin:profiles(full_name, phone_number)")
      .eq("registration_id", registrationId)
      .eq("submission_round", currentRound)
      .order("updated_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true),
  ]);

  const approvals = (approvalsRes.data || []) as RegistrationApproval[];
  const totalAdmins = adminCountRes.count || 0;
  const approvedCount = approvals.filter((a) => a.action === "approved").length;
  const rejectedCount = approvals.filter((a) => a.action === "rejected").length;
  const pendingCount = Math.max(0, totalAdmins - approvals.length);

  return { totalAdmins, approvedCount, rejectedCount, pendingCount, submissionRound: currentRound, approvals };
}

export async function getPreviousRoundVotes(registrationId: string, currentRound: number): Promise<PreviousRoundVotes[]> {
  if (currentRound <= 1) return [];

  const { data, error } = await supabase
    .from("registration_approvals")
    .select("*, admin:profiles(full_name, phone_number)")
    .eq("registration_id", registrationId)
    .lt("submission_round", currentRound)
    .order("submission_round", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const approvals = (data || []) as RegistrationApproval[];

  const roundMap = new Map<number, RegistrationApproval[]>();
  for (const approval of approvals) {
    const round = approval.submission_round;
    if (!roundMap.has(round)) roundMap.set(round, []);
    roundMap.get(round)!.push(approval);
  }

  return Array.from(roundMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([round, roundApprovals]) => ({ round, approvals: roundApprovals }));
}

export async function getAdminVoteCounts(registrationIds: string[], registrations?: SebayatRegistration[]): Promise<Record<string, { approvedCount: number; rejectedCount: number; totalAdmins: number }>> {
  if (registrationIds.length === 0) return {};

  const roundMap = new Map<string, number>();
  if (registrations) {
    for (const reg of registrations) {
      roundMap.set(reg.id, reg.submission_round ?? 1);
    }
  }

  const [approvalsRes, adminCountRes] = await Promise.all([
    supabase
      .from("registration_approvals")
      .select("registration_id, action, submission_round")
      .in("registration_id", registrationIds),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true),
  ]);

  const totalAdmins = adminCountRes.count || 0;
  const result: Record<string, { approvedCount: number; rejectedCount: number; totalAdmins: number }> = {};

  for (const id of registrationIds) {
    result[id] = { approvedCount: 0, rejectedCount: 0, totalAdmins };
  }

  for (const row of approvalsRes.data || []) {
    const entry = result[row.registration_id];
    if (!entry) continue;
    const expectedRound = roundMap.get(row.registration_id) ?? 1;
    if (row.submission_round !== expectedRound) continue;
    if (row.action === "approved") entry.approvedCount++;
    if (row.action === "rejected") entry.rejectedCount++;
  }

  return result;
}

export async function castAdminVote(
  registrationId: string,
  adminId: string,
  action: "approved" | "rejected",
  rejectionReason?: string,
  rejectionType?: "wrong_data" | "management_decision"
): Promise<void> {
  const regRes = await supabase
    .from("sebayat_registrations")
    .select("submission_round")
    .eq("id", registrationId)
    .maybeSingle();

  const currentRound = (regRes.data as { submission_round: number } | null)?.submission_round ?? 1;

  const { error } = await supabase
    .from("registration_approvals")
    .upsert(
      {
        registration_id: registrationId,
        admin_id: adminId,
        action,
        submission_round: currentRound,
        rejection_reason: action === "rejected" ? (rejectionReason || null) : null,
        rejection_type: action === "rejected" ? (rejectionType || null) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "registration_id,admin_id,submission_round" }
    );

  if (error) throw error;
}

export async function approveRegistration(
  registrationId: string,
  adminId: string
): Promise<SebayatRegistration> {
  await castAdminVote(registrationId, adminId, "approved");

  const { data, error } = await supabase
    .from("sebayat_registrations")
    .select()
    .eq("id", registrationId)
    .single();

  if (error) throw error;
  const registration = data as SebayatRegistration;

  if (registration.approval_status === "approved") {
    await sendStatusNotification(
      registration.user_id,
      "Registration Approved",
      "Congratulations! Your Sebayat registration has been approved.",
      "registration_approved"
    );
  }

  return registration;
}

export async function overrideApproveRejected(
  registrationId: string,
  adminId: string
): Promise<SebayatRegistration> {
  // Get the current submission round
  const regRes = await supabase
    .from("sebayat_registrations")
    .select("submission_round")
    .eq("id", registrationId)
    .maybeSingle();

  const currentRound = (regRes.data as { submission_round: number } | null)?.submission_round ?? 1;

  // Clear rejection data on all rejection votes for this round so the log is consistent
  const { error: clearError } = await supabase
    .from("registration_approvals")
    .update({
      action: "approved",
      rejection_reason: null,
      rejection_type: null,
      updated_at: new Date().toISOString(),
    })
    .eq("registration_id", registrationId)
    .eq("submission_round", currentRound)
    .eq("action", "rejected");

  if (clearError) throw clearError;

  // Ensure the overriding admin's own vote is set to approved
  await castAdminVote(registrationId, adminId, "approved");

  const { data, error } = await supabase
    .from("sebayat_registrations")
    .update({
      approval_status: "approved",
      rejection_reason: null,
      rejection_type: null,
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", registrationId)
    .eq("approval_status", "rejected")
    .select()
    .single();

  if (error) throw error;
  const registration = data as SebayatRegistration;

  await sendStatusNotification(
    registration.user_id,
    "Registration Approved",
    "Congratulations! Your Sebayat registration has been approved.",
    "registration_approved"
  );

  return registration;
}

export async function rejectRegistration(
  registrationId: string,
  adminId: string,
  reason: string,
  rejectionType: "wrong_data" | "management_decision"
): Promise<SebayatRegistration> {
  await castAdminVote(registrationId, adminId, "rejected", reason, rejectionType);

  const { data, error } = await supabase
    .from("sebayat_registrations")
    .update({ rejection_type: rejectionType })
    .eq("id", registrationId)
    .select()
    .single();

  if (error) throw error;
  const registration = data as SebayatRegistration;

  await sendStatusNotification(
    registration.user_id,
    "Registration Rejected",
    `Your registration was rejected. Reason: ${reason}`,
    "registration_rejected"
  );

  return registration;
}

async function sendStatusNotification(
  userId: string,
  title: string,
  body: string,
  type: string
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("expo_push_token")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.expo_push_token) {
    const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

    await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        userId,
        pushToken: profile.expo_push_token,
        title,
        body,
        type,
      }),
    });
  }
}
