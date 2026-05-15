import { View, Text, StyleSheet, Image } from "react-native";
import { User, Phone, UserCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS, SPACING } from "@/constants/config";
import type { Gumasta } from "@/types/database";

interface Props {
  gumasta: Gumasta;
}

export function GumastaInfoCard({ gumasta }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <UserCheck size={12} color="#fff" />
        <Text style={styles.badgeText}>{t("gumasta.sentViaGumasta")}</Text>
      </View>
      <View style={styles.row}>
        {gumasta.photo_url ? (
          <Image source={{ uri: gumasta.photo_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <User size={20} color={COLORS.textMuted} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{gumasta.name}</Text>
          <View style={styles.phoneRow}>
            <Phone size={12} color={COLORS.textSecondary} />
            <Text style={styles.phone}>{gumasta.contact_number}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(13, 148, 136, 0.06)",
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(13, 148, 136, 0.2)",
    marginTop: SPACING.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    alignSelf: "flex-start",
    marginBottom: SPACING.xs,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  phone: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
