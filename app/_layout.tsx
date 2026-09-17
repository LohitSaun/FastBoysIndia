/**
 * Root layout: the first component Expo Router renders. Every screen sits inside it.
 *
 * It does two jobs:
 *
 * 1. Sets up app-wide "providers" (the Redux store and the TanStack Query cache)
 *    so any screen can use them.
 *
 * 2. Decides which part of the app the user may see, using Stack.Protected:
 *
 *      loading      → restoring the saved session, or fetching the profile
 *      (auth)       → signed out: phone number + OTP screens
 *      (onboarding) → signed in, but no display name / home city yet
 *      (tabs)       → signed in with a complete profile: the main app
 *
 *    Exactly one of these is allowed at a time. When the state changes (say, the OTP is
 *    verified), Expo Router moves the user to the newly allowed group automatically,
 *    so no screen ever has to call router.replace() after signing in or out.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider as ReduxProvider } from 'react-redux';

import { selectAuthStatus } from '@/features/auth/authSlice';
import { useAuthListener } from '@/features/auth/useAuthListener';
import { isProfileComplete, useMyProfile } from '@/features/profile/hooks';
import { useRestoreSettings } from '@/features/settings/hooks';
import { queryClient } from '@/lib/queryClient';
import { initSentry, withSentry } from '@/services/monitoring/sentry';
import { useScreenTracking } from '@/services/monitoring/useScreenTracking';
import { store, useAppSelector } from '@/store';
import { colors } from '@/theme';

// Runs once at startup, before anything renders, so even startup crashes get reported.
initSentry();

function RootNavigator() {
  useAuthListener();
  useScreenTracking();
  useRestoreSettings();

  const status = useAppSelector(selectAuthStatus);
  const profile = useMyProfile();

  const signedIn = status === 'signedIn';
  // We check for data rather than `isSuccess`: if a background refetch fails on a
  // patchy connection, we still have the last good profile and shouldn't kick the
  // user back to the loading screen.
  const hasProfile = profile.data !== undefined;
  const profileComplete = isProfileComplete(profile.data);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={status === 'loading' || (signedIn && !hasProfile)}>
        <Stack.Screen name="loading" options={{ animation: 'fade' }} />
      </Stack.Protected>

      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && hasProfile && !profileComplete}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && hasProfile && profileComplete}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

function RootLayout() {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <RootNavigator />
      </QueryClientProvider>
    </ReduxProvider>
  );
}

export default withSentry(RootLayout);
