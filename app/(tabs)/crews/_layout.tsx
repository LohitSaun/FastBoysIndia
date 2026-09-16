import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function CrewsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Crews' }} />
      <Stack.Screen name="new" options={{ title: 'Create crew' }} />
      <Stack.Screen name="join" options={{ title: 'Join a crew' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Crew' }} />
      <Stack.Screen name="[id]/convoy" options={{ title: 'Drive' }} />
    </Stack>
  );
}
