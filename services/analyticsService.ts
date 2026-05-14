import { supabase } from "@/lib/supabase";

export interface DailyStats {
  date: string;
  totalEntries: number;
  totalDevotees: number;
  verifiedEntries: number;
  flaggedEntries: number;
  cancelledEntries: number;
}

export interface CategoryStats {
  categoryId: string;
  categoryName: string;
  totalEntries: number;
  totalDevotees: number;
}

export interface SupervisorStats {
  supervisorId: string;
  supervisorName: string;
  westGateEntries: number;
  innerGateVerifications: number;
}

export interface AnalyticsSummary {
  totalEntries: number;
  totalDevotees: number;
  totalApprovedSebayats: number;
  totalPendingSebayats: number;
  averageDevoteesPerEntry: number;
  verificationRate: number;
  verifiedEntries: number;
  flaggedEntries: number;
  dailyTrend: DailyStats[];
  categoryBreakdown: CategoryStats[];
  topSupervisors: SupervisorStats[];
}

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
}

export async function getAnalyticsSummary(
  dateFilter?: DateRangeFilter
): Promise<AnalyticsSummary> {
  const today = new Date().toISOString().split("T")[0];
  const defaultStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const startDate = dateFilter?.startDate || defaultStart;
  const endDate = dateFilter?.endDate || today;

  const [
    entriesResult,
    sebayatsResult,
    categoryResult,
    supervisorResult,
  ] = await Promise.all([
    supabase
      .from("gate_entries")
      .select("entry_date, declared_devotee_count, verified_devotee_count, status")
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .neq("status", "cancelled")
      .order("entry_date", { ascending: true }),
    supabase
      .from("sebayat_registrations")
      .select("approval_status"),
    supabase
      .from("gate_entries")
      .select("sebayat_id, declared_devotee_count, verified_devotee_count, sebayat:sebayat_registrations(category:categories(id, name))")
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .neq("status", "cancelled"),
    supabase
      .from("gate_entries")
      .select("west_gate_supervisor_id, inner_gate_supervisor_id, west_gate_supervisor:profiles!gate_entries_west_gate_supervisor_id_fkey(id, full_name), inner_gate_supervisor:profiles!gate_entries_inner_gate_supervisor_id_fkey(id, full_name)")
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .neq("status", "cancelled"),
  ]);

  const entries = entriesResult.data || [];
  const sebayats = sebayatsResult.data || [];
  const categoryEntries = categoryResult.data || [];
  const supervisorEntries = supervisorResult.data || [];

  const totalEntries = entries.length;
  const totalDevotees = entries.reduce((sum, e) => {
    return sum + (e.verified_devotee_count ?? e.declared_devotee_count);
  }, 0);

  const totalApprovedSebayats = sebayats.filter(
    (s) => s.approval_status === "approved"
  ).length;
  const totalPendingSebayats = sebayats.filter(
    (s) => s.approval_status === "pending"
  ).length;

  const averageDevoteesPerEntry =
    totalEntries > 0
      ? Math.round((totalDevotees / totalEntries) * 10) / 10
      : 0;

  const verifiedCount = entries.filter((e) => e.status === "verified").length;
  const flaggedCount = entries.filter((e) => e.status === "discrepancy_flagged").length;
  const verificationRate =
    totalEntries > 0
      ? Math.round((verifiedCount / totalEntries) * 100)
      : 0;

  const dailyMap = new Map<string, DailyStats>();
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    dailyMap.set(dateStr, {
      date: dateStr,
      totalEntries: 0,
      totalDevotees: 0,
      verifiedEntries: 0,
      flaggedEntries: 0,
      cancelledEntries: 0,
    });
  }
  entries.forEach((e) => {
    const stat = dailyMap.get(e.entry_date);
    if (stat) {
      stat.totalEntries++;
      stat.totalDevotees +=
        e.verified_devotee_count ?? e.declared_devotee_count;
      if (e.status === "verified") stat.verifiedEntries++;
      if (e.status === "discrepancy_flagged") stat.flaggedEntries++;
    }
  });
  const dailyTrend = Array.from(dailyMap.values());

  const categoryMap = new Map<
    string,
    { id: string; name: string; entries: number; devotees: number }
  >();
  categoryEntries.forEach((e: any) => {
    const cat = e.sebayat?.category;
    if (cat) {
      const existing = categoryMap.get(cat.id) || {
        id: cat.id,
        name: cat.name,
        entries: 0,
        devotees: 0,
      };
      existing.entries++;
      existing.devotees +=
        e.verified_devotee_count ?? e.declared_devotee_count;
      categoryMap.set(cat.id, existing);
    }
  });
  const categoryBreakdown: CategoryStats[] = Array.from(categoryMap.values())
    .map((c) => ({
      categoryId: c.id,
      categoryName: c.name,
      totalEntries: c.entries,
      totalDevotees: c.devotees,
    }))
    .sort((a, b) => b.totalDevotees - a.totalDevotees);

  const supervisorMap = new Map<
    string,
    { id: string; name: string; westGate: number; innerGate: number }
  >();
  supervisorEntries.forEach((e: any) => {
    if (e.west_gate_supervisor) {
      const sup = e.west_gate_supervisor;
      const existing = supervisorMap.get(sup.id) || {
        id: sup.id,
        name: sup.full_name || "Unknown",
        westGate: 0,
        innerGate: 0,
      };
      existing.westGate++;
      supervisorMap.set(sup.id, existing);
    }
    if (e.inner_gate_supervisor) {
      const sup = e.inner_gate_supervisor;
      const existing = supervisorMap.get(sup.id) || {
        id: sup.id,
        name: sup.full_name || "Unknown",
        westGate: 0,
        innerGate: 0,
      };
      existing.innerGate++;
      supervisorMap.set(sup.id, existing);
    }
  });
  const topSupervisors: SupervisorStats[] = Array.from(supervisorMap.values())
    .map((s) => ({
      supervisorId: s.id,
      supervisorName: s.name,
      westGateEntries: s.westGate,
      innerGateVerifications: s.innerGate,
    }))
    .sort((a, b) => b.westGateEntries + b.innerGateVerifications - (a.westGateEntries + a.innerGateVerifications))
    .slice(0, 10);

  return {
    totalEntries,
    totalDevotees,
    totalApprovedSebayats,
    totalPendingSebayats,
    averageDevoteesPerEntry,
    verificationRate,
    verifiedEntries: verifiedCount,
    flaggedEntries: flaggedCount,
    dailyTrend,
    categoryBreakdown,
    topSupervisors,
  };
}

