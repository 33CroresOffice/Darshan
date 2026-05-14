import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateAdminRequest {
  phone?: string;
  fullName?: string;
  role: "admin" | "superadmin" | "supervisor" | "sebayat";
  userId?: string;
  promoteExisting?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callingUser) {
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: callerProfile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", callingUser.id)
      .maybeSingle();

    const callerRole = callerProfile?.role;
    const allowedCallerRoles = ["superadmin", "admin"];

    if (profileError || !callerProfile || !allowedCallerRoles.includes(callerRole)) {
      return new Response(
        JSON.stringify({ success: false, message: "Only admins can create users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, fullName, role, userId, promoteExisting }: CreateAdminRequest = await req.json();

    if (!["admin", "superadmin", "supervisor", "sebayat"].includes(role)) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (role === "superadmin" && callerRole !== "superadmin") {
      return new Response(
        JSON.stringify({ success: false, message: "Only superadmins can create superadmin users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    if (promoteExisting && userId) {
      let displayName = userId;

      if (role !== "sebayat") {
        const { data: approvedReg } = await adminClient
          .from("sebayat_registrations")
          .select("id, full_name")
          .eq("user_id", userId)
          .eq("approval_status", "approved")
          .maybeSingle();

        if (!approvedReg) {
          return new Response(
            JSON.stringify({ success: false, message: "User must have an approved sebayat registration to be assigned this role" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        displayName = approvedReg.full_name;
      } else {
        const { data: targetProfile } = await adminClient
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();
        displayName = targetProfile?.full_name ?? userId;
      }

      const { data: updatedUser, error: updateError } = await adminClient
        .from("profiles")
        .update({
          role,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, message: `Failed to update user role: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: `${displayName} role updated to ${role}`, user: updatedUser }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!phone || !fullName) {
      return new Response(
        JSON.stringify({ success: false, message: "Phone and fullName are required for new user creation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanedPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanedPhone.startsWith("91") ? `+${cleanedPhone}` : `+91${cleanedPhone}`;
    const phoneDigits = cleanedPhone.startsWith("91") ? cleanedPhone.slice(2) : cleanedPhone;
    const dummyEmail = `${phoneDigits}@phone.local`;
    const staticPassword = `sebayat_secure_${phoneDigits}`;

    const { data: existingUser } = await adminClient
      .from("profiles")
      .select("*")
      .eq("phone_number", fullPhone)
      .maybeSingle();

    if (existingUser) {
      const { data: approvedReg } = await adminClient
        .from("sebayat_registrations")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("approval_status", "approved")
        .maybeSingle();

      if (!approvedReg) {
        return new Response(
          JSON.stringify({ success: false, message: "User must have an approved sebayat registration to be assigned this role. Please register them as a sebayat first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await adminClient.auth.admin.updateUserById(existingUser.id, {
        email: dummyEmail,
        email_confirm: true,
        password: staticPassword,
      });

      const { data: updatedUser, error: updateError } = await adminClient
        .from("profiles")
        .update({
          role,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingUser.id)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, message: `Failed to update user: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: `User promoted to ${role}`, user: updatedUser }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      phone: fullPhone,
      phone_confirm: true,
      email: dummyEmail,
      email_confirm: true,
      password: staticPassword,
      user_metadata: { phone: fullPhone },
    });

    if (authError) {
      return new Response(
        JSON.stringify({ success: false, message: `Failed to create auth user: ${authError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: newProfile, error: profileInsertError } = await adminClient
      .from("profiles")
      .insert({
        id: authData.user.id,
        phone_number: fullPhone,
        full_name: fullName,
        role,
      })
      .select()
      .single();

    if (profileInsertError) {
      return new Response(
        JSON.stringify({ success: false, message: `Failed to create profile: ${profileInsertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `New ${role} account created. Note: User will need to register as a sebayat to access all features.`, user: newProfile }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
