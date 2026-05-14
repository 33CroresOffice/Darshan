import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Bell, LogOut, Settings, Phone, QrCode, MessageSquare } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { signOut } from "@/services/authService";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";

interface AdminHeaderProps {
  showSignOut?: boolean;
  notificationsRoute?: string;
  settingsRoute?: string;
  showSettings?: boolean;
  nameOverride?: string;
  roleOverride?: string;
  phoneOverride?: string;
  onQrPress?: () => void;
  onFeedbackPress?: () => void;
}

export function AdminHeader({
  showSignOut = true,
  notificationsRoute = "/(admin)/notifications",
  settingsRoute = "/(admin)/settings",
  showSettings = true,
  nameOverride,
  roleOverride,
  phoneOverride,
  onQrPress,
  onFeedbackPress,
}: AdminHeaderProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { unreadCount } = useNotifications();

  const handleSignOut = async () => {
    await signOut();
  };

  const getRoleLabel = () => {
    if (roleOverride) return roleOverride;
    switch (profile?.role) {
      case "superadmin":
        return "Super Admin";
      case "admin":
        return "Admin";
      case "supervisor":
        return "Supervisor";
      default:
        return "Staff";
    }
  };

  const displayName = nameOverride || profile?.full_name || "Welcome";

  return (
    <View style={styles.header}>
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName?.charAt(0)?.toUpperCase() || "A"}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.greeting} numberOfLines={1}>
            {displayName}
          </Text>
          {phoneOverride ? (
            <View style={styles.phoneRow}>
              <Phone size={12} color={COLORS.textSecondary} />
              <Text style={styles.role}>{phoneOverride}</Text>
            </View>
          ) : (
            <Text style={styles.role}>{getRoleLabel()}</Text>
          )}
        </View>
      </View>
      <View style={styles.headerActions}>
        {onQrPress && (
          <TouchableOpacity style={styles.iconButton} onPress={onQrPress}>
            <QrCode size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
        {onFeedbackPress && (
          <TouchableOpacity style={styles.iconButton} onPress={onFeedbackPress}>
            <MessageSquare size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push(notificationsRoute as any)}
        >
          <Bell size={20} color={COLORS.textSecondary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        {showSettings && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push(settingsRoute as any)}
          >
            <Settings size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
        {showSignOut && (
          <TouchableOpacity style={styles.iconButton} onPress={handleSignOut}>
            <LogOut size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
  },
  profileInfo: {
    flex: 1,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  greeting: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  role: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.error,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
