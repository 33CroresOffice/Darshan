import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Circle as XCircle, TriangleAlert as AlertTriangle, LogOut, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/actions/Button";
import { signOut } from "@/services/authService";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import { supabase } from "@/lib/supabase";
import type { RegistrationApproval } from "@/types";

export default function RejectedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { registration } = useAuth();
  const [adminVotes, setAdminVotes] = useState<RegistrationApproval[]>([]);
  const [loadingVotes, setLoadingVotes] = useState(false);

  useEffect(() => {
    if (!registration?.id) return;
    setLoadingVotes(true);
    supabase
      .from("registration_approvals")
      .select("*, admin:profiles(full_name, phone_number)")
      .eq("registration_id", registration.id)
      .eq("submission_round", registration.submission_round ?? 1)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setAdminVotes((data || []) as RegistrationApproval[]);
      })
      .finally(() => setLoadingVotes(false));
  }, [registration?.id, registration?.submission_round]);

  const handleResubmit = () => {
    router.push("/(onboarding)/resubmit");
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const isManagementDecision = registration?.rejection_type === "management_decision";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("pending.appStatusTitle")}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusBanner}>
          <View style={styles.statusIcon}>
            <XCircle size={28} color={COLORS.error} strokeWidth={2} />
          </View>
          <Text style={styles.statusTitle}>{t("pending.rejectedHeading")}</Text>
          <Text style={styles.statusSubtitle}>{t("pending.rejectedSubheading")}</Text>
        </View>

        {adminVotes.length > 0 && (
          <View style={styles.votesCard}>
            <View style={styles.votesHeader}>
              <AlertTriangle size={18} color={COLORS.error} />
              <Text style={styles.votesTitle}>{t("pending.adminDecisions")}</Text>
            </View>

            {adminVotes.map((vote) => {
              const isRejected = vote.action === "rejected";
              const actionDate = new Date(vote.updated_at);
              const formattedDate = actionDate.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              });
              return (
                <View key={vote.id} style={styles.voteRow}>
                  <View style={[
                    styles.voteIcon,
                    isRejected ? styles.voteIconRejected : styles.voteIconApproved,
                  ]}>
                    {isRejected ? (
                      <XCircle size={14} color={COLORS.surface} />
                    ) : (
                      <Check size={14} color={COLORS.surface} />
                    )}
                  </View>
                  <View style={styles.voteInfo}>
                    <Text style={styles.voteAdminName}>
                      {vote.admin?.full_name || vote.admin?.phone_number || "Admin"}
                    </Text>
                    <Text style={styles.voteDate}>{formattedDate}</Text>
                    {isRejected && vote.rejection_reason ? (
                      <Text style={styles.voteReason}>{vote.rejection_reason}</Text>
                    ) : null}
                  </View>
                  <Text style={[
                    styles.voteLabel,
                    isRejected ? styles.voteLabelRejected : styles.voteLabelApproved,
                  ]}>
                    {isRejected ? t("pending.rejected") : t("pending.approved")}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{t("pending.whatCanYouDo")}</Text>
          {isManagementDecision ? (
            <Text style={styles.infoText}>{t("pending.managementDecisionText")}</Text>
          ) : (
            <Text style={styles.infoText}>{t("pending.wrongDataText")}</Text>
          )}
        </View>

        <View style={styles.buttonContainer}>
          {!isManagementDecision && (
            <Button
              title={t("pending.resubmitRegistration")}
              onPress={handleResubmit}
              size="large"
            />
          )}
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LogOut size={20} color={COLORS.error} />
            <Text style={styles.signOutText}>{t("common.signOut")}</Text>
          </TouchableOpacity>
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
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: "center",
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.error,
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
  votesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.medium,
  },
  votesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  votesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  voteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  voteIcon: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  voteIconRejected: {
    backgroundColor: COLORS.error,
  },
  voteIconApproved: {
    backgroundColor: COLORS.success,
  },
  voteInfo: {
    flex: 1,
  },
  voteAdminName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  voteDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  voteReason: {
    fontSize: 13,
    color: COLORS.error,
    marginTop: 4,
    lineHeight: 18,
    fontWeight: "500",
  },
  voteLabel: {
    fontSize: 12,
    fontWeight: "600",
    alignSelf: "center",
  },
  voteLabelRejected: {
    color: COLORS.error,
  },
  voteLabelApproved: {
    color: COLORS.success,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.medium,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  buttonContainer: {
    gap: SPACING.md,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.md,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.error,
  },
});
