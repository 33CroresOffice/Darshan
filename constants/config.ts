export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export const OTP_CONFIG = {
  length: 6,
  expiryMinutes: 10,
  maxDailyAttempts: 5,
  resendCooldownSeconds: 30,
};

export const COLORS = {
  primary: "#0D9488",
  primaryDark: "#0F766E",
  primaryLight: "#CCFBF1",
  primaryMuted: "#5EEAD4",

  secondary: "#1E293B",
  secondaryLight: "#334155",

  accent: "#F59E0B",
  accentLight: "#FEF3C7",

  success: "#10B981",
  successLight: "#D1FAE5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  error: "#EF4444",
  errorLight: "#FEE2E2",

  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceSecondary: "#F1F5F9",

  text: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",

  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  divider: "#CBD5E1",

  disabled: "#CBD5E1",
  disabledText: "#94A3B8",

  gradientStart: "#0F172A",
  gradientMid: "#1E293B",
  gradientEnd: "#334155",

  glass: "rgba(255, 255, 255, 0.12)",
  glassBorder: "rgba(255, 255, 255, 0.18)",
  glassLight: "rgba(255, 255, 255, 0.08)",

  accentCyan: "#06B6D4",
  accentTeal: "#14B8A6",
  accentAmber: "#F59E0B",
  accentRose: "#F43F5E",

  textLight: "#FFFFFF",
  textLightSecondary: "rgba(255, 255, 255, 0.7)",
  textLightMuted: "rgba(255, 255, 255, 0.5)",

  overlay: "rgba(15, 23, 42, 0.6)",
};

export const SHADOWS = {
  small: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  large: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const GENDER_OPTIONS = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
];
