import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { Hop as Home, User, History } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS } from "@/constants/config";
import { OfflineBanner } from "@/components/layout/OfflineBanner";

function AppBanner() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 4 }}>
      <OfflineBanner />
    </View>
  );
}

export default function AppTabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 16);

  return (
    <View style={styles.container}>
      <AppBanner />
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
            paddingTop: 6,
            paddingBottom: bottomPad,
            height: 60 + bottomPad,
            paddingHorizontal: 4,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "500",
            marginTop: 2,
            flexShrink: 1,
          },
          tabBarItemStyle: {
            paddingVertical: 4,
          },
          tabBarIconStyle: {
            marginBottom: 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("app.tabs.home"),
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <Home size={22} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: t("app.tabs.history"),
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
            title: t("app.tabs.profile"),
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconContainer : undefined}>
                <User size={22} color={color} />
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
  activeIconContainer: {
    backgroundColor: "rgba(13, 148, 136, 0.12)",
    borderRadius: RADIUS.sm,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
});
