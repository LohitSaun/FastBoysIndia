import { Stack } from 'expo-router';

import { colors } from '@/theme';

// When a signed-out user lands in this group, start them on the phone number screen.
export const unstable_settings = {
  initialRouteName: 'sign-in',
};

/** Signed-out screens: enter phone number → enter OTP. */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="verify" />
    </Stack>
  );
}
