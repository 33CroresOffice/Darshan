import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { ArrowLeft, UserCheck, WifiOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { SebayatSearchPanel } from "./SebayatSearchPanel";
import { DarshanTicketCreator } from "./DarshanTicketCreator";
import { useAuth } from "@/context/AuthContext";
import { connectivity } from "@/lib/offline";
import { getOfflineModeEnabled } from "@/services/settingsService";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type { SebayatRegistration } from "@/types/database";

interface StaffTicketCreatorProps {
  onBack: () => void;
}

export function StaffTicketCreator({ onBack }: StaffTicketCreatorProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [selectedSebayat, setSelectedSebayat] = useState<SebayatRegistration | null>(null);
  const [isOffline, setIsOffline] = useState(!connectivity.isOnline());
  const [offlineModeEnabled, setOfflineModeEnabled] = useState(true);

  useEffect(() => {
    getOfflineModeEnabled().then(setOfflineModeEnabled).catch(() => {});
    const unsub = connectivity.subscribe(() => {
      const offline = !connectivity.isOnline();
      setIsOffline(offline);
      if (offline) {
        getOfflineModeEnabled().then(setOfflineModeEnabled).catch(() => {});
      }
    });
    return unsub;
  }, []);

  const isBlocked = isOffline && !offlineModeEnabled;

  if (isBlocked) {
    return (
      <View style={styles.blockedContainer}>
        <WifiOff size={40} color={COLORS.textMuted} />
        <Text style={styles.blockedTitle}>{t("supervisor.sebayatTickets.offlineDisabledTitle")}</Text>
        <Text style={styles.blockedBody}>{t("supervisor.sebayatTickets.offlineDisabledBody")}</Text>
      </View>
    );
  }

  if (selectedSebayat) {
    return (
      <View style={styles.flex}>
        <View style={styles.selectedBanner}>
          <TouchableOpacity
            style={styles.changeSebayatButton}
            onPress={() => setSelectedSebayat(null)}
          >
            <ArrowLeft size={16} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.selectedBannerContent}>
            <UserCheck size={16} color={COLORS.success} />
            <View style={styles.selectedBannerText}>
              <Text style={styles.selectedLabel}>{t("supervisor.sebayatTickets.creatingFor")}</Text>
              <Text style={styles.selectedName}>{selectedSebayat.full_name}</Text>
              {selectedSebayat.category?.name && (
                <Text style={styles.selectedCategory}>{selectedSebayat.category.name}</Text>
              )}
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.ticketScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <DarshanTicketCreator
            sebayatRegistrationId={selectedSebayat.id}
            userName={selectedSebayat.full_name}
            staffMode
            staffUserId={user?.id}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.instructionCard}>
        <Text style={styles.instructionTitle}>{t("supervisor.sebayatTickets.searchTitle")}</Text>
        <Text style={styles.instructionText}>{t("supervisor.sebayatTickets.searchInfo")}</Text>
      </View>

      <SebayatSearchPanel onSelect={setSelectedSebayat} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  instructionCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primaryDark,
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 13,
    color: COLORS.primaryDark,
    lineHeight: 18,
    opacity: 0.8,
  },
  selectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.successLight,
    ...SHADOWS.small,
  },
  changeSebayatButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedBannerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  selectedBannerText: {
    flex: 1,
  },
  selectedLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 1,
  },
  selectedName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  selectedCategory: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "500",
    marginTop: 1,
  },
  ticketScrollContent: {
    paddingBottom: SPACING.xl,
  },
  blockedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  blockedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  blockedBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
