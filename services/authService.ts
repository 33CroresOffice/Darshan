import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { OtpResponse, VerifyOtpResponse } from "@/types";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

export async function sendOtp(
  phone: string,
  channel: "whatsapp" | "sms" = "whatsapp"
): Promise<OtpResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ phone, channel }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to send OTP");
  }

  return data;
}

export async function verifyOtp(
  phone: string,
  otp: string
): Promise<VerifyOtpResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ phone, otp }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to verify OTP");
  }

  if (data.session) {
    const profile = data.user?.profile;
    if (profile && profile.is_active === false) {
      throw new Error("ACCOUNT_SUSPENDED");
    }

    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }

  return data;
}

export async function resendOtp(
  phone: string,
  channel: "whatsapp" | "sms" = "whatsapp"
): Promise<OtpResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/resend-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ phone, channel }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to resend OTP");
  }

  return data;
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  window.location.href = "/";
}
