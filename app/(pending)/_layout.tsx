import { Stack } from "expo-router";

export default function PendingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="status" />
      <Stack.Screen name="rejected" />
    </Stack>
  );
}
