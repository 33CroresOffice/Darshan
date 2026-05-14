import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Clock, FileText, Search, CircleCheck as CheckCircle, LogOut } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { signOut } from "@/services/authService";
import { getRegistration, getRegistrationApprovalProgress } from "@/services/registrationService";
import { useAuth } from "@/context/AuthContext";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";

export default function StatusScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [approvedCount, setApprovedCount] = useState(0);
  const [totalAdmins, setTotalAdmins] = useState(0);

  useEffect(() => {
    const fetchProgress = async () => {
      if (!user) return;
      try {
        const registration = await getRegistration(user.id);
        if (registration && registration.approval_status === "pending") {
          const progress = await getRegistrationApprovalProgress(registration.id);
          setApprovedCount(progress.approvedCount);
          setTotalAdmins(progress.totalAdmins);
        }
      } catch (err) {
        console.error("Failed to fetch approval progress:", err);
      }
    };
    fetchProgress();
  }, [user]);

  const progressDescription =
    totalAdmins > 0
      ? t("pending.step2BodyProgress", { approved: approvedCount, total: totalAdmins })
      : t("pending.step2BodyWaiting");

  const STEPS = [
    {
      icon: FileText,
      title: t("pending.step1Title"),
      description: t("pending.step1Body"),
      completed: true,
    },
    {
      icon: Search,
      title: t("pending.step2Title"),
      description: progressDescription,
      active: true,
    },
    {
      icon: CheckCircle,
      title: t("pending.step3Title"),
      description: t("pending.step3Body"),
      pending: true,
    },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("pending.appStatusTitle")}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusBanner}>
          <View style={styles.statusIcon}>
            <Clock size={28} color={COLORS.warning} strokeWidth={2} />
          </View>
          <Text style={styles.statusTitle}>{t("pending.pendingHeading")}</Text>
          <Text style={styles.statusSubtitle}>{t("pending.pendingSubheading")}</Text>
          {totalAdmins > 0 && (
            <View style={styles.progressRow}>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.round((approvedCount / totalAdmins) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {t("pending.adminsReviewed", { approved: approvedCount, total: totalAdmins })}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("pending.progress")}</Text>

          <View style={styles.timeline}>
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = step.completed;
              const isActive = step.active;
              return (
                <View key={index} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[
                      styles.timelineIcon,
                      isCompleted && styles.timelineIconCompleted,
                      isActive && styles.timelineIconActive,
                    ]}>
                      <StepIcon
                        size={18}
                        color={
                          isCompleted
                            ? COLORS.surface
                            : isActive
                            ? COLORS.surface
                            : COLORS.textMuted
                        }
                      />
                    </View>
                    {index < STEPS.length - 1 && (
                      <View style={[
                        styles.timelineLine,
                        isCompleted && styles.timelineLineCompleted,
                      ]} />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[
                      styles.timelineTitle,
                      isCompleted && styles.timelineTitleCompleted,
                      isActive && styles.timelineTitleActive,
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
            <Clock size={20} color={COLORS.warning} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>{t("pending.estimatedTime")}</Text>
            <Text style={styles.infoText}>{t("pending.estimatedTimeBody")}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color={COLORS.error} />
          <Text style={styles.signOutText}>{t("common.signOut")}</Text>
        </TouchableOpacity>
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
    paddingBottom: SPACING.xl,
  },
  statusBanner: {
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: "center",
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.warning,
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
  progressRow: {
    width: "100%",
    marginTop: SPACING.md,
    alignItems: "center",
    gap: 8,
  },
  progressBarTrack: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.success,
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
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
  timelineIconCompleted: {
    backgroundColor: COLORS.success,
  },
  timelineIconActive: {
    backgroundColor: COLORS.warning,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs,
    minHeight: SPACING.lg,
  },
  timelineLineCompleted: {
    backgroundColor: COLORS.success,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: SPACING.lg,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  timelineTitleCompleted: {
    color: COLORS.success,
  },
  timelineTitleActive: {
    color: COLORS.warning,
  },
  timelineDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.warning,
    marginBottom: SPACING.lg,
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
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.error,
  },
});
