import { supabase } from "@/lib/supabase";
import type { Profile, UserRole, SebayatRegistration } from "@/types";

export interface UserWithDetails extends Profile {
  registration_status?: string;
  photo_url?: string | null;
}

export interface ApprovedSebayatForPromotion {
  user_id: string;
  full_name: string;
  phone_number: string;
  photo_url: string | null;
  category_name: string | null;
  current_role: UserRole;
  registration_id: string;
}

export async function getAllUsers(): Promise<UserWithDetails[]> {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (profilesError) throw profilesError;

  if (!profiles || profiles.length === 0) {
    return [];
  }

  const userIds = profiles.map((p) => p.id);
  const { data: registrations } = await supabase
    .from("sebayat_registrations")
    .select("user_id, photo_url, full_name")
    .in("user_id", userIds);

  const photoMap = new Map<string, string>();
  const nameMap = new Map<string, string>();
  if (registrations) {
    for (const reg of registrations) {
      if (reg.photo_url && !photoMap.has(reg.user_id)) {
        photoMap.set(reg.user_id, reg.photo_url);
      }
      if (reg.full_name && !nameMap.has(reg.user_id)) {
        nameMap.set(reg.user_id, reg.full_name);
      }
    }
  }

  return profiles.map((user) => ({
    ...user,
    full_name: user.full_name || nameMap.get(user.id) || null,
    photo_url: photoMap.get(user.id) || user.avatar_url || null,
  })) as UserWithDetails[];
}

const PAGE_SIZE = 5;

export async function getUsersPaginated(options: {
  page: number;
  role?: UserRole | "all";
  search?: string;
}): Promise<{ users: UserWithDetails[]; hasMore: boolean }> {
  const { page, role, search } = options;
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (role && role !== "all") {
    query = query.eq("role", role);
  }

  if (search && search.trim()) {
    const s = search.trim();
    query = query.or(`full_name.ilike.%${s}%,phone_number.ilike.%${s}%`);
  }

  const { data: profiles, error } = await query;
  if (error) throw error;
  if (!profiles || profiles.length === 0) return { users: [], hasMore: false };

  const userIds = profiles.map((p) => p.id);
  const { data: registrations } = await supabase
    .from("sebayat_registrations")
    .select("user_id, photo_url, full_name")
    .in("user_id", userIds);

  const photoMap = new Map<string, string>();
  const nameMap = new Map<string, string>();
  if (registrations) {
    for (const reg of registrations) {
      if (reg.photo_url && !photoMap.has(reg.user_id)) {
        photoMap.set(reg.user_id, reg.photo_url);
      }
      if (reg.full_name && !nameMap.has(reg.user_id)) {
        nameMap.set(reg.user_id, reg.full_name);
      }
    }
  }

  const users = profiles.map((user) => ({
    ...user,
    full_name: user.full_name || nameMap.get(user.id) || null,
    photo_url: photoMap.get(user.id) || user.avatar_url || null,
  })) as UserWithDetails[];

  return { users, hasMore: profiles.length === PAGE_SIZE };
}

export async function getUsersByRole(role: UserRole): Promise<UserWithDetails[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", role)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as UserWithDetails[];
}

export async function getAdminUsers(): Promise<UserWithDetails[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("role", ["admin", "superadmin"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as UserWithDetails[];
}

export async function updateUserRole(
  userId: string,
  newRole: UserRole
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function createAdminUser(
  phone: string,
  fullName: string,
  role: "admin" | "superadmin" | "supervisor" = "admin"
): Promise<{ success: boolean; message: string; user?: Profile }> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return {
      success: false,
      message: "You must be logged in to create admin users",
    };
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/create-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": supabaseAnonKey || "",
    },
    body: JSON.stringify({ phone, fullName, role }),
  });

  const result = await response.json();
  return result;
}

export async function deleteUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (error) throw error;
}

