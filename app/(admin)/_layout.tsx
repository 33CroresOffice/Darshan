import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="devotee-analytics" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="pending" />
      <Stack.Screen name="approved" />
      <Stack.Screen name="rejected" />
      <Stack.Screen name="review/[id]" />
      <Stack.Screen name="create-admin" />
      <Stack.Screen name="edit-user/[id]" />
      <Stack.Screen name="register-sebayat" />
      <Stack.Screen name="sebayat-reports" />
      <Stack.Screen name="supervisor-reports" />
      <Stack.Screen name="self-registration" />
      <Stack.Screen name="user-history/[id]" />
      <Stack.Screen name="all-sebayat-data" />
      <Stack.Screen name="my-darshan-tickets" />
      <Stack.Screen name="sebayat-tickets" />
      <Stack.Screen name="slot-logs" />
      <Stack.Screen name="slot-session-reports" />
      <Stack.Screen name="feedback" />
      <Stack.Screen name="gumasta-reviews" />
      <Stack.Screen name="gumasta-review/[id]" />
    </Stack>
  );
}
