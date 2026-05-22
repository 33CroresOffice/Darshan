import { supabase } from "@/lib/supabase";
import { uriToBlob, uriToBase64DataUrl } from "@/lib/fileUtils";
import type { RegistrationFormData, SebayatRegistration } from "@/types";

export async function uploadFile(
  bucket: string,
  path: string,
  uri: string
): Promise<string> {
  const blob = await uriToBlob(uri);
  const contentType = blob.type || "image/jpeg";

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
}

function getAadharContentType(uri: string): string {
  if (uri.startsWith("data:application/pdf") || uri.includes("application/pdf")) return "application/pdf";
  return "image/jpeg";
}

export async function submitRegistration(
  userId: string,
  formData: RegistrationFormData,
  phoneNumber: string
): Promise<SebayatRegistration> {
  const timestamp = Date.now();

  const photoUrl = await uploadFile(
    "profile-photos",
    `${userId}/photo-${timestamp}.jpg`,
    formData.photoUri!
  );

  let idProofUrl: string | null = null;
  if (formData.templeIdCardUri) {
    idProofUrl = await uploadFile(
      "id-documents",
      `${userId}/temple-id-${timestamp}.jpg`,
      formData.templeIdCardUri
    );
  }

  let templeHealthCardUrl: string | null = null;
  if (formData.templeHealthCardUri) {
    templeHealthCardUrl = await uploadFile(
      "id-documents",
      `${userId}/health-card-${timestamp}.jpg`,
      formData.templeHealthCardUri
    );
  }

  let aadharCardUrl: string | null = null;
  if (formData.aadharCardUri && !formData.aadharCardUri.startsWith("pdf-placeholder")) {
    const isPdf = getAadharContentType(formData.aadharCardUri) === "application/pdf";
    aadharCardUrl = await uploadFile(
      "id-documents",
      `${userId}/aadhar-${timestamp}.${isPdf ? "pdf" : "jpg"}`,
      formData.aadharCardUri
    );
  }

  const effectivePresentAddress = formData.presentSameAsPermanent ? {
    present_address: formData.permanentAddress,
    present_city: formData.permanentCity,
    present_state: formData.permanentState,
    present_pincode: formData.permanentPincode,
  } : {
    present_address: formData.presentAddress || null,
    present_city: formData.presentCity || null,
    present_state: formData.presentState || null,
    present_pincode: formData.presentPincode || null,
  };

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    full_name: formData.fullName,
    father_name: formData.fatherName || null,
    age: formData.age ? parseInt(formData.age, 10) : null,
    allotment_number: formData.allotmentNumber || null,
    phone_number: phoneNumber,
    aadhar_number: formData.aadharNumber || null,
    aadhar_card_url: aadharCardUrl,
    permanent_address: formData.permanentAddress || null,
    permanent_city: formData.permanentCity || null,
    permanent_state: formData.permanentState || null,
    permanent_pincode: formData.permanentPincode || null,
    present_same_as_permanent: formData.presentSameAsPermanent,
    ...effectivePresentAddress,
    temple_health_card_id: formData.templeHealthCardId || null,
    temple_health_card_url: templeHealthCardUrl,
    temple_id_card_number: formData.templeIdCardNumber || null,
    temple_id_card_url: idProofUrl,
    photo_url: photoUrl,
    category_ids: formData.categoryIds.length > 0 ? formData.categoryIds : null,
  };

  const { data, error } = await supabase
    .from("sebayat_registrations")
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw new Error(`Registration failed: ${error.message}`);
  return data as SebayatRegistration;
}

export async function resubmitRegistration(
  registrationId: string,
  userId: string,
  formData: RegistrationFormData
): Promise<SebayatRegistration> {
  const timestamp = Date.now();

  const effectivePresentAddress = formData.presentSameAsPermanent ? {
    present_address: formData.permanentAddress,
    present_city: formData.permanentCity,
    present_state: formData.permanentState,
    present_pincode: formData.permanentPincode,
  } : {
    present_address: formData.presentAddress || null,
    present_city: formData.presentCity || null,
    present_state: formData.presentState || null,
    present_pincode: formData.presentPincode || null,
  };

  const updates: Record<string, unknown> = {
    full_name: formData.fullName,
    father_name: formData.fatherName || null,
    age: formData.age ? parseInt(formData.age, 10) : null,
    allotment_number: formData.allotmentNumber || null,
    aadhar_number: formData.aadharNumber || null,
    permanent_address: formData.permanentAddress || null,
    permanent_city: formData.permanentCity || null,
    permanent_state: formData.permanentState || null,
    permanent_pincode: formData.permanentPincode || null,
    present_same_as_permanent: formData.presentSameAsPermanent,
    ...effectivePresentAddress,
    temple_health_card_id: formData.templeHealthCardId || null,
    temple_id_card_number: formData.templeIdCardNumber || null,
    category_ids: formData.categoryIds.length > 0 ? formData.categoryIds : null,
    approval_status: "pending",
    rejection_reason: null,
    rejection_type: null,
    approved_by: null,
    approved_at: null,
  };

  // Aadhar card: upload if new file selected (not already a URL and not a placeholder)
  if (
    formData.aadharCardUri &&
    !formData.aadharCardUri.startsWith("http") &&
    !formData.aadharCardUri.startsWith("pdf-placeholder")
  ) {
    const isPdf = getAadharContentType(formData.aadharCardUri) === "application/pdf";
    updates.aadhar_card_url = await uploadFile(
      "id-documents",
      `${userId}/aadhar-${timestamp}.${isPdf ? "pdf" : "jpg"}`,
      formData.aadharCardUri
    );
  }

  if (formData.templeHealthCardUri && !formData.templeHealthCardUri.startsWith("http")) {
    updates.temple_health_card_url = await uploadFile(
      "id-documents",
      `${userId}/health-card-${timestamp}.jpg`,
      formData.templeHealthCardUri
    );
  }

  if (formData.templeIdCardUri && !formData.templeIdCardUri.startsWith("http")) {
    updates.temple_id_card_url = await uploadFile(
      "id-documents",
      `${userId}/temple-id-${timestamp}.jpg`,
      formData.templeIdCardUri
    );
  }

  if (formData.photoUri && !formData.photoUri.startsWith("http")) {
    updates.photo_url = await uploadFile(
      "profile-photos",
      `${userId}/photo-${timestamp}.jpg`,
      formData.photoUri
    );
  }

  const { data, error } = await supabase
    .from("sebayat_registrations")
    .update(updates)
    .eq("id", registrationId)
    .select()
    .single();

  if (error) throw error;
  return data as SebayatRegistration;
}

