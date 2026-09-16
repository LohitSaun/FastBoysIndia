import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function MapLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Explored' }} />
      <Stack.Screen name="drives" options={{ title: 'Your drives' }} />
    </Stack>
  );
}
