export * from "./database";

export interface OtpResponse {
  success: boolean;
  message: string;
  expiresAt?: string;
  demoOtp?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  session?: {
    access_token: string;
    refresh_token: string;
  };
  user?: {
    id: string;
    phone: string;
  };
}

export interface RegistrationFormData {
  fullName: string;
  fatherName: string;
  age: string;
  allotmentNumber: string;
  categoryIds: string[];
  aadharNumber: string;
  aadharCardUri: string | null;
  // Permanent address
  permanentAddress: string;
  permanentCity: string;
  permanentState: string;
  permanentPincode: string;
  // Present address
  presentSameAsPermanent: boolean;
  presentAddress: string;
  presentCity: string;
  presentState: string;
  presentPincode: string;
  templeHealthCardId: string;
  templeHealthCardUri: string | null;
  templeIdCardNumber: string;
  templeIdCardUri: string | null;
  photoUri: string | null;
}

export interface AddressData {
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface AdminStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  recentRegistrations: import("./database").SebayatRegistration[];
}

export interface EntryStats {
  todayEntries: number;
  todayDevotees: number;
  pendingVerifications: number;
}

export interface CreateEntryResult {
  success: boolean;
  message: string;
  entry?: import("./database").GateEntry;
}

export interface VerifyEntryResult {
  success: boolean;
  message: string;
  entry?: import("./database").GateEntry;
}
