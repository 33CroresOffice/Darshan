import { useEffect, useRef, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppState, AppStateStatus, View, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useFrameworkReady } from "@/hooks/useFrameworkReady";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { SplashScreen } from "@/components/SplashScreen";
import { COLORS } from "@/constants/config";
import { connectivity, probeConnectivity } from "@/lib/offline";
import { syncAllDataLocally } from "@/services/backgroundSyncService";
import "@/lib/i18n";

// Run a global connectivity probe on startup and keep it updated via
// navigator.onLine events (web) + a periodic ping (all platforms).
// When online, also triggers a background data sync so local caches
// stay current before the device goes offline.
function useGlobalConnectivity(sebayatId: string | null | undefined) {
  const wasOnlineRef = useRef(connectivity.isOnline());

  useEffect(() => {
    const triggerSync = (id: string) => {
      syncAllDataLocally(id).catch(() => {});
    };

    // Probe immediately so the singleton reflects real state before any
    // screen mounts — this prevents the app from crashing on cold start
    // because it assumed it was online.
    probeConnectivity().then((online) => {
      if (online && sebayatId) triggerSync(sebayatId);
    });

    // Web: react to browser online/offline events instantly
    const handleOnline = () => {
      connectivity.setOnline(true);
      probeConnectivity().then((online) => {
        if (online && sebayatId) triggerSync(sebayatId);
      });
    };
    const handleOffline = () => connectivity.setOnline(false);

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    // All platforms: re-probe every 15 seconds so we catch intermittent drops.
    // On reconnect (was offline, now online), sync immediately.
    const interval = setInterval(async () => {
      const online = await probeConnectivity();
      const wasOnline = wasOnlineRef.current;
      wasOnlineRef.current = online;
      if (online && sebayatId) {
        // Always sync every 15-second tick while connected, and especially
        // on reconnect so the cache is immediately refreshed.
        triggerSync(sebayatId);
      }
      if (!wasOnline && online && sebayatId) {
        // Reconnect: also fires through the sync above, no duplicate needed
      }
    }, 15000);

    // AppState: sync when app comes back to foreground from background
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active" && sebayatId && connectivity.isOnline()) {
        triggerSync(sebayatId);
      }
    };
    const appStateSub = AppState.addEventListener("change", handleAppState);

    return () => {
      clearInterval(interval);
      appStateSub.remove();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, [sebayatId]);
}

function RootLayoutNav() {
  const { session, profile, registration, registrationLoaded, loading } = useAuth();
  useGlobalConnectivity(registration?.id);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
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
      } else if (registrationLoaded && !registration) {
        // Only redirect to onboarding once the server confirmed no registration
        // exists. If offline the fetch never succeeds, so registrationLoaded
        // stays false and we stay on the current screen.
        if (!inOnboardingGroup) {
          router.replace("/(onboarding)/registration");
        }
      } else if (registration?.approval_status === "pending") {
        if (!inPendingGroup && !inOnboardingGroup) {
          router.replace("/(pending)/status");
        }
      } else if (registration?.approval_status === "rejected") {
        if (!inPendingGroup && !inOnboardingGroup) {
          router.replace("/(pending)/rejected");
        }
      } else if (registration?.approval_status === "approved") {
        if (!inAppGroup) {
          router.replace("/(app)");
        }
      }
    }
  }, [session, profile, registration, registrationLoaded, loading, segments]);

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
