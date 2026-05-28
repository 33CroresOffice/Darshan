import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleCheck, Clock, Bell, FileCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";

export default function SubmittedScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const STEPS = [
    {
      icon: FileCheck,
      title: t("onboarding.step1Title"),
      description: t("onboarding.step1Body"),
    },
    {
      icon: Clock,
      title: t("onboarding.step2Title"),
      description: t("onboarding.step2Body"),
    },
    {
      icon: Bell,
      title: t("onboarding.step3Title"),
      description: t("onboarding.step3Body"),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("onboarding.submittedTitle")}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusBanner}>
          <View style={styles.statusIcon}>
            <CircleCheck size={28} color={COLORS.success} strokeWidth={2} />
          </View>
          <Text style={styles.statusTitle}>{t("onboarding.submittedHeading")}</Text>
          <Text style={styles.statusSubtitle}>{t("onboarding.submittedSubheading")}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("onboarding.whatsNext")}</Text>

          <View style={styles.timeline}>
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <View key={index} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[
                      styles.timelineIcon,
                      index === 0 && styles.timelineIconActive,
                    ]}>
                      <StepIcon
                        size={20}
                        color={index === 0 ? COLORS.surface : COLORS.textSecondary}
                      />
                    </View>
                    {index < STEPS.length - 1 && (
                      <View style={styles.timelineLine} />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[
                      styles.timelineTitle,
                      index === 0 && styles.timelineTitleActive,
                    ]}>
                      {step.title}
                    </Text>
                    <Text style={styles.timelineDescription}>
                      {step.description}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Clock size={20} color={COLORS.primary} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>{t("onboarding.reviewTime")}</Text>
            <Text style={styles.infoText}>{t("onboarding.reviewTimeBody")}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  statusBanner: {
    backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: "center",
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: "center",
  },
  statusSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.large,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  timeline: {
    gap: SPACING.xs,
  },
  timelineItem: {
    flexDirection: "row",
  },
  timelineLeft: {
    alignItems: "center",
    marginRight: SPACING.md,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineIconActive: {
    backgroundColor: COLORS.success,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs,
    minHeight: SPACING.lg,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: SPACING.lg,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  timelineTitleActive: {
    color: COLORS.success,
  },
  timelineDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primaryDark,
    marginBottom: SPACING.xs,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.primaryDark,
    lineHeight: 18,
    opacity: 0.8,
  },
});
