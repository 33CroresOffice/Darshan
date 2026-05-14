import { View, Text, StyleSheet } from "react-native";
import { COLORS, RADIUS, SPACING } from "@/constants/config";
import type { ApprovalStatus } from "@/types";

interface StatusBadgeProps {
  status: ApprovalStatus;
  size?: "small" | "medium";
}

const statusConfig = {
  pending: {
    backgroundColor: COLORS.warningLight,
    textColor: COLORS.warning,
    label: "Pending",
  },
  approved: {
    backgroundColor: COLORS.successLight,
    textColor: COLORS.success,
    label: "Approved",
  },
  rejected: {
    backgroundColor: COLORS.errorLight,
    textColor: COLORS.error,
    label: "Rejected",
  },
};

export function StatusBadge({ status, size = "medium" }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.backgroundColor },
        size === "small" && styles.small,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.textColor }]} />
      <Text
        style={[
          styles.text,
          { color: config.textColor },
          size === "small" && styles.smallText,
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    alignSelf: "flex-start",
    gap: SPACING.xs,
  },
  small: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.full,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
  },
  smallText: {
    fontSize: 11,
  },
});
