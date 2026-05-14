import { supabase } from "@/lib/supabase";
import type { SystemSetting } from "@/types/database";

export async function getSystemSetting(key: string): Promise<SystemSetting | null> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .eq("setting_key", key)
    .maybeSingle();

  if (error) {
    console.error("Error fetching setting:", error);
    return null;
  }

  return data;
}

export async function getMaxDevoteesPerDay(): Promise<number> {
  const setting = await getSystemSetting("max_devotees_per_day");
  if (setting && typeof setting.setting_value?.value === "number") {
    return setting.setting_value.value;
  }
  return 50;
}

export async function getTicketValidityMinutes(): Promise<number> {
  const setting = await getSystemSetting("ticket_validity_minutes");
  if (setting) {
    const value = setting.setting_value?.value ?? setting.setting_value;
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return 120;
}

export async function updateSystemSetting(
  key: string,
  value: number | string | boolean,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("system_settings")
    .update({
      setting_value: { value },
      updated_by: userId,
    })
    .eq("setting_key", key);

  if (error) {
    console.error("Error updating setting:", error);
    return { success: false, message: error.message };
  }

  return { success: true, message: "Setting updated successfully" };
}

export async function getDailyBookingCapPerUser(): Promise<number> {
  const setting = await getSystemSetting("daily_booking_cap_per_user");
  if (setting) {
    const value = setting.setting_value?.value ?? setting.setting_value;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return 30;
}

export type OtpChannels = { whatsapp: boolean; sms: boolean };

export async function getOtpChannels(): Promise<OtpChannels> {
  const setting = await getSystemSetting("otp_channels");
  if (setting?.setting_value) {
    const v = setting.setting_value as any;
    return {
      whatsapp: v.whatsapp !== false,
      sms: v.sms !== false,
    };
  }
  return { whatsapp: true, sms: true };
}

export async function updateOtpChannels(
  channels: OtpChannels,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("system_settings")
    .update({ setting_value: channels, updated_by: userId })
    .eq("setting_key", "otp_channels");

  if (error) {
    console.error("Error updating otp_channels:", error);
    return { success: false, message: error.message };
  }
  return { success: true, message: "OTP channel settings updated" };
}

export async function getTempleIdCardEnabled(): Promise<boolean> {
  const setting = await getSystemSetting("temple_id_card_enabled");
  if (setting) {
    const v = setting.setting_value?.value ?? setting.setting_value;
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v !== "false";
  }
  return true;
}

export async function updateTempleIdCardEnabled(
  enabled: boolean,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("system_settings")
    .update({ setting_value: { value: enabled }, updated_by: userId })
    .eq("setting_key", "temple_id_card_enabled");

  if (error) {
    console.error("Error updating temple_id_card_enabled:", error);
    return { success: false, message: error.message };
  }
  return { success: true, message: "Temple ID card setting updated" };
}

export async function getDarshanSlotsEnabled(): Promise<boolean> {
  const setting = await getSystemSetting("darshan_slots_enabled");
  if (setting) {
    const v = setting.setting_value?.value ?? setting.setting_value;
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v !== "false";
  }
  return true;
}

export async function updateDarshanSlotsEnabled(
  enabled: boolean,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("system_settings")
    .update({ setting_value: { value: enabled }, updated_by: userId })
    .eq("setting_key", "darshan_slots_enabled");

  if (error) {
    console.error("Error updating darshan_slots_enabled:", error);
    return { success: false, message: error.message };
  }
  return { success: true, message: "Darshan slots setting updated" };
}

export type ApprovalRule = "all_admins" | "majority" | "any_admin" | "superadmin_only";

export async function getApprovalRule(): Promise<ApprovalRule> {
  const setting = await getSystemSetting("approval_rule");
  if (setting) {
    const v = setting.setting_value?.value ?? setting.setting_value;
    if (typeof v === "string" && ["all_admins", "majority", "any_admin", "superadmin_only"].includes(v)) {
      return v as ApprovalRule;
    }
  }
  return "all_admins";
}

export async function updateApprovalRule(
  rule: ApprovalRule,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("system_settings")
    .update({ setting_value: { value: rule }, updated_by: userId })
    .eq("setting_key", "approval_rule");

  if (error) {
    console.error("Error updating approval_rule:", error);
    return { success: false, message: error.message };
  }
  return { success: true, message: "Approval rule updated" };
}

export async function getPrintTokenEnabled(): Promise<boolean> {
  const setting = await getSystemSetting("print_token_enabled");
  if (setting) {
    const v = setting.setting_value?.value ?? setting.setting_value;
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v !== "false";
  }
  return false;
}

export async function updatePrintTokenEnabled(
  enabled: boolean,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("system_settings")
    .update({ setting_value: { value: enabled }, updated_by: userId })
    .eq("setting_key", "print_token_enabled");

  if (error) {
    console.error("Error updating print_token_enabled:", error);
    return { success: false, message: error.message };
  }
  return { success: true, message: "Print token setting updated" };
}

export async function getPrintTokenIncludePhoto(): Promise<boolean> {
  const setting = await getSystemSetting("print_token_include_photo");
  if (setting) {
    const v = setting.setting_value?.value ?? setting.setting_value;
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v !== "false";
  }
  return false;
}

export async function updatePrintTokenIncludePhoto(
  enabled: boolean,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("system_settings")
    .update({ setting_value: { value: enabled }, updated_by: userId })
    .eq("setting_key", "print_token_include_photo");

  if (error) {
    console.error("Error updating print_token_include_photo:", error);
    return { success: false, message: error.message };
  }
  return { success: true, message: "Print token photo setting updated" };
}

export async function getOfflineModeEnabled(): Promise<boolean> {
  const setting = await getSystemSetting("offline_mode_enabled");
  if (setting) {
    const v = setting.setting_value?.value ?? setting.setting_value;
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v !== "false";
  }
  return true; // safe default: offline always works unless server explicitly says off
}

export async function updateOfflineModeEnabled(
  enabled: boolean,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("system_settings")
    .update({ setting_value: { value: enabled }, updated_by: userId })
    .eq("setting_key", "offline_mode_enabled");

  if (error) {
    console.error("Error updating offline_mode_enabled:", error);
    return { success: false, message: error.message };
  }
  return { success: true, message: "Offline mode setting updated" };
}

export async function getAllSettings(): Promise<SystemSetting[]> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .order("setting_key");

  if (error) {
    console.error("Error fetching settings:", error);
    return [];
  }

  return data || [];
}
