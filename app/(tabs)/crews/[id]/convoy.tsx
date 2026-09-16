import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { selectUserId } from '@/features/auth/authSlice';
import { useCrew } from '@/features/crews/hooks';
import { ghostModeReset, ghostModeToggled, selectGhostMode } from '@/features/convoys/convoySlice';
import {
  useActiveConvoy,
  useConvoyLive,
  useEndConvoy,
  useLeaveConvoy,
  useParticipants,
} from '@/features/convoys/hooks';
import { useMyProfile } from '@/features/profile/hooks';
import { AppMap, type AppMapMarker } from '@/services/maps/AppMap';
import { useAppDispatch, useAppSelector } from '@/store';
import { colors, radius, spacing, typography } from '@/theme';

export default function ConvoyScreen() {
  const { id: crewId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const myUserId = useAppSelector(selectUserId);
  const ghostMode = useAppSelector(selectGhostMode);

  const crew = useCrew(crewId);
  const convoy = useActiveConvoy(crewId);
  const profile = useMyProfile();
  const participants = useParticipants(convoy.data?.id);

  const endConvoy = useEndConvoy(crewId);
  const leaveConvoy = useLeaveConvoy(crewId);

  const myName = profile.data?.display_name ?? 'Me';
  const { myPosition, others, permission } = useConvoyLive(convoy.data?.id, myName);

  if (convoy.isPending) {
    return (
      <Screen edges={['left', 'right']} style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (!convoy.data) {
    return (
      <Screen edges={['left', 'right']} style={styles.centered}>
        <Text style={styles.title}>No drive running</Text>
        <Text style={styles.hint}>Someone in the crew needs to start one first.</Text>
        <Button title="Back to crew" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const drive = convoy.data;
  const canEnd = drive.started_by === myUserId || crew.data?.owner_id === myUserId;

  const markers: AppMapMarker[] = [
    ...(myPosition && !ghostMode
      ? [
          {
            id: 'me',
            latitude: myPosition.latitude,
            longitude: myPosition.longitude,
            label: `${myName} (you)`,
            kind: 'me' as const,
          },
        ]
      : []),
    ...others.map((other) => ({
      id: other.userId,
      latitude: other.position.latitude,
      longitude: other.position.longitude,
      label: other.displayName,
      kind: 'other' as const,
    })),
  ];

  const handleEnd = () => {
    Alert.alert('End this drive?', 'Everyone stops sharing their location.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End drive',
        style: 'destructive',
        onPress: () =>
          endConvoy.mutate(drive.id, {
            onSuccess: () => {
              dispatch(ghostModeReset());
              router.back();
            },
          }),
      },
    ]);
  };

  const handleLeave = () => {
    leaveConvoy.mutate(drive.id, {
      onSuccess: () => {
        dispatch(ghostModeReset());
        router.back();
      },
    });
  };

  return (
    <Screen edges={['left', 'right']} style={styles.screen}>
      <Stack.Screen options={{ title: crew.data?.name ?? 'Drive' }} />

      <View style={styles.mapWrapper}>
        {permission === 'denied' ? (
          <View style={styles.mapFallback}>
            <Text style={styles.title}>Location is off</Text>
            <Text style={styles.hint}>
              Allow location for Expo Go in your phone settings, then come back to this screen.
            </Text>
          </View>
        ) : (
          <AppMap
            markers={markers}
            initialCenter={myPosition ?? others[0]?.position ?? null}
          />
        )}
      </View>

      <View style={styles.panel}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Ghost Mode</Text>
            <Text style={styles.hint}>
              {ghostMode ? "You're invisible to the crew." : 'The crew can see where you are.'}
            </Text>
          </View>
          <Switch
            value={ghostMode}
            onValueChange={() => {
              dispatch(ghostModeToggled());
            }}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel="Ghost Mode"
          />
        </View>

        <View style={styles.stats}>
          <Stat
            label="Your speed"
            value={myPosition?.speedKph != null ? `${myPosition.speedKph} km/h` : '—'}
          />
          <Stat label="Sharing" value={`${others.length + (ghostMode ? 0 : 1)}`} />
          <Stat label="On the drive" value={`${participants.data?.length ?? 1}`} />
        </View>

        {permission === 'unknown' && !myPosition ? (
          <Text style={styles.hint}>Waiting for your first location reading…</Text>
        ) : null}

        {canEnd ? (
          <Button
            title="End drive for everyone"
            variant="secondary"
            onPress={handleEnd}
            loading={endConvoy.isPending}
          />
        ) : (
          <Button
            title="Leave drive"
            variant="secondary"
            onPress={handleLeave}
            loading={leaveConvoy.isPending}
          />
        )}

        <Text style={styles.hint}>
          Location updates only while this screen is open. Tracking with the app closed comes later.
        </Text>
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  centered: { justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  mapWrapper: { flex: 1, overflow: 'hidden' },
  mapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  panel: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...typography.subtitle, color: colors.text },
  title: { ...typography.subtitle, color: colors.text, textAlign: 'center' },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { ...typography.subtitle, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textMuted },
});