export async function updateUserProfile(
  userId: string,
  updates: {
    full_name?: string;
    phone_number?: string;
    is_active?: boolean;
    role?: UserRole;
  }
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function toggleUserActive(
  userId: string,
  isActive: boolean
): Promise<Profile> {
  return updateUserProfile(userId, { is_active: isActive });
}

export async function getUserStats(): Promise<{
  totalUsers: number;
  totalAdmins: number;
  totalSuperadmins: number;
  totalSupervisors: number;
  totalSebayats: number;
}> {
  const [totalRes, adminRes, superadminRes, supervisorRes, sebayatRes] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "admin"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "superadmin"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "supervisor"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "sebayat"),
  ]);

  return {
    totalUsers: totalRes.count || 0,
    totalAdmins: adminRes.count || 0,
    totalSuperadmins: superadminRes.count || 0,
    totalSupervisors: supervisorRes.count || 0,
    totalSebayats: sebayatRes.count || 0,
  };
}

export async function checkApprovedSebayatRegistration(
  userId: string
): Promise<{ hasApproved: boolean; registrationId: string | null }> {
  const { data, error } = await supabase
    .from("sebayat_registrations")
    .select("id, approval_status")
    .eq("user_id", userId)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (error) {
    console.error("Error checking approved registration:", error);
    return { hasApproved: false, registrationId: null };
  }

  return {
    hasApproved: !!data,
    registrationId: data?.id ?? null,
  };
}

const PROMOTION_PAGE_SIZE = 5;

export async function getApprovedSebayatsForPromotion(
  searchQuery?: string,
  page: number = 0
): Promise<{ results: ApprovedSebayatForPromotion[]; hasMore: boolean }> {
  let query = supabase
    .from("sebayat_registrations")
    .select(`
      id,
      user_id,
      full_name,
      phone_number,
      photo_url,
      category:categories(name)
    `)
    .eq("approval_status", "approved")
    .order("full_name", { ascending: true });

  if (searchQuery && searchQuery.trim()) {
    const search = searchQuery.trim();
    query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
  }

  const from = page * PROMOTION_PAGE_SIZE;
  const to = from + PROMOTION_PAGE_SIZE;

  const { data: registrations, error: regError } = await query.range(from, to);

  if (regError || !registrations) {
    return { results: [], hasMore: false };
  }

  const hasMore = registrations.length > PROMOTION_PAGE_SIZE;
  const pageItems = hasMore ? registrations.slice(0, PROMOTION_PAGE_SIZE) : registrations;

  if (pageItems.length === 0) {
    return { results: [], hasMore: false };
  }

  const userIds = pageItems.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, role")
    .in("id", userIds);

  const roleMap = new Map<string, UserRole>();
  if (profiles) {
    for (const p of profiles) {
      roleMap.set(p.id, p.role as UserRole);
    }
  }

  return {
    results: pageItems.map((reg) => ({
      user_id: reg.user_id,
      full_name: reg.full_name,
      phone_number: reg.phone_number,
      photo_url: reg.photo_url,
      category_name: (reg.category as any)?.name ?? null,
      current_role: roleMap.get(reg.user_id) || "sebayat",
      registration_id: reg.id,
    })),
    hasMore,
  };
}

export async function getSebayatRegistrationForUser(
  userId: string
): Promise<SebayatRegistration | null> {
  const { data, error } = await supabase
    .from("sebayat_registrations")
    .select("*, category:categories(*)")
    .eq("user_id", userId)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (error) {
    console.error("Error fetching sebayat registration:", error);
    return null;
  }

  return data;
}

export async function promoteUserRole(
  userId: string,
  newRole: "admin" | "superadmin" | "supervisor" | "sebayat"
): Promise<{ success: boolean; message: string; user?: Profile }> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return {
      success: false,
      message: "You must be logged in to promote users",
    };
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/create-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": supabaseAnonKey || "",
    },
    body: JSON.stringify({ userId, role: newRole, promoteExisting: true }),
  });

  const result = await response.json();
  return result;
}
