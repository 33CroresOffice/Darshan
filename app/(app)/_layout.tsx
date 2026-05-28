import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="gumastas" />
      <Stack.Screen name="gumasta-add" />
      <Stack.Screen name="gumasta-detail" />
      <Stack.Screen name="assign-gumasta" />
    </Stack>
  );
}
