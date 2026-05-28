import { Tabs, useRouter } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { LayoutDashboard, DoorOpen, ScanLine, History, Bell, Ticket, CircleUser as UserCircle, MessageSquare, RefreshCw, CircleCheck as CheckCircle, WifiOff } from "lucide-react-native";
import { COLORS, RADIUS, SPACING } from "@/constants/config";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { FeedbackModal } from "@/components/feedback/FeedbackModal";
import { useTranslation } from "react-i18next";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { useSupervisorSync } from "@/hooks/useSupervisorSync";
import { connectivity } from "@/lib/offline";

function GlobalHeader({ sync }: { sync: ReturnType<typeof useSupervisorSync> }) {
  const router = useRouter();
  const { profile, hasApprovedRegistration } = useAuth();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const { t } = useTranslation();
  const isOffline = !connectivity.isOnline();

  const syncLabel = sync.syncing
    ? `Syncing…`
    : sync.sebayatCount > 0
    ? `${sync.sebayatCount} cached`
    : isOffline
    ? "No cache"
    : "Tap to sync";

  return (
    <>
      <View style={[styles.globalHeader, { paddingTop: insets.top + 8 }]}>
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.charAt(0)?.toUpperCase() || "S"}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile?.full_name || "Welcome"}
            </Text>
            <TouchableOpacity
              style={styles.syncRow}
              onPress={() => { if (!isOffline && !sync.syncing) sync.triggerSync(); }}
              activeOpacity={isOffline || sync.syncing ? 1 : 0.7}
            >
              {sync.syncing ? (
                <ActivityIndicator size={10} color={COLORS.primary} />
              ) : isOffline ? (
                <WifiOff size={10} color={COLORS.error} />
              ) : sync.sebayatCount > 0 ? (
                <CheckCircle size={10} color={COLORS.success} />
              ) : (
                <RefreshCw size={10} color={COLORS.warning} />
              )}
              <Text style={[
                styles.profileRole,
                sync.sebayatCount === 0 && !isOffline && !sync.syncing && styles.syncWarning,
                isOffline && styles.syncError,
              ]}>
                {syncLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerActions}>
          {hasApprovedRegistration && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push("/(supervisor)/my-darshan-tickets")}
            >
              <Ticket size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setFeedbackVisible(true)}
          >
            <MessageSquare size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push("/(supervisor)/notifications")}
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
        </View>
      </View>
      {profile && (
        <FeedbackModal
          visible={feedbackVisible}
          onClose={() => setFeedbackVisible(false)}
          userId={profile.id}
          role="supervisor"
        />
      )}
    </>
  );
}

export default function SupervisorTabsLayout() {
  const sync = useSupervisorSync();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 16);

  return (
    <View style={styles.container}>
      <GlobalHeader sync={sync} />
      <OfflineBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          lazy: false,
          detachInactiveScreens: false,
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
          name="index"
          options={{
            title: t('supervisor.tabs.dashboard'),
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <LayoutDashboard size={22} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="west-gate"
          options={{
            title: t('supervisor.tabs.westGate'),
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <DoorOpen size={22} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="inner-gate"
          options={{
            title: t('supervisor.tabs.innerGate'),
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <ScanLine size={22} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: t('supervisor.tabs.history'),
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <History size={22} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('supervisor.tabs.profile'),
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <UserCircle size={22} color={color} />
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
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  syncWarning: {
    color: COLORS.warning,
  },
  syncError: {
    color: COLORS.error,
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
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
});