export async function getRegistration(
  userId: string
): Promise<SebayatRegistration | null> {
  const { data, error } = await supabase
    .from("sebayat_registrations")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as SebayatRegistration | null;
}

export async function getRegistrationApprovalProgress(
  registrationId: string
): Promise<{ approvedCount: number; totalAdmins: number }> {
  const [approvalsRes, adminCountRes] = await Promise.all([
    supabase
      .from("registration_approvals")
      .select("id", { count: "exact", head: true })
      .eq("registration_id", registrationId)
      .eq("action", "approved"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true),
  ]);

  return {
    approvedCount: approvalsRes.count || 0,
    totalAdmins: adminCountRes.count || 0,
  };
}

export async function updateAddress(
  registrationId: string,
  addressData: { address: string; city: string; state: string; pincode: string }
): Promise<void> {
  const { error } = await supabase
    .from("sebayat_registrations")
    .update({
      address: addressData.address,
      city: addressData.city,
      state: addressData.state,
      pincode: addressData.pincode,
      permanent_address: addressData.address,
      permanent_city: addressData.city,
      permanent_state: addressData.state,
      permanent_pincode: addressData.pincode,
    })
    .eq("id", registrationId);

  if (error) throw error;
}

export async function updateDateOfBirth(
  registrationId: string,
  dateOfBirth: Date
): Promise<void> {
  const { error } = await supabase
    .from("sebayat_registrations")
    .update({
      date_of_birth: dateOfBirth.toISOString().split("T")[0],
    })
    .eq("id", registrationId);

  if (error) throw error;
}

export async function updateProfilePhoto(
  registrationId: string,
  userId: string,
  photoUri: string
): Promise<string> {
  const timestamp = Date.now();
  const photoUrl = await uploadFile(
    "profile-photos",
    `${userId}/photo-${timestamp}.jpg`,
    photoUri
  );

  const { error } = await supabase
    .from("sebayat_registrations")
    .update({ photo_url: photoUrl })
    .eq("id", registrationId);

  if (error) throw error;
  return photoUrl;
}

export async function updateTempleHealthCard(
  registrationId: string,
  userId: string,
  cardUri: string,
  cardId?: string
): Promise<string> {
  const timestamp = Date.now();
  const cardUrl = await uploadFile(
    "id-documents",
    `${userId}/health-card-${timestamp}.jpg`,
    cardUri
  );

  const updates: Record<string, string> = { temple_health_card_url: cardUrl };
  if (cardId) {
    updates.temple_health_card_id = cardId;
  }

  const { error } = await supabase
    .from("sebayat_registrations")
    .update(updates)
    .eq("id", registrationId);

  if (error) throw error;
  return cardUrl;
}

interface AdminSebayatRegistration {
  phoneNumber: string;
  fullName: string;
  categoryId: string;
  templeHealthCardId: string;
  templeHealthCardUri: string | null;
  templeIdCardNumber: string;
  templeIdCardUri: string | null;
  photoUri: string;
}


export async function registerSebayatByAdmin(
  data: AdminSebayatRegistration
): Promise<{ success: boolean; message: string }> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return {
      success: false,
      message: "You must be logged in to register sebayats",
    };
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const templeIdCardBase64 = data.templeIdCardUri
    ? await uriToBase64DataUrl(data.templeIdCardUri)
    : null;
  const photoBase64 = await uriToBase64DataUrl(data.photoUri);
  const templeHealthCardBase64 = data.templeHealthCardUri
    ? await uriToBase64DataUrl(data.templeHealthCardUri)
    : null;

  const response = await fetch(`${supabaseUrl}/functions/v1/register-sebayat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": supabaseAnonKey || "",
    },
    body: JSON.stringify({
      ...data,
      templeIdCardUri: templeIdCardBase64,
      photoUri: photoBase64,
      templeHealthCardUri: templeHealthCardBase64,
    }),
  });

  const result = await response.json();
  return result;
}
