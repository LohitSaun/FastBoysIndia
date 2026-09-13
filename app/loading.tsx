import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { selectAuthStatus } from '@/features/auth/authSlice';
import { useSignOut } from '@/features/auth/hooks';
import { useMyProfile } from '@/features/profile/hooks';
import { useAppSelector } from '@/store';
import { colors, spacing, typography } from '@/theme';

/**
 * Shown briefly at startup while we restore the session and load the profile.
 * If the profile can't load (usually no signal), offer Retry and Sign out
 * instead of spinning forever.
 */
export default function LoadingScreen() {
  const status = useAppSelector(selectAuthStatus);
  const profile = useMyProfile();
  const signOut = useSignOut();

  const failed = status === 'signedIn' && profile.isError && profile.data === undefined;

  if (!failed) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.center}>
      <Text style={styles.title}>{"Couldn't load your profile"}</Text>
      <Text style={styles.body}>Check your internet connection and try again.</Text>
      <View style={styles.actions}>
        <Button
          title="Try again"
          onPress={() => profile.refetch()}
          loading={profile.isFetching}
        />
        <Button
          title="Sign out"
          variant="secondary"
          onPress={() => signOut.mutate()}
          loading={signOut.isPending}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
