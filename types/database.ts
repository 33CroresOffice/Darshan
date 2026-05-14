export type UserRole = "superadmin" | "admin" | "supervisor" | "sebayat";
export type OtpChannel = "whatsapp" | "sms";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type NotificationType =
  | "registration_submitted"
  | "registration_approved"
  | "registration_rejected"
  | "entry_registered"
  | "entry_verified"
  | "quota_warning"
  | "quota_exhausted"
  | "general";

export type EntryStatus = "pending" | "registered" | "verified" | "discrepancy_flagged" | "cancelled";
export type EntryAction = "created" | "count_adjusted" | "verified" | "cancelled" | "flagged";
export type GateLocation = "west_gate" | "inner_gate";
export type EntryMode = "west_gate" | "marjana_mandap";

export interface Profile {
  id: string;
  phone: string;
  phone_number: string;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  push_token: string | null;
  expo_push_token: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OtpRequest {
  id: string;
  phone: string;
  otp_hash: string;
  channel: OtpChannel;
  expires_at: string;
  verified: boolean;
  created_at: string;
}

export interface OtpDailyLimit {
  id: string;
  phone: string;
  date: string;
  count: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegistrationOldData {
  full_name: string | null;
  temple_health_card_id: string | null;
  temple_health_card_url: string | null;
  temple_id_card_number: string | null;
  temple_id_card_url: string | null;
  photo_url: string | null;
  category_id: string | null;
  submission_round: number;
}

export interface SebayatRegistration {
  id: string;
  user_id: string;
  full_name: string;
  father_name: string | null;
  age: number | null;
  allotment_number: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  aadhar_number: string | null;
  aadhar_card_url: string | null;
  // Legacy address fields
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  // Permanent address (mandatory)
  permanent_address: string | null;
  permanent_city: string | null;
  permanent_state: string | null;
  permanent_pincode: string | null;
  // Present address
  present_same_as_permanent: boolean;
  present_address: string | null;
  present_city: string | null;
  present_state: string | null;
  present_pincode: string | null;
  temple_health_card_id: string | null;
  temple_health_card_url: string | null;
  temple_id_card_number: string | null;
  temple_id_card_url: string | null;
  id_proof_url: string | null;
  photo_url: string;
  category_id: string | null;
  category_ids: string[] | null;
  category?: Category;
  profile?: { phone_number: string };
  approval_status: ApprovalStatus;
  rejection_reason: string | null;
  rejection_type: RejectionType | null;
  approved_by: string | null;
  approved_at: string | null;
  submission_round: number;
  old_data: RegistrationOldData | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: { value: number | string | boolean };
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DarshanSlot {
  id: string;
  name: string;
  odia_name: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  max_bookings: number;
  max_bookings_per_user: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlotQuota {
  slot: DarshanSlot;
  totalCapacity: number;
  usedCount: number;
  remainingCount: number;
  userUsedCount: number;
  userRemainingCount: number;
}

export interface GateEntry {
  id: string;
  entry_code: string;
  qr_code_data: Record<string, unknown> | null;
  sebayat_id: string;
  slot_id: string | null;
  west_gate_supervisor_id: string | null;
  inner_gate_supervisor_id: string | null;
  declared_devotee_count: number;
  verified_devotee_count: number | null;
  status: EntryStatus;
  entry_date: string;
  west_gate_entry_time: string | null;
  inner_gate_verification_time: string | null;
  notes: string | null;
  created_by_sebayat: boolean;
  expires_at: string | null;
  entry_mode: EntryMode;
  created_at: string;
  updated_at: string;
  sebayat?: SebayatRegistration;
  slot?: DarshanSlot;
  west_gate_supervisor?: Profile;
  inner_gate_supervisor?: Profile;
}

export interface EntryAuditLog {
  id: string;
  entry_id: string;
  action_type: EntryAction;
  performed_by: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  reason: string | null;
  gate_location: GateLocation;
  created_at: string;
  performer?: Profile;
}

export interface SebayatQuota {
  maxLimit: number;
  usedCount: number;
  remainingCount: number;
}

export type RegistrationApprovalAction = "approved" | "rejected";
export type RejectionType = "wrong_data" | "management_decision";

export interface RegistrationApproval {
  id: string;
  registration_id: string;
  admin_id: string;
  action: RegistrationApprovalAction;
  rejection_reason: string | null;
  rejection_type: RejectionType | null;
  submission_round: number;
  created_at: string;
  updated_at: string;
  admin?: { full_name: string | null; phone_number: string | null };
}

export interface PreviousRoundVotes {
  round: number;
  approvals: RegistrationApproval[];
}

export type SlotSessionStatus = "active" | "ended";
export type SlotSessionAction = "started" | "ended";

export interface SlotSession {
  id: string;
  slot_id: string;
  date: string;
  status: SlotSessionStatus;
  started_by: string;
  ended_by: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  slot?: DarshanSlot;
  starter?: Profile;
  ender?: Profile;
}

export interface SlotSessionLog {
  id: string;
  session_id: string;
  slot_id: string;
  slot_name: string;
  action: SlotSessionAction;
  performed_by: string;
  performed_by_name: string;
  performed_by_role: string;
  performed_at: string;
}

export interface AdminVoteSummary {
  totalAdmins: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  submissionRound: number;
  approvals: RegistrationApproval[];
}
