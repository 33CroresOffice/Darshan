import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  MessageCircle,
  Smartphone,
  Shield,
  Ban,
  PhoneCall,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { LoadingOverlay } from "@/components/actions/LoadingOverlay";
import { verifyOtp, resendOtp } from "@/services/authService";
import { COLORS, OTP_CONFIG, RADIUS, SPACING, SHADOWS } from "@/constants/config";

export default function VerifyOtpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    phone,
    channel: initialChannel,
    demoOtp,
  } = useLocalSearchParams<{
    phone: string;
    channel: string;
    demoOtp: string;
  }>();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [channel, setChannel] = useState<"whatsapp" | "sms">(
    (initialChannel as "whatsapp" | "sms") || "whatsapp"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suspended, setSuspended] = useState(false);
  const [countdown, setCountdown] = useState(OTP_CONFIG.resendCooldownSeconds);
  const [canResend, setCanResend] = useState(false);
  const [currentDemoOtp, setCurrentDemoOtp] = useState(demoOtp || "");

  const { t } = useTranslation();
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleOtpChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((digit) => digit) && newOtp.join("").length === 6) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpCode?: string) => {
    const code = otpCode || otp.join("");

    if (code.length !== 6) {
      setError(t("verify.incompleteOtp"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      await verifyOtp(phone!, code);
    } catch (err: any) {
      if (err.message === "ACCOUNT_SUSPENDED") {
        setSuspended(true);
        setOtp(["", "", "", "", "", ""]);
        setLoading(false);
        return;
      }
      setError(err.message || t("verify.invalidOtp"));
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (newChannel?: "whatsapp" | "sms") => {
    const selectedChannel = newChannel || channel;
    if (newChannel) setChannel(newChannel);

    setLoading(true);
    setError("");

    try {
      const response = await resendOtp(phone!, selectedChannel);
      if (response.demoOtp) {
        setCurrentDemoOtp(response.demoOtp);
      }
      setCountdown(OTP_CONFIG.resendCooldownSeconds);
      setCanResend(false);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || t("verify.failedResend"));
    } finally {
      setLoading(false);
    }
  };

  const maskedPhone = `XXXXXX${phone?.slice(-4) || ""}`;

  if (suspended) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.suspendedWrapper}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/(auth)/phone")}
          >
            <ArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.suspendedCard}>
            <View style={styles.suspendedIconWrap}>
              <Ban size={36} color={COLORS.error} />
            </View>
            <Text style={styles.suspendedTitle}>{t("verify.accountSuspendedTitle")}</Text>
            <Text style={styles.suspendedBody}>
              {t("verify.accountSuspendedBody")}
            </Text>
            <View style={styles.suspendedDivider} />
            <View style={styles.suspendedContact}>
              <PhoneCall size={18} color={COLORS.textSecondary} />
              <Text style={styles.suspendedContactText}>
                {t("verify.accountSuspendedHelp")}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.suspendedBackBtn}
              onPress={() => router.replace("/(auth)/phone")}
              activeOpacity={0.8}
            >
              <Text style={styles.suspendedBackBtnText}>{t("verify.backToLogin")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerSection}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <ArrowLeft size={24} color={COLORS.text} />
            </TouchableOpacity>

            <View style={styles.headerIcon}>
              <Shield size={28} color={COLORS.surface} strokeWidth={2.5} />
            </View>
            <Text style={styles.headerTitle}>{t("verify.title")}</Text>
            <Text style={styles.headerSubtitle}>
              {t("verify.subtitle", { phone: maskedPhone })}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.channelBadge}>
              {channel === "whatsapp" ? (
                <MessageCircle size={16} color={COLORS.success} />
              ) : (
                <Smartphone size={16} color={COLORS.primary} />
              )}
              <Text style={styles.channelBadgeText}>
                {t("verify.sentVia", { channel: channel === "whatsapp" ? t("auth.whatsapp") : t("auth.sms") })}
              </Text>
            </View>

            {currentDemoOtp ? (
              <View style={styles.demoOtpContainer}>
                <Text style={styles.demoOtpLabel}>{t("verify.demoMode")}</Text>
                <Text style={styles.demoOtpCode}>{currentDemoOtp}</Text>
              </View>
            ) : null}

            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  style={[
                    styles.otpInput,
                    digit && styles.otpInputFilled,
                    error && styles.otpInputError,
                  ]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={({ nativeEvent }) =>
                    handleKeyPress(nativeEvent.key, index)
                  }
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.button,
                otp.some((d) => !d) && styles.buttonDisabled,
              ]}
              onPress={() => handleVerify()}
              disabled={otp.some((d) => !d)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.buttonText,
                  otp.some((d) => !d) && styles.buttonTextDisabled,
                ]}
              >
                {t("verify.verify")}
              </Text>
            </TouchableOpacity>

            <View style={styles.resendContainer}>
              {canResend ? (
                <View style={styles.resendOptions}>
                  <Text style={styles.resendLabel}>{t("verify.resendCodeVia")}</Text>
                  <View style={styles.resendButtons}>
                    <TouchableOpacity
                      style={styles.resendOption}
                      onPress={() => handleResend("whatsapp")}
                    >
                      <MessageCircle size={18} color={COLORS.primary} />
                      <Text style={styles.resendOptionText}>{t("auth.whatsapp")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.resendOption}
                      onPress={() => handleResend("sms")}
                    >
                      <Smartphone size={18} color={COLORS.primary} />
                      <Text style={styles.resendOptionText}>{t("auth.sms")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.countdownContainer}>
                  <Text style={styles.countdownText}>{t("verify.resendIn")}</Text>
                  <View style={styles.countdownBadge}>
                    <Text style={styles.countdownNumber}>{countdown}s</Text>
                  </View>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.changePhoneButton}
              onPress={() => router.back()}
            >
              <Text style={styles.changePhoneText}>{t("verify.changePhone")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <LoadingOverlay visible={loading} message={t("verify.verifying")} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
  },
  headerSection: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.lg,
    ...SHADOWS.small,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
    ...SHADOWS.medium,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  channelBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  channelBadgeText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  demoOtpContainer: {
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  demoOtpLabel: {
    fontSize: 12,
    color: COLORS.warning,
    fontWeight: "600",
    marginBottom: SPACING.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  demoOtpCode: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: 8,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    color: COLORS.text,
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  otpInputError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorLight,
  },
  errorContainer: {
    backgroundColor: COLORS.errorLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    textAlign: "center",
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.surface,
  },
  buttonTextDisabled: {
    color: COLORS.textMuted,
  },
  resendContainer: {
    alignItems: "center",
    marginTop: SPACING.lg,
  },
  resendOptions: {
    alignItems: "center",
  },
  resendLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  resendButtons: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  resendOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  resendOptionText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "600",
  },
  countdownContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  countdownText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  countdownBadge: {
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countdownNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  changePhoneButton: {
    alignItems: "center",
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  changePhoneText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  suspendedWrapper: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  suspendedCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.error + "40",
    alignItems: "center",
    marginTop: SPACING.xl,
    ...SHADOWS.medium,
  },
  suspendedIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.error + "15",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.error + "30",
  },
  suspendedTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  suspendedBody: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  suspendedDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    width: "100%",
    marginBottom: SPACING.lg,
  },
  suspendedContact: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
    width: "100%",
  },
  suspendedContactText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  suspendedBackBtn: {
    backgroundColor: COLORS.text,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    width: "100%",
    alignItems: "center",
  },
  suspendedBackBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.surface,
  },
});
