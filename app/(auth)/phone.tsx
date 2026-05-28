import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MessageCircle, Smartphone, Phone } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { LoadingOverlay } from "@/components/actions/LoadingOverlay";
import { LanguagePicker } from "@/components/ui/LanguagePicker";
import { sendOtp } from "@/services/authService";
import { getOtpChannels, type OtpChannels } from "@/services/settingsService";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";

export default function PhoneScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpChannels, setOtpChannels] = useState<OtpChannels | null>(null);

  useEffect(() => {
    getOtpChannels().then((channels) => {
      setOtpChannels(channels);
      if (!channels.whatsapp && channels.sms) setChannel("sms");
      else if (channels.whatsapp && !channels.sms) setChannel("whatsapp");
    });
  }, []);

  const handleSendOtp = async () => {
    const cleaned = phoneNumber.replace(/\D/g, "");

    if (cleaned.length !== 10) {
      setError(t("auth.invalidPhone"));
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await sendOtp(cleaned, channel);
      router.push({
        pathname: "/(auth)/verify-otp",
        params: { phone: cleaned, channel, demoOtp: response.demoOtp || "" },
      });
    } catch (err: any) {
      setError(err.message || t("auth.failedToSend"));
    } finally {
      setLoading(false);
    }
  };

  const isValid = phoneNumber.replace(/\D/g, "").length === 10;

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
            <View style={styles.logoContainer}>
              <Phone size={32} color={COLORS.surface} strokeWidth={2.5} />
            </View>
            <Text style={styles.brandName}>{t("auth.brandName")}</Text>
            <Text style={styles.tagline}>{t("auth.tagline")}</Text>
            <View style={styles.languagePickerWrap}>
              <LanguagePicker />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>{t("auth.welcome")}</Text>
            <Text style={styles.subtitle}>{t("auth.enterPhone")}</Text>

            <View style={styles.phoneInputContainer}>
              <View style={styles.countryCode}>
                <Text style={styles.countryFlag}>IN</Text>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <View style={styles.phoneInputWrapper}>
                <TextInput
                  style={styles.phoneInput}
                  placeholder={t("auth.phonePlaceholder")}
                  placeholderTextColor={COLORS.textMuted}
                  value={phoneNumber}
                  onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, ""))}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {otpChannels !== null && (otpChannels.whatsapp && otpChannels.sms) ? (
              <>
                <Text style={styles.channelLabel}>{t("auth.sendOtpVia")}</Text>
                <View style={styles.channelContainer}>
                  <TouchableOpacity
                    style={[
                      styles.channelOption,
                      channel === "whatsapp" && styles.channelOptionActive,
                    ]}
                    onPress={() => setChannel("whatsapp")}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.channelIcon,
                        channel === "whatsapp" && styles.channelIconActive,
                      ]}
                    >
                      <MessageCircle
                        size={20}
                        color={channel === "whatsapp" ? COLORS.surface : COLORS.textSecondary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.channelText,
                        channel === "whatsapp" && styles.channelTextActive,
                      ]}
                    >
                      {t("auth.whatsapp")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.channelOption,
                      channel === "sms" && styles.channelOptionActive,
                    ]}
                    onPress={() => setChannel("sms")}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.channelIcon,
                        channel === "sms" && styles.channelIconActive,
                      ]}
                    >
                      <Smartphone
                        size={20}
                        color={channel === "sms" ? COLORS.surface : COLORS.textSecondary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.channelText,
                        channel === "sms" && styles.channelTextActive,
                      ]}
                    >
                      {t("auth.sms")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : otpChannels !== null ? (
              <View style={styles.singleChannelBadge}>
                {channel === "whatsapp" ? (
                  <MessageCircle size={16} color={COLORS.success} />
                ) : (
                  <Smartphone size={16} color={COLORS.primary} />
                )}
                <Text style={styles.singleChannelText}>
                  {t("auth.otpViaSingle", { channel: channel === "whatsapp" ? t("auth.whatsapp") : t("auth.sms") })}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.button, !isValid && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={!isValid}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.buttonText, !isValid && styles.buttonTextDisabled]}
              >
                {t("auth.continueBtn")}
              </Text>
            </TouchableOpacity>

            <Text style={styles.termsText}>
              {t("auth.termsText")}{" "}
              <Text style={styles.termsLink}>{t("auth.termsOfService")}</Text>{" "}
              {t("auth.and")}{" "}
              <Text style={styles.termsLink}>{t("auth.privacyPolicy")}</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <LoadingOverlay visible={loading} message={t("auth.sendOtpVia") + "..."} />
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
    alignItems: "center",
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
    ...SHADOWS.medium,
  },
  brandName: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  languagePickerWrap: {
    marginTop: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  phoneInputContainer: {
    flexDirection: "row",
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  countryCode: {
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  countryFlag: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    backgroundColor: COLORS.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  phoneInputWrapper: {
    flex: 1,
  },
  phoneInput: {
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
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
  channelLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  channelContainer: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  singleChannelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    marginBottom: SPACING.lg,
  },
  singleChannelText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  channelOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
  },
  channelOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  channelIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  channelIconActive: {
    backgroundColor: COLORS.primary,
  },
  channelText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  channelTextActive: {
    color: COLORS.primary,
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
  termsText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: SPACING.lg,
    lineHeight: 18,
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: "500",
  },
});
