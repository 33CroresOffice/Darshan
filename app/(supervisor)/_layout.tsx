import { Stack } from "expo-router";

export default function SupervisorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="entry/[id]" />
      <Stack.Screen name="my-darshan-tickets" />
      <Stack.Screen name="sebayat-tickets" />
      <Stack.Screen name="slot-logs" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
