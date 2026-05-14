import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/context/LanguageContext";
import { COLORS, RADIUS, SPACING } from "@/constants/config";
import type { SupportedLanguage } from "@/lib/i18n";

const LANGUAGES: { code: SupportedLanguage; labelKey: "english" | "odia" }[] = [
  { code: "en", labelKey: "english" },
  { code: "or", labelKey: "odia" },
];

export function LanguagePicker() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();

  return (
    <View style={styles.container}>
      {LANGUAGES.map((lang) => {
        const isActive = language === lang.code;
        return (
          <TouchableOpacity
            key={lang.code}
            style={[styles.button, isActive && styles.buttonActive]}
            onPress={() => setLanguage(lang.code)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {t(`language.${lang.labelKey}`)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  button: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
  },
  buttonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  labelActive: {
    color: COLORS.primary,
  },
});
