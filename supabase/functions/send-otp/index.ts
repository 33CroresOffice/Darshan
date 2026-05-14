import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const msg91AuthKey = Deno.env.get("MSG91_AUTH_KEY");
const msg91TemplateId = Deno.env.get("MSG91_TEMPLATE_ID");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function hashOtp(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { phone, channel = "whatsapp" } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cleanedPhone = phone.replace(/\D/g, "");
    if (cleanedPhone.length !== 10) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number. Must be 10 digits." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const fullPhone = `91${cleanedPhone}`;

    const today = new Date().toISOString().split("T")[0];
    const { data: limitData } = await supabase
      .from("otp_daily_limits")
      .select("request_count")
      .eq("phone_number", cleanedPhone)
      .eq("request_date", today)
      .maybeSingle();

    if (limitData && limitData.request_count >= 50) {
      return new Response(
        JSON.stringify({ error: "Daily OTP limit reached. Try again tomorrow." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase
      .from("otp_requests")
      .update({ verified: true })
      .eq("phone_number", cleanedPhone)
      .eq("verified", false);

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase.from("otp_requests").insert({
      phone_number: cleanedPhone,
      otp_hash: otpHash,
      channel,
      expires_at: expiresAt,
      verified: false,
    });

    if (limitData) {
      await supabase
        .from("otp_daily_limits")
        .update({ request_count: limitData.request_count + 1 })
        .eq("phone_number", cleanedPhone)
        .eq("request_date", today);
    } else {
      await supabase.from("otp_daily_limits").insert({
        phone_number: cleanedPhone,
        request_date: today,
        request_count: 1,
      });
    }

    const isDemoMode = !msg91AuthKey || !msg91TemplateId;

    if (!isDemoMode) {
      const msg91Url = `https://control.msg91.com/api/v5/otp?template_id=${msg91TemplateId}&mobile=${fullPhone}&authkey=${msg91AuthKey}&otp=${otp}`;

      try {
        await fetch(msg91Url, { method: "GET" });
      } catch (e) {
        console.error("MSG91 error:", e);
      }
    } else {
      console.log(`[DEMO MODE] OTP for ${cleanedPhone}: ${otp}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: isDemoMode ? "OTP generated (Demo Mode)" : "OTP sent successfully",
        channel,
        expiresAt,
        ...(isDemoMode && { demoOtp: otp }),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
