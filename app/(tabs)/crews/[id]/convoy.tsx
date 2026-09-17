import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { selectUserId } from '@/features/auth/authSlice';
import { BREAKDOWN_REASONS, type BreakdownAlert } from '@/features/breakdowns/api';
import { useConvoyBreakdowns, useNearestBreakdown } from '@/features/breakdowns/hooks';
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
import { SosButton } from '@/features/sos/components/SosButton';
import { distanceBetween, formatDistance } from '@/features/trips/grid';
import { locationTracker } from '@/services/location';
import { AppMap, type AppMapMarker } from '@/services/maps/AppMap';
import { useAppDispatch, useAppSelector } from '@/store';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * "just now", "12 min ago", "2 h ago".
 *
 * Outside the component on purpose: it reads the clock, and React expects
 * anything called while rendering to give the same answer every time.
 */
function describeAge(createdAt: string): string {
  const minutes = Math.round((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

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

  const breakdowns = useConvoyBreakdowns(convoy.data?.id);
  const nearest = useNearestBreakdown(myPosition, breakdowns.alerts);

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
    // Drawn last so a stopped car sits on top of its own fading position dot.
    ...breakdowns.alerts.map((alert) => ({
      id: `breakdown-${alert.id}`,
      latitude: alert.latitude,
      longitude: alert.longitude,
      label: `${alert.isYou ? 'You' : (alert.displayName ?? 'Someone')} — broken down`,
      kind: 'other' as const,
      tint: colors.danger,
      onPress: () => showBreakdown(alert),
    })),
  ];

  /** Tapping a red pin: who it is, what's wrong, and how long they've waited. */
  function showBreakdown(alert: BreakdownAlert) {
    const distance =
      myPosition && !alert.isYou
        ? `${formatDistance(Math.round(distanceBetween(myPosition, alert)))} away`
        : null;

    Alert.alert(
      alert.isYou ? "You've broken down" : `${alert.displayName ?? 'Someone'} has broken down`,
      [alert.note, distance, `Reported ${describeAge(alert.createdAt)}`]
        .filter(Boolean)
        .join('\n'),
      alert.isYou
        ? [
            { text: 'Close', style: 'cancel' },
            { text: "I'm sorted", onPress: () => breakdowns.resolve.mutate(alert.id) },
          ]
        : [{ text: 'Close', style: 'cancel' }],
    );
  }

  /**
   * Reporting a breakdown. The confirm text says out loud that this shares your
   * location even in Ghost Mode, because an alert without a position is no use
   * to anyone and nobody should be surprised by it.
   */
  const handleBreakdown = () => {
    const submit = async (note: string | null) => {
      const position = myPosition ?? (await locationTracker.current());
      if (!position) {
        Alert.alert(
          "Can't tell where you are",
          'Allow location for the app, then try again. Ring someone in the crew in the meantime.',
        );
        return;
      }
      breakdowns.report.mutate({
        latitude: position.latitude,
        longitude: position.longitude,
        note,
      });
    };

    Alert.alert(
      "Tell the crew you've broken down?",
      ghostMode
        ? "They'll see exactly where you are, even with Ghost Mode on."
        : "They'll see exactly where you are. What's wrong?",
      [
        ...BREAKDOWN_REASONS.map((reason) => ({
          text: reason,
          onPress: () => {
            void submit(reason);
          },
        })),
        {
          text: "Don't say",
          onPress: () => {
            void submit(null);
          },
        },
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

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

      {nearest ? (
        <View style={styles.alertBanner}>
          <Ionicons name="warning" size={18} color={colors.text} />
          <Text style={styles.alertBannerText} numberOfLines={2}>
            {`${nearest.alert.displayName ?? 'Someone'} has broken down — ${formatDistance(Math.round(nearest.metres))} away`}
            {nearest.alert.note ? ` (${nearest.alert.note})` : ''}
          </Text>
        </View>
      ) : null}

      <View style={styles.panel}>
        {breakdowns.mine ? (
          <View style={styles.strandedRow}>
            <Text style={styles.strandedText}>
              The crew knows you&apos;ve broken down.
              {breakdowns.mine.note ? ` (${breakdowns.mine.note})` : ''}
            </Text>
            <Button
              title="I'm sorted"
              onPress={() => breakdowns.resolve.mutate(breakdowns.mine?.id ?? '')}
              loading={breakdowns.resolve.isPending}
            />
          </View>
        ) : null}

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

        {breakdowns.mine ? null : (
          <Button
            title="I've broken down"
            variant="secondary"
            onPress={handleBreakdown}
            loading={breakdowns.report.isPending}
          />
        )}

        {breakdowns.report.isError ? (
          <Text style={styles.warning}>
            {"Couldn't tell the crew. Check your signal and try again."}
          </Text>
        ) : null}

        <SosButton knownPosition={myPosition} />

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
  alertBanner: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
  },
  alertBannerText: { ...typography.label, color: colors.text, flex: 1 },
  strandedRow: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  strandedText: { ...typography.label, color: colors.text },
  warning: { ...typography.caption, color: colors.danger, textAlign: 'center' },
});
