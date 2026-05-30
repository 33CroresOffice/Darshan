import { useEffect, useRef, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  AppState,
  AppStateStatus,
  View,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Modal,
  Text,
  TouchableOpacity,
  Linking,
} from "react-native";
import VersionCheck from "react-native-version-check";

import { useFrameworkReady } from "@/hooks/useFrameworkReady";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { SplashScreen } from "@/components/SplashScreen";
import { COLORS } from "@/constants/config";
import { connectivity, probeConnectivity } from "@/lib/offline";
import {
  syncAllDataLocally,
  syncSupervisorDataLocally,
} from "@/services/backgroundSyncService";
import "@/lib/i18n";

const ANDROID_PACKAGE_NAME = "com.x33croresdev.darshan";
const PLAY_STORE_WEB_URL =
  "https://play.google.com/store/apps/details?id=com.x33croresdev.darshan";
const PLAY_STORE_APP_URL = `market://details?id=${ANDROID_PACKAGE_NAME}`;

type UpdateModalData = {
  currentVersion: string;
  latestVersion: string;
  storeUrl: string;
};

function usePlayStoreUpdateCheck() {
  const [updateData, setUpdateData] = useState<UpdateModalData | null>(null);
  const checkingRef = useRef(false);

  const checkUpdate = async () => {
    if (Platform.OS !== "android") return;
    if (checkingRef.current) return;

    checkingRef.current = true;

    try {
      const currentVersion = VersionCheck.getCurrentVersion();

      const latestVersion = await VersionCheck.getLatestVersion({
        provider: "playStore",
        packageName: ANDROID_PACKAGE_NAME,
        ignoreErrors: true,
      });

      if (!latestVersion || typeof latestVersion !== "string") {
        checkingRef.current = false;
        return;
      }

      const result = await VersionCheck.needUpdate({
        currentVersion,
        latestVersion,
        depth: 3,
      });

      if (result?.isNeeded) {
        setUpdateData({
          currentVersion: result.currentVersion || currentVersion,
          latestVersion: result.latestVersion || latestVersion,
          storeUrl: PLAY_STORE_WEB_URL,
        });
      }
    } catch (error) {
      console.log("Version check failed:", error);
    } finally {
      checkingRef.current = false;
    }
  };

  useEffect(() => {
    checkUpdate();

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        checkUpdate();
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  return updateData;
}

function ForceUpdateModal({ updateData }: { updateData: UpdateModalData | null }) {
  if (!updateData) return null;

  const openPlayStore = async () => {
    try {
      await Linking.openURL(PLAY_STORE_APP_URL);
    } catch {
      await Linking.openURL(updateData.storeUrl);
    }
  };

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      hardwareAccelerated
      onRequestClose={() => { }}
    >
      <View style={styles.updateOverlay}>
        <View style={styles.updateCard}>
          <View style={styles.updateIconCircle}>
            <Text style={styles.updateIcon}>↻</Text>
          </View>

          <Text style={styles.updateTitle}>Update Required</Text>

          <Text style={styles.updateMessage}>
            A new version of Darshan app is available on Play Store. Please
            update to continue using the app.
          </Text>

          <View style={styles.versionBox}>
            <Text style={styles.versionText}>
              Current Version: {updateData.currentVersion}
            </Text>
            <Text style={styles.versionText}>
              Latest Version: {updateData.latestVersion}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.updateButton}
            onPress={openPlayStore}
          >
            <Text style={styles.updateButtonText}>Update Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Run a global connectivity probe on startup and keep it updated via
// navigator.onLine events (web) + a periodic ping (all platforms).
// When online, also triggers a background data sync so local caches
// stay current before the device goes offline.
function useGlobalConnectivity(
  sebayatId: string | null | undefined,
  isSupervisor: boolean
) {
  const wasOnlineRef = useRef(connectivity.isOnline());

  useEffect(() => {
    const triggerSync = (id: string) => {
      syncAllDataLocally(id).catch(() => { });
    };

    const triggerSupervisorSync = () => {
      syncSupervisorDataLocally().catch(() => { });
    };

    probeConnectivity().then((online) => {
      if (online && sebayatId) triggerSync(sebayatId);
      if (online && isSupervisor) triggerSupervisorSync();
    });

    const handleOnline = () => {
      connectivity.setOnline(true);
      probeConnectivity().then((online) => {
        if (online && sebayatId) triggerSync(sebayatId);
        if (online && isSupervisor) triggerSupervisorSync();
      });
    };

    const handleOffline = () => connectivity.setOnline(false);

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    const interval = setInterval(async () => {
      const online = await probeConnectivity();
      wasOnlineRef.current = online;
      if (online && sebayatId) triggerSync(sebayatId);
      if (online && isSupervisor) triggerSupervisorSync();
    }, 15000);

    let appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const handleVisibility = () => {
        if (document.visibilityState === "visible" && connectivity.isOnline()) {
          if (sebayatId) triggerSync(sebayatId);
          if (isSupervisor) triggerSupervisorSync();
        }
      };

      document.addEventListener("visibilitychange", handleVisibility);

      return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", handleVisibility);

        if (typeof window !== "undefined") {
          window.removeEventListener("online", handleOnline);
          window.removeEventListener("offline", handleOffline);
        }
      };
    } else {
      const handleAppState = (nextState: AppStateStatus) => {
        if (nextState === "active" && connectivity.isOnline()) {
          if (sebayatId) triggerSync(sebayatId);
          if (isSupervisor) triggerSupervisorSync();
        }
      };

      appStateSub = AppState.addEventListener("change", handleAppState);
    }

    return () => {
      clearInterval(interval);
      appStateSub?.remove();

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, [sebayatId, isSupervisor]);
}

function RootLayoutNav() {
  const { session, profile, registration, registrationLoaded, loading } =
    useAuth();

  const updateData = usePlayStoreUpdateCheck();

  const isSupervisor = profile?.role === "supervisor";
  useGlobalConnectivity(registration?.id, isSupervisor);

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
      const isAdmin =
        profile?.role === "admin" || profile?.role === "superadmin";
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
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(pending)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(supervisor)" />
        <Stack.Screen name="+not-found" />
      </Stack>

      <ForceUpdateModal updateData={updateData} />
    </>
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
          {!splashDone && (
            <SplashScreen onFinish={() => setSplashDone(true)} />
          )}
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

  updateOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },

  updateCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },

  updateIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFF3E8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  updateIcon: {
    fontSize: 36,
    color: "#F97316",
    fontWeight: "800",
  },

  updateTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 10,
    textAlign: "center",
  },

  updateMessage: {
    fontSize: 15,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },

  versionBox: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },

  versionText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "600",
    marginBottom: 4,
  },

  updateButton: {
    width: "100%",
    backgroundColor: "#F97316",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },

  updateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});