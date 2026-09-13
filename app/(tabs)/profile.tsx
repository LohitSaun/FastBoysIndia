import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { selectPhone } from '@/features/auth/authSlice';
import { useSignOut } from '@/features/auth/hooks';
import { useActiveCities, useMyProfile } from '@/features/profile/hooks';
import { formatForDisplay } from '@/lib/phone';
import { useAppSelector } from '@/store';
import { colors, radius, spacing, typography } from '@/theme';

export default function ProfileScreen() {
  const phone = useAppSelector(selectPhone);
  const { data: profile } = useMyProfile();
  const { data: cities } = useActiveCities();
  const signOut = useSignOut();

  const cityName = cities?.find((city) => city.id === profile?.home_city_id)?.name;

  return (
    <Screen edges={['top', 'right', 'left']} style={styles.container}>
      <Text style={styles.title}>{profile?.display_name ?? 'Your profile'}</Text>

      <View style={styles.card}>
        <InfoRow label="Home city" value={cityName ?? '—'} />
        <View style={styles.divider} />
        <InfoRow label="Phone" value={phone ? formatForDisplay(phone) : '—'} />
      </View>

      <View style={styles.footer}>
        {signOut.isError ? (
          <Text style={styles.error}>
            {"Couldn't sign out. Check your connection and try again."}
          </Text>
        ) : null}
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.md,
  },
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  rowValue: {
    ...typography.body,
    color: colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  footer: {
    marginTop: 'auto',
    gap: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
});
