import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: "Phone and OTP are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cleanedPhone = phone.replace(/\D/g, "");
    if (cleanedPhone.length !== 10) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullPhone = `+91${cleanedPhone}`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from("otp_requests")
      .select("*")
      .eq("phone_number", cleanedPhone)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error("OTP lookup error:", otpError);
      return new Response(
        JSON.stringify({ error: "Failed to verify OTP" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!otpRecord) {
      return new Response(
        JSON.stringify({ error: "OTP expired or not found. Please request a new one." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (otpRecord.attempts >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many attempts. Please request a new OTP." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const otpHash = await hashOtp(otp);
    const isValid = otpHash === otpRecord.otp_hash;

    if (!isValid) {
      await supabaseAdmin
        .from("otp_requests")
        .update({ attempts: otpRecord.attempts + 1 })
        .eq("id", otpRecord.id);

      return new Response(
        JSON.stringify({ error: "Invalid OTP. Please try again." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabaseAdmin
      .from("otp_requests")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    const phoneWithoutPlus = `91${cleanedPhone}`;
    const dummyEmail = `${cleanedPhone}@phone.local`;
    const staticPassword = `sebayat_secure_${cleanedPhone}`;

    let userId;
    let isNewUser = false;

    const { data: existingUserRows } = await supabaseAdmin.rpc("get_user_id_by_email", {
      p_email: dummyEmail,
    });
    const existingUserId: string | null = existingUserRows?.[0]?.id ?? null;
    const existingUser = existingUserId ? { id: existingUserId } : null;

    if (!existingUser) {
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          phone: fullPhone,
          phone_confirm: true,
          email: dummyEmail,
          email_confirm: true,
          password: staticPassword,
          user_metadata: { phone: fullPhone },
        });

      if (createError) {
        console.error("Create user error:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create account" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      isNewUser = true;
      userId = newUser.user.id;

      await supabaseAdmin.from("profiles").insert({
        id: userId,
        phone_number: fullPhone,
        role: "sebayat",
      });
    } else {
      userId = existingUser.id;

      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: dummyEmail,
        email_confirm: true,
        password: staticPassword,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const signInResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseAnonKey,
      },
      body: JSON.stringify({
        email: dummyEmail,
        password: staticPassword,
      }),
    });

    const sessionData = await signInResponse.json();

    if (!signInResponse.ok || !sessionData.access_token) {
      console.error("Sign in error:", sessionData);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const { data: registration } = await supabaseAdmin
      .from("sebayat_registrations")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: sessionData.access_token,
          refresh_token: sessionData.refresh_token,
          expires_in: sessionData.expires_in,
          token_type: sessionData.token_type,
          user: sessionData.user,
        },
        user: {
          id: userId,
          phone: fullPhone,
          profile,
          registration,
          isNewUser,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Verify OTP error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
