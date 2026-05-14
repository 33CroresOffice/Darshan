import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useAuth } from "./AuthContext";
import {
  registerForPushNotifications,
  savePushToken,
  getUnreadCount,
} from "@/services/notificationService";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = async () => {
    if (user?.id) {
      const count = await getUnreadCount(user.id);
      setUnreadCount(count);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const setupNotifications = async () => {
      if (Platform.OS !== "web") {
        const token = await registerForPushNotifications();
        if (token) {
          await savePushToken(user.id, token);
        }
      }
      await refreshUnreadCount();
    };

    setupNotifications();

    let notificationSubscription: Notifications.EventSubscription | undefined;
    let responseSubscription: Notifications.EventSubscription | undefined;

    if (Platform.OS !== "web") {
      notificationSubscription = Notifications.addNotificationReceivedListener(
        () => {
          refreshUnreadCount();
        }
      );

      responseSubscription =
        Notifications.addNotificationResponseReceivedListener(() => {
          refreshUnreadCount();
        });
    }

    return () => {
      notificationSubscription?.remove();
      responseSubscription?.remove();
    };
  }, [user?.id]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
}
