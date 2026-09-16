import { Stack } from 'expo-router';

import { colors } from '@/theme';

/**
 * The Garage tab is a small stack of its own: the car list, then the screens
 * you push on top of it (a car, its forms, its mods). Keeping them inside the
 * tab means the tab bar stays visible and the back button works as expected.
 */
export default function GarageLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Garage' }} />
      <Stack.Screen name="new" options={{ title: 'Add car' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Car' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Edit car' }} />
      <Stack.Screen name="[id]/mods/new" options={{ title: 'Add mod' }} />
      <Stack.Screen name="[id]/mods/[modId]" options={{ title: 'Edit mod' }} />
    </Stack>
  );
}
