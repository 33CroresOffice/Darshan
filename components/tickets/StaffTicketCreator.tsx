import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { ArrowLeft, UserCheck } from "lucide-react-native";
import { SebayatSearchPanel } from "./SebayatSearchPanel";
import { DarshanTicketCreator } from "./DarshanTicketCreator";
import { useAuth } from "@/context/AuthContext";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type { SebayatRegistration } from "@/types/database";

interface StaffTicketCreatorProps {
  onBack: () => void;
}

export function StaffTicketCreator({ onBack }: StaffTicketCreatorProps) {
  const { user } = useAuth();
  const [selectedSebayat, setSelectedSebayat] = useState<SebayatRegistration | null>(null);

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
              <Text style={styles.selectedLabel}>Creating ticket for:</Text>
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
        <Text style={styles.instructionTitle}>Search for a Sebayat</Text>
        <Text style={styles.instructionText}>
          Find an approved sebayat by phone number, health card ID, or temple ID, then create a darshan ticket on their behalf.
        </Text>
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
});
