import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { DarshanTicketCreator } from "@/components/tickets/DarshanTicketCreator";
import { COLORS, SPACING } from "@/constants/config";
import { useTranslation } from "react-i18next";

export default function MyDarshanTicketsScreen() {
  const router = useRouter();
  const tabBarHeight = 0;
  const { t } = useTranslation();
  const { profile, hasApprovedRegistration, sebayatRegistrationId } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('supervisor.darshanTickets.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {hasApprovedRegistration && sebayatRegistrationId ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          <DarshanTicketCreator
            sebayatRegistrationId={sebayatRegistrationId}
            userName={profile?.full_name}
          />
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {t('supervisor.darshanTickets.needsRegistration')}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
  },
  headerSpacer: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