export interface ReportFilters {
  startDate: string;
  endDate: string;
  status?: string;
  categoryId?: string;
  supervisorId?: string;
}

export interface EntryReport {
  id: string;
  entryCode: string;
  entryDate: string;
  sebayatName: string;
  categoryName: string;
  declaredCount: number;
  verifiedCount: number | null;
  status: string;
  westGateSupervisor: string | null;
  innerGateSupervisor: string | null;
  westGateTime: string | null;
  innerGateTime: string | null;
}

export interface ReportSummary {
  totalEntries: number;
  totalDeclaredDevotees: number;
  totalVerifiedDevotees: number;
  statusBreakdown: Record<string, number>;
  entries: EntryReport[];
}

export async function generateReport(
  filters: ReportFilters
): Promise<ReportSummary> {
  let query = supabase
    .from("gate_entries")
    .select(
      `
      id,
      entry_code,
      entry_date,
      declared_devotee_count,
      verified_devotee_count,
      status,
      west_gate_entry_time,
      inner_gate_verification_time,
      sebayat:sebayat_registrations(full_name, category:categories(id, name)),
      west_gate_supervisor:profiles!gate_entries_west_gate_supervisor_id_fkey(full_name),
      inner_gate_supervisor:profiles!gate_entries_inner_gate_supervisor_id_fkey(full_name)
    `
    )
    .gte("entry_date", filters.startDate)
    .lte("entry_date", filters.endDate)
    .order("entry_date", { ascending: false })
    .order("west_gate_entry_time", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error generating report:", error);
    return {
      totalEntries: 0,
      totalDeclaredDevotees: 0,
      totalVerifiedDevotees: 0,
      statusBreakdown: {},
      entries: [],
    };
  }

  let entries = (data || []) as any[];

  if (filters.categoryId) {
    entries = entries.filter(
      (e) => e.sebayat?.category?.id === filters.categoryId
    );
  }

  const statusBreakdown: Record<string, number> = {};
  let totalDeclaredDevotees = 0;
  let totalVerifiedDevotees = 0;

  const formattedEntries: EntryReport[] = entries.map((e) => {
    statusBreakdown[e.status] = (statusBreakdown[e.status] || 0) + 1;
    totalDeclaredDevotees += e.declared_devotee_count;
    totalVerifiedDevotees += e.verified_devotee_count ?? 0;

    return {
      id: e.id,
      entryCode: e.entry_code,
      entryDate: e.entry_date,
      sebayatName: e.sebayat?.full_name || "Unknown",
      categoryName: e.sebayat?.category?.name || "Uncategorized",
      declaredCount: e.declared_devotee_count,
      verifiedCount: e.verified_devotee_count,
      status: e.status,
      westGateSupervisor: e.west_gate_supervisor?.full_name || null,
      innerGateSupervisor: e.inner_gate_supervisor?.full_name || null,
      westGateTime: e.west_gate_entry_time,
      innerGateTime: e.inner_gate_verification_time,
    };
  });

  return {
    totalEntries: entries.length,
    totalDeclaredDevotees,
    totalVerifiedDevotees,
    statusBreakdown,
    entries: formattedEntries,
  };
}

