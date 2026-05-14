import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { decode } from "npm:base64-arraybuffer@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RegisterSebayatRequest {
  phoneNumber: string;
  fullName: string;
  categoryId: string;
  templeHealthCardId: string;
  templeHealthCardUri: string | null;
  aadharNumber: string;
  aadharUri: string;
  photoUri: string;
}

async function uploadBase64Image(
  adminClient: any,
  bucket: string,
  path: string,
  base64Data: string
): Promise<string> {
  const base64Content = base64Data.includes(",")
    ? base64Data.split(",")[1]
    : base64Data;

  const arrayBuffer = decode(base64Content);

  const { error } = await adminClient.storage
    .from(bucket)
    .upload(path, arrayBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) throw error;

  const { data: urlData } = adminClient.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
}

async function fetchAndUploadImage(
  adminClient: any,
  bucket: string,
  path: string,
  uri: string
): Promise<string> {
  if (uri.startsWith("data:")) {
    return uploadBase64Image(adminClient, bucket, path, uri);
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const { error } = await adminClient.storage
    .from(bucket)
    .upload(path, arrayBuffer, {
      contentType: blob.type || "image/jpeg",
      upsert: true,
    });

  if (error) throw error;

  const { data: urlData } = adminClient.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
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

    const allowedRoles = ["superadmin", "admin"];
    if (profileError || !callerProfile || !allowedRoles.includes(callerProfile.role)) {
      return new Response(
        JSON.stringify({ success: false, message: "Only admins can register sebayats directly" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestData: RegisterSebayatRequest = await req.json();
    const {
      phoneNumber,
      fullName,
      categoryId,
      templeHealthCardId,
      templeHealthCardUri,
      aadharNumber,
      aadharUri,
      photoUri,
    } = requestData;

    if (!phoneNumber || !fullName || !categoryId || !templeHealthCardId || !aadharNumber || !aadharUri || !photoUri) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const cleanedPhone = phoneNumber.replace(/\D/g, "");
    const fullPhone = cleanedPhone.startsWith("91") ? `+${cleanedPhone}` : `+91${cleanedPhone}`;
    const phoneDigits = cleanedPhone.startsWith("91") ? cleanedPhone.slice(2) : cleanedPhone;
    const dummyEmail = `${phoneDigits}@phone.local`;
    const staticPassword = `sebayat_secure_${phoneDigits}`;

    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("phone_number", fullPhone)
      .maybeSingle();

    if (existingProfile) {
      const { data: existingRegistration } = await adminClient
        .from("sebayat_registrations")
        .select("id, approval_status")
        .eq("user_id", existingProfile.id)
        .maybeSingle();

      if (existingRegistration) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `User already has a registration with status: ${existingRegistration.approval_status}`
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let userId: string;

    if (existingProfile) {
      userId = existingProfile.id;

      await adminClient.auth.admin.updateUserById(userId, {
        email: dummyEmail,
        email_confirm: true,
        password: staticPassword,
      });

      await adminClient
        .from("profiles")
        .update({
          full_name: fullName,
          role: "sebayat",
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    } else {
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
          JSON.stringify({ success: false, message: `Failed to create user: ${authError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = authData.user.id;

      const { error: profileInsertError } = await adminClient
        .from("profiles")
        .insert({
          id: userId,
          phone_number: fullPhone,
          full_name: fullName,
          role: "sebayat",
        });

      if (profileInsertError) {
        return new Response(
          JSON.stringify({ success: false, message: `Failed to create profile: ${profileInsertError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const timestamp = Date.now();

    const idProofUrl = await fetchAndUploadImage(
      adminClient,
      "id-documents",
      `${userId}/aadhar-${timestamp}.jpg`,
      aadharUri
    );

    const photoUrl = await fetchAndUploadImage(
      adminClient,
      "profile-photos",
      `${userId}/photo-${timestamp}.jpg`,
      photoUri
    );

    let templeHealthCardUrl: string | null = null;
    if (templeHealthCardUri) {
      templeHealthCardUrl = await fetchAndUploadImage(
        adminClient,
        "id-documents",
        `${userId}/health-card-${timestamp}.jpg`,
        templeHealthCardUri
      );
    }

    const { error: registrationError } = await adminClient
      .from("sebayat_registrations")
      .insert({
        user_id: userId,
        full_name: fullName,
        category_id: categoryId,
        phone_number: fullPhone,
        temple_health_card_id: templeHealthCardId,
        temple_health_card_url: templeHealthCardUrl,
        aadhar_number: aadharNumber,
        id_proof_url: idProofUrl,
        photo_url: photoUrl,
        approval_status: "approved",
        approved_by: callingUser.id,
        approved_at: new Date().toISOString(),
      });

    if (registrationError) {
      return new Response(
        JSON.stringify({ success: false, message: `Failed to create registration: ${registrationError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Sebayat registered and approved successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
