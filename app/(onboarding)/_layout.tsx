import { Stack } from 'expo-router';

import { colors } from '@/theme';

/** First-run setup for new accounts. Just one screen for now. */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
