import { Tabs, useRouter } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LayoutDashboard, ClipboardList, Users, DoorOpen, TrendingUp, Bell, Settings, Ticket } from "lucide-react-native";
import { COLORS, RADIUS, SPACING } from "@/constants/config";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OfflineBanner } from "@/components/layout/OfflineBanner";

function GlobalHeader() {
  const router = useRouter();
  const { profile, hasApprovedRegistration } = useAuth();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();

  const getRoleLabel = () => {
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

  return (
    <View style={[styles.globalHeader, { paddingTop: insets.top + 8 }]}>
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.full_name?.charAt(0)?.toUpperCase() || "A"}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName} numberOfLines={1}>
            {profile?.full_name || "Welcome"}
          </Text>
          <Text style={styles.profileRole}>{getRoleLabel()}</Text>
        </View>
      </View>
      <View style={styles.headerActions}>
        {hasApprovedRegistration && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push("/(admin)/my-darshan-tickets")}
          >
            <Ticket size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push("/(admin)/notifications")}
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
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push("/(admin)/settings")}
        >
          <Settings size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AdminTabsLayout() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === "superadmin";
  const isAdmin = profile?.role === "admin";
  const canManageUsers = isSuperAdmin || isAdmin;
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 16);

  return (
    <View style={styles.container}>
      <GlobalHeader />
      <OfflineBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          lazy: false,
          detachInactiveScreens: false,
          sceneStyle: { paddingTop: 0 },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textSecondary,
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
            backgroundColor: COLORS.surface,
            paddingTop: 8,
            paddingBottom: bottomPad,
            height: 68 + bottomPad,
            paddingHorizontal: 4,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "500",
            marginTop: 2,
          },
          tabBarItemStyle: {
            paddingVertical: 2,
          },
          tabBarIconStyle: {
            marginBottom: 0,
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <LayoutDashboard size={22} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="reviews"
          options={{
            title: "Reviews",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <ClipboardList size={22} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="gate-management"
          options={{
            title: "Gates",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <DoorOpen size={22} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="users"
          options={{
            title: "Users",
            href: canManageUsers ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <Users size={22} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            title: "Insights",
            href: canManageUsers ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <TrendingUp size={22} color={color} />
              </View>
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  globalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  profileRole: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.error,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  activeIconContainer: {
    backgroundColor: "rgba(13, 148, 136, 0.12)",
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
});