export async function getMonthlyTrend(
  months: number = 6
): Promise<{ month: string; entries: number; devotees: number }[]> {
  const results: { month: string; entries: number; devotees: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    const { data } = await supabase
      .from("gate_entries")
      .select("declared_devotee_count, verified_devotee_count")
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .neq("status", "cancelled");

    const entries = data || [];
    const totalDevotees = entries.reduce(
      (sum, e) => sum + (e.verified_devotee_count ?? e.declared_devotee_count),
      0
    );

    results.push({
      month: date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      entries: entries.length,
      devotees: totalDevotees,
    });
  }

  return results;
}

export interface SebayatReportItem {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  categoryName: string;
  photoUrl: string | null;
  totalEntries: number;
  totalDevotees: number;
  verifiedEntries: number;
  flaggedEntries: number;
  lastEntryDate: string | null;
}

export interface SebayatDetailedReport {
  sebayat: SebayatReportItem;
  entries: EntryReport[];
  dailyTrend: { date: string; devotees: number }[];
}

export async function getSebayatList(): Promise<SebayatReportItem[]> {
  const { data: sebayats, error } = await supabase
    .from("sebayat_registrations")
    .select("id, full_name, phone_number, photo_url, category:categories(name)")
    .eq("approval_status", "approved")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching sebayats:", error);
    return [];
  }

  const { data: entries } = await supabase
    .from("gate_entries")
    .select("sebayat_id, declared_devotee_count, verified_devotee_count, status, entry_date")
    .neq("status", "cancelled");

  const entryMap = new Map<string, {
    total: number;
    devotees: number;
    verified: number;
    flagged: number;
    lastDate: string | null;
  }>();

  (entries || []).forEach((e: any) => {
    const existing = entryMap.get(e.sebayat_id) || {
      total: 0,
      devotees: 0,
      verified: 0,
      flagged: 0,
      lastDate: null,
    };
    existing.total++;
    existing.devotees += e.verified_devotee_count ?? e.declared_devotee_count;
    if (e.status === "verified") existing.verified++;
    if (e.status === "discrepancy_flagged") existing.flagged++;
    if (!existing.lastDate || e.entry_date > existing.lastDate) {
      existing.lastDate = e.entry_date;
    }
    entryMap.set(e.sebayat_id, existing);
  });

  return (sebayats || []).map((s: any) => {
    const stats = entryMap.get(s.id) || {
      total: 0,
      devotees: 0,
      verified: 0,
      flagged: 0,
      lastDate: null,
    };
    return {
      id: s.id,
      fullName: s.full_name,
      phoneNumber: s.phone_number,
      categoryName: s.category?.name || "Uncategorized",
      photoUrl: s.photo_url,
      totalEntries: stats.total,
      totalDevotees: stats.devotees,
      verifiedEntries: stats.verified,
      flaggedEntries: stats.flagged,
      lastEntryDate: stats.lastDate,
    };
  });
}

