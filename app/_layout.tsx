import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useFrameworkReady } from "@/hooks/useFrameworkReady";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { SplashScreen } from "@/components/SplashScreen";
import { COLORS } from "@/constants/config";
import "@/lib/i18n";

function RootLayoutNav() {
  const { session, profile, registration, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // segments[0] is undefined until Expo Router resolves the initial URL —
    // bail out so we never redirect away from the current deep-link on mount.
    if (segments[0] === undefined) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboardingGroup = segments[0] === "(onboarding)";
    const inPendingGroup = segments[0] === "(pending)";
    const inAppGroup = segments[0] === "(app)";
    const inAdminGroup = segments[0] === "(admin)";
    const inSupervisorGroup = segments[0] === "(supervisor)";

    if (!session) {
      if (!inAuthGroup) {
        router.replace("/(auth)/phone");
      }
    } else if (profile?.is_active === false) {
      if (!inAuthGroup) {
        router.replace("/(auth)/phone");
      }
    } else {
      const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
      const isSupervisor = profile?.role === "supervisor";

      if (isAdmin) {
        if (!inAdminGroup) {
          router.replace("/(admin)/dashboard");
        }
      } else if (isSupervisor) {
        if (!inSupervisorGroup) {
          router.replace("/(supervisor)");
        }
      } else if (!registration) {
        if (!inOnboardingGroup) {
          router.replace("/(onboarding)/registration");
        }
      } else if (registration.approval_status === "pending") {
        if (!inPendingGroup && !inOnboardingGroup) {
          router.replace("/(pending)/status");
        }
      } else if (registration.approval_status === "rejected") {
        if (!inPendingGroup && !inOnboardingGroup) {
          router.replace("/(pending)/rejected");
        }
      } else if (registration.approval_status === "approved") {
        if (!inAppGroup) {
          router.replace("/(app)");
        }
      }
    }
  }, [session, profile, registration, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(pending)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(supervisor)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  const [splashDone, setSplashDone] = useState(false);

  return (
    <LanguageProvider>
      <AuthProvider>
        <NotificationProvider>
          <RootLayoutNav />
          <StatusBar style="light" />
          {!splashDone && <SplashScreen onFinish={() => setSplashDone(true)} />}
        </NotificationProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
});
