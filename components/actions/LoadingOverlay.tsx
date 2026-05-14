import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";

interface LoadingOverlayProps {
  visible?: boolean;
  message?: string;
}

export function LoadingOverlay({ visible = true, message = "Loading..." }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <View style={styles.spinnerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  content: {
    backgroundColor: COLORS.surface,
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    minWidth: 160,
    ...SHADOWS.large,
  },
  spinnerContainer: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  message: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "600",
  },
});