export async function getSebayatDetailedReport(
  sebayatId: string,
  startDate: string,
  endDate: string
): Promise<SebayatDetailedReport | null> {
  const { data: sebayat, error: sebayatError } = await supabase
    .from("sebayat_registrations")
    .select("id, full_name, phone_number, photo_url, category:categories(name)")
    .eq("id", sebayatId)
    .maybeSingle();

  if (sebayatError || !sebayat) {
    console.error("Error fetching sebayat:", sebayatError);
    return null;
  }

  const { data: entries, error: entriesError } = await supabase
    .from("gate_entries")
    .select(`
      id,
      entry_code,
      entry_date,
      declared_devotee_count,
      verified_devotee_count,
      status,
      west_gate_entry_time,
      inner_gate_verification_time,
      west_gate_supervisor:profiles!gate_entries_west_gate_supervisor_id_fkey(full_name),
      inner_gate_supervisor:profiles!gate_entries_inner_gate_supervisor_id_fkey(full_name)
    `)
    .eq("sebayat_id", sebayatId)
    .gte("entry_date", startDate)
    .lte("entry_date", endDate)
    .order("entry_date", { ascending: false });

  if (entriesError) {
    console.error("Error fetching entries:", entriesError);
    return null;
  }

  const entryList = entries || [];
  let totalEntries = 0;
  let totalDevotees = 0;
  let verifiedEntries = 0;
  let flaggedEntries = 0;
  let lastEntryDate: string | null = null;

  const dailyMap = new Map<string, number>();

  const formattedEntries: EntryReport[] = entryList.map((e: any) => {
    totalEntries++;
    const devotees = e.verified_devotee_count ?? e.declared_devotee_count;
    totalDevotees += devotees;
    if (e.status === "verified") verifiedEntries++;
    if (e.status === "discrepancy_flagged") flaggedEntries++;
    if (!lastEntryDate || e.entry_date > lastEntryDate) {
      lastEntryDate = e.entry_date;
    }

    dailyMap.set(e.entry_date, (dailyMap.get(e.entry_date) || 0) + devotees);

    return {
      id: e.id,
      entryCode: e.entry_code,
      entryDate: e.entry_date,
      sebayatName: (sebayat as any).full_name,
      categoryName: (sebayat as any).category?.name || "Uncategorized",
      declaredCount: e.declared_devotee_count,
      verifiedCount: e.verified_devotee_count,
      status: e.status,
      westGateSupervisor: e.west_gate_supervisor?.full_name || null,
      innerGateSupervisor: e.inner_gate_supervisor?.full_name || null,
      westGateTime: e.west_gate_entry_time,
      innerGateTime: e.inner_gate_verification_time,
    };
  });

  const dailyTrend = Array.from(dailyMap.entries())
    .map(([date, devotees]) => ({ date, devotees }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    sebayat: {
      id: sebayat.id,
      fullName: (sebayat as any).full_name,
      phoneNumber: (sebayat as any).phone_number,
      categoryName: (sebayat as any).category?.name || "Uncategorized",
      photoUrl: (sebayat as any).photo_url,
      totalEntries,
      totalDevotees,
      verifiedEntries,
      flaggedEntries,
      lastEntryDate,
    },
    entries: formattedEntries,
    dailyTrend,
  };
}

export interface SupervisorReportItem {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  westGateEntries: number;
  westGateDevotees: number;
  innerGateVerifications: number;
  innerGateDevotees: number;
  flaggedEntries: number;
  lastActivityDate: string | null;
}

export interface SupervisorDetailedReport {
  supervisor: SupervisorReportItem;
  westGateEntries: EntryReport[];
  innerGateEntries: EntryReport[];
  dailyActivity: { date: string; westGate: number; innerGate: number }[];
}

export interface DevoteeAnalyticsSummary {
  totalDevotees: number;
  totalEntries: number;
  averageDevoteesPerEntry: number;
  peakDayDevotees: number;
  peakDayDate: string | null;
  weekdayDistribution: { day: string; devotees: number; entries: number }[];
  hourlyDistribution: { hour: string; devotees: number }[];
  categoryDistribution: { category: string; devotees: number; percentage: number }[];
  dailyTrend: { date: string; devotees: number; entries: number }[];
  monthlyComparison: { month: string; currentYear: number; previousYear: number }[];
}

export async function getSupervisorList(): Promise<SupervisorReportItem[]> {
  const { data: supervisors, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone_number, role")
    .in("role", ["supervisor", "admin", "superadmin"])
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching supervisors:", error);
    return [];
  }

  const { data: entries } = await supabase
    .from("gate_entries")
    .select("west_gate_supervisor_id, inner_gate_supervisor_id, declared_devotee_count, verified_devotee_count, status, entry_date")
    .neq("status", "cancelled");

  const statsMap = new Map<string, {
    westGateEntries: number;
    westGateDevotees: number;
    innerGateVerifications: number;
    innerGateDevotees: number;
    flaggedEntries: number;
    lastActivityDate: string | null;
  }>();

  (entries || []).forEach((e: any) => {
    const devotees = e.verified_devotee_count ?? e.declared_devotee_count;

    if (e.west_gate_supervisor_id) {
      const existing = statsMap.get(e.west_gate_supervisor_id) || {
        westGateEntries: 0,
        westGateDevotees: 0,
        innerGateVerifications: 0,
        innerGateDevotees: 0,
        flaggedEntries: 0,
        lastActivityDate: null,
      };
      existing.westGateEntries++;
      existing.westGateDevotees += devotees;
      if (e.status === "discrepancy_flagged") existing.flaggedEntries++;
      if (!existing.lastActivityDate || e.entry_date > existing.lastActivityDate) {
        existing.lastActivityDate = e.entry_date;
      }
      statsMap.set(e.west_gate_supervisor_id, existing);
    }

    if (e.inner_gate_supervisor_id) {
      const existing = statsMap.get(e.inner_gate_supervisor_id) || {
        westGateEntries: 0,
        westGateDevotees: 0,
        innerGateVerifications: 0,
        innerGateDevotees: 0,
        flaggedEntries: 0,
        lastActivityDate: null,
      };
      existing.innerGateVerifications++;
      existing.innerGateDevotees += devotees;
      if (e.status === "discrepancy_flagged") existing.flaggedEntries++;
      if (!existing.lastActivityDate || e.entry_date > existing.lastActivityDate) {
        existing.lastActivityDate = e.entry_date;
      }
      statsMap.set(e.inner_gate_supervisor_id, existing);
    }
  });

  return (supervisors || []).map((s: any) => {
    const stats = statsMap.get(s.id) || {
      westGateEntries: 0,
      westGateDevotees: 0,
      innerGateVerifications: 0,
      innerGateDevotees: 0,
      flaggedEntries: 0,
      lastActivityDate: null,
    };
    return {
      id: s.id,
      fullName: s.full_name || "Unknown",
      phoneNumber: s.phone_number,
      role: s.role,
      ...stats,
    };
  });
}

export async function getSupervisorDetailedReport(
  supervisorId: string,
  startDate: string,
  endDate: string
): Promise<SupervisorDetailedReport | null> {
  const { data: supervisor, error: supervisorError } = await supabase
    .from("profiles")
    .select("id, full_name, phone_number, role")
    .eq("id", supervisorId)
    .maybeSingle();

  if (supervisorError || !supervisor) {
    console.error("Error fetching supervisor:", supervisorError);
    return null;
  }

  const [westGateResult, innerGateResult] = await Promise.all([
    supabase
      .from("gate_entries")
      .select(`
        id,
        entry_code,
        entry_date,
        declared_devotee_count,
        verified_devotee_count,
        status,
        west_gate_entry_time,
        inner_gate_verification_time,
        sebayat:sebayat_registrations(full_name, category:categories(name)),
        inner_gate_supervisor:profiles!gate_entries_inner_gate_supervisor_id_fkey(full_name)
      `)
      .eq("west_gate_supervisor_id", supervisorId)
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .order("entry_date", { ascending: false }),
    supabase
      .from("gate_entries")
      .select(`
        id,
        entry_code,
        entry_date,
        declared_devotee_count,
        verified_devotee_count,
        status,
        west_gate_entry_time,
        inner_gate_verification_time,
        sebayat:sebayat_registrations(full_name, category:categories(name)),
        west_gate_supervisor:profiles!gate_entries_west_gate_supervisor_id_fkey(full_name)
      `)
      .eq("inner_gate_supervisor_id", supervisorId)
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .order("entry_date", { ascending: false }),
  ]);

  const westGateEntries = westGateResult.data || [];
  const innerGateEntries = innerGateResult.data || [];

  let westGateTotal = 0;
  let westGateDevotees = 0;
  let innerGateTotal = 0;
  let innerGateDevotees = 0;
  let flaggedEntries = 0;
  let lastActivityDate: string | null = null;

  const dailyMap = new Map<string, { westGate: number; innerGate: number }>();

  const formatEntry = (e: any, isWestGate: boolean): EntryReport => {
    const devotees = e.verified_devotee_count ?? e.declared_devotee_count;

    if (isWestGate) {
      westGateTotal++;
      westGateDevotees += devotees;
    } else {
      innerGateTotal++;
      innerGateDevotees += devotees;
    }

    if (e.status === "discrepancy_flagged") flaggedEntries++;
    if (!lastActivityDate || e.entry_date > lastActivityDate) {
      lastActivityDate = e.entry_date;
    }

    const daily = dailyMap.get(e.entry_date) || { westGate: 0, innerGate: 0 };
    if (isWestGate) {
      daily.westGate++;
    } else {
      daily.innerGate++;
    }
    dailyMap.set(e.entry_date, daily);

    return {
      id: e.id,
      entryCode: e.entry_code,
      entryDate: e.entry_date,
      sebayatName: e.sebayat?.full_name || "Unknown",
      categoryName: e.sebayat?.category?.name || "Uncategorized",
      declaredCount: e.declared_devotee_count,
      verifiedCount: e.verified_devotee_count,
      status: e.status,
      westGateSupervisor: isWestGate ? (supervisor as any).full_name : (e.west_gate_supervisor?.full_name || null),
      innerGateSupervisor: !isWestGate ? (supervisor as any).full_name : (e.inner_gate_supervisor?.full_name || null),
      westGateTime: e.west_gate_entry_time,
      innerGateTime: e.inner_gate_verification_time,
    };
  };

  const formattedWestGate = westGateEntries.map((e) => formatEntry(e, true));
  const formattedInnerGate = innerGateEntries.map((e) => formatEntry(e, false));

  const dailyActivity = Array.from(dailyMap.entries())
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    supervisor: {
      id: supervisor.id,
      fullName: (supervisor as any).full_name || "Unknown",
      phoneNumber: (supervisor as any).phone_number,
      role: (supervisor as any).role,
      westGateEntries: westGateTotal,
      westGateDevotees,
      innerGateVerifications: innerGateTotal,
      innerGateDevotees,
      flaggedEntries,
      lastActivityDate,
    },
    westGateEntries: formattedWestGate,
    innerGateEntries: formattedInnerGate,
    dailyActivity,
  };
}

export async function getDevoteeAnalytics(
  dateFilter?: DateRangeFilter
): Promise<DevoteeAnalyticsSummary> {
  const today = new Date().toISOString().split("T")[0];
  const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const startDate = dateFilter?.startDate || defaultStart;
  const endDate = dateFilter?.endDate || today;

  const { data: entries, error } = await supabase
    .from("gate_entries")
    .select(`
      entry_date,
      declared_devotee_count,
      verified_devotee_count,
      west_gate_entry_time,
      status,
      sebayat:sebayat_registrations(category:categories(name))
    `)
    .gte("entry_date", startDate)
    .lte("entry_date", endDate)
    .neq("status", "cancelled")
    .order("entry_date", { ascending: true });

  if (error) {
    console.error("Error fetching devotee analytics:", error);
    return {
      totalDevotees: 0,
      totalEntries: 0,
      averageDevoteesPerEntry: 0,
      peakDayDevotees: 0,
      peakDayDate: null,
      weekdayDistribution: [],
      hourlyDistribution: [],
      categoryDistribution: [],
      dailyTrend: [],
      monthlyComparison: [],
    };
  }

  const entryList = entries || [];
  let totalDevotees = 0;
  let peakDayDevotees = 0;
  let peakDayDate: string | null = null;

  const dailyMap = new Map<string, { devotees: number; entries: number }>();
  const weekdayMap = new Map<string, { devotees: number; entries: number }>();
  const hourlyMap = new Map<number, number>();
  const categoryMap = new Map<string, number>();

  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  weekdays.forEach((day) => weekdayMap.set(day, { devotees: 0, entries: 0 }));
  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, 0);
  }

  entryList.forEach((e: any) => {
    const devotees = e.verified_devotee_count ?? e.declared_devotee_count;
    totalDevotees += devotees;

    const daily = dailyMap.get(e.entry_date) || { devotees: 0, entries: 0 };
    daily.devotees += devotees;
    daily.entries++;
    dailyMap.set(e.entry_date, daily);

    if (daily.devotees > peakDayDevotees) {
      peakDayDevotees = daily.devotees;
      peakDayDate = e.entry_date;
    }

    const dayOfWeek = new Date(e.entry_date).getDay();
    const weekdayName = weekdays[dayOfWeek];
    const weekdayStat = weekdayMap.get(weekdayName)!;
    weekdayStat.devotees += devotees;
    weekdayStat.entries++;

    if (e.west_gate_entry_time) {
      const hour = new Date(e.west_gate_entry_time).getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + devotees);
    }

    const categoryName = e.sebayat?.category?.name || "Uncategorized";
    categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + devotees);
  });

  const totalEntries = entryList.length;
  const averageDevoteesPerEntry = totalEntries > 0
    ? Math.round((totalDevotees / totalEntries) * 10) / 10
    : 0;

  const weekdayDistribution = weekdays.map((day) => ({
    day: day.slice(0, 3),
    ...weekdayMap.get(day)!,
  }));

  const hourlyDistribution = Array.from(hourlyMap.entries())
    .map(([hour, devotees]) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      devotees,
    }))
    .filter((h) => h.devotees > 0);

  const categoryTotal = Array.from(categoryMap.values()).reduce((a, b) => a + b, 0);
  const categoryDistribution = Array.from(categoryMap.entries())
    .map(([category, devotees]) => ({
      category,
      devotees,
      percentage: categoryTotal > 0 ? Math.round((devotees / categoryTotal) * 100) : 0,
    }))
    .sort((a, b) => b.devotees - a.devotees);

  const dailyTrend = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const currentYear = new Date().getFullYear();
  const monthlyComparison: { month: string; currentYear: number; previousYear: number }[] = [];

  for (let m = 0; m < 12; m++) {
    const monthName = new Date(currentYear, m, 1).toLocaleDateString("en-IN", { month: "short" });
    const currentYearStart = `${currentYear}-${String(m + 1).padStart(2, "0")}-01`;
    const currentYearEnd = new Date(currentYear, m + 1, 0).toISOString().split("T")[0];
    const previousYearStart = `${currentYear - 1}-${String(m + 1).padStart(2, "0")}-01`;
    const previousYearEnd = new Date(currentYear - 1, m + 1, 0).toISOString().split("T")[0];

    const currentYearDevotees = entryList
      .filter((e: any) => e.entry_date >= currentYearStart && e.entry_date <= currentYearEnd)
      .reduce((sum: number, e: any) => sum + (e.verified_devotee_count ?? e.declared_devotee_count), 0);

    monthlyComparison.push({
      month: monthName,
      currentYear: currentYearDevotees,
      previousYear: 0,
    });
  }

  return {
    totalDevotees,
    totalEntries,
    averageDevoteesPerEntry,
    peakDayDevotees,
    peakDayDate,
    weekdayDistribution,
    hourlyDistribution,
    categoryDistribution,
    dailyTrend,
    monthlyComparison,
  };
}
