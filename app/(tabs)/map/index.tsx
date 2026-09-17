import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { Region } from 'react-native-maps';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useVehicles } from '@/features/garage/hooks';
import {
  HAZARD_KINDS,
  HAZARD_LABELS,
  type HazardKind,
  type NearbyHazard,
} from '@/features/hazards/api';
import {
  useCameraWarning,
  useHazardsNear,
  useReportHazard,
  useTier,
  useVoteHazard,
} from '@/features/hazards/hooks';
import { SosButton } from '@/features/sos/components/SosButton';
import {
  useExploredCount,
  usePendingTrips,
  useSquaresInView,
  useTripRecorder,
  useTripStats,
} from '@/features/trips/hooks';
import { CELL_SIZE_DEG, cellCorners, formatDistance, formatDuration } from '@/features/trips/grid';
import { trackerFor } from '@/services/location';
import { AppMap, type AppMapMarker } from '@/services/maps/AppMap';
import { colors, radius, spacing, typography } from '@/theme';

/** Zoomed out past this, there would be too many squares to draw usefully. */
const MAX_SPAN_DEG = 0.35;

/**
 * "20 min ago", "3 h ago", "2 days ago".
 *
 * Deliberately outside the component: it reads the clock, and React expects
 * anything called while rendering to give the same answer every time.
 */
function describeAge(createdAt: string): string {
  const minutes = Math.round((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / (60 * 24))} days ago`;
}

export default function ExploredMapScreen() {
  const router = useRouter();
  const [region, setRegion] = useState<Region | null>(null);
  const [simulated, setSimulated] = useState(false);

  const vehicles = useVehicles();
  const stats = useTripStats();
  const exploredCount = useExploredCount();
  const recorder = useTripRecorder({ simulated });
  const pending = usePendingTrips();

  const tier = useTier();
  const isSubscriber = tier.data === 'pro' || tier.data === 'premium';

  // Hazards around wherever the map is looking, or around you while driving.
  const hazardCentre = recorder.lastPosition
    ? { latitude: recorder.lastPosition.latitude, longitude: recorder.lastPosition.longitude }
    : region
      ? { latitude: region.latitude, longitude: region.longitude }
      : null;
  const hazards = useHazardsNear(hazardCentre);
  const reportHazard = useReportHazard();
  const voteHazard = useVoteHazard();

  // The paid extra: a warning when a speed camera is coming up.
  const cameraWarning = useCameraWarning(
    recorder.lastPosition,
    hazards.data,
    isSubscriber && recorder.status === 'recording',
  );

  const mainCar = vehicles.data?.find((vehicle) => vehicle.is_primary) ?? vehicles.data?.[0] ?? null;

  // Which squares to ask for: the ones inside the visible part of the map.
  const bounds = useMemo(() => {
    if (!region || region.latitudeDelta > MAX_SPAN_DEG) return null;
    const halfLat = region.latitudeDelta / 2;
    const halfLng = region.longitudeDelta / 2;
    return {
      minX: Math.floor((region.latitude - halfLat) / CELL_SIZE_DEG),
      maxX: Math.floor((region.latitude + halfLat) / CELL_SIZE_DEG),
      minY: Math.floor((region.longitude - halfLng) / CELL_SIZE_DEG),
      maxY: Math.floor((region.longitude + halfLng) / CELL_SIZE_DEG),
    };
  }, [region]);

  const squares = useSquaresInView(bounds);
  const exploredShapes = useMemo(
    () => (squares.data ?? []).map((cell) => cellCorners(cell)),
    [squares.data],
  );

  const isRecording = recorder.status === 'recording';

  /** Tapping a pin: what it is, how old, and the chance to vote on it. */
  const showHazard = (hazard: NearbyHazard) => {
    Alert.alert(
      HAZARD_LABELS[hazard.kind],
      [
        hazard.note,
        `Reported ${describeAge(hazard.created_at)}`,
        hazard.gone_votes > 0 ? `${hazard.gone_votes} said it's gone` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      [
        { text: 'Close', style: 'cancel' },
        {
          text: "It's gone",
          onPress: () => voteHazard.mutate({ hazardId: hazard.id, vote: 'gone' }),
        },
        {
          text: 'Still there',
          onPress: () => voteHazard.mutate({ hazardId: hazard.id, vote: 'still_there' }),
        },
      ],
    );
  };

  /** Report something at wherever the phone currently is. */
  const handleReport = () => {
    const kindButtons = HAZARD_KINDS.filter(
      // Cameras are only worth reporting by people who can see them.
      (kind) => kind !== 'speed_camera' || isSubscriber,
    ).map((kind) => ({
      text: HAZARD_LABELS[kind],
      onPress: () => void submitReport(kind),
    }));

    Alert.alert('Report what you see', 'It stays anonymous.', [
      ...kindButtons,
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const submitReport = async (kind: HazardKind) => {
    const tracker = trackerFor(simulated);
    const permission = await tracker.requestPermission();
    if (permission !== 'granted') {
      Alert.alert('Location needed', 'Allow location so the report lands in the right place.');
      return;
    }

    const position = recorder.lastPosition ?? (await tracker.current());
    if (!position) {
      Alert.alert('No location yet', 'Wait a moment for a location reading and try again.');
      return;
    }

    reportHazard.mutate(
      { kind, latitude: position.latitude, longitude: position.longitude, note: null },
      { onSuccess: () => Alert.alert('Thanks', 'Other drivers will see it.') },
    );
  };

  const handleStart = () => {
    void recorder.start(mainCar?.id ?? null);
  };

  const handleStop = async () => {
    const result = await recorder.stop();
    if (!result || result.saved) return;

    if (result.reason === 'too-short') {
      Alert.alert('Drive not saved', 'That drive was too short to be worth keeping.');
      return;
    }
    Alert.alert(
      'Saved on your phone',
      "Couldn't reach the server, so the drive is waiting here. It uploads by itself next time you have signal.",
    );
  };

  /** A drive the app has given up retrying. Never deleted without asking. */
  const handleStuck = (id: string) => {
    Alert.alert(
      'This drive keeps failing',
      'It has been tried several times and the server keeps refusing it. Try once more, or throw it away.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Try again', onPress: () => pending.retry() },
        { text: 'Discard', style: 'destructive', onPress: () => pending.discard(id) },
      ],
    );
  };

  return (
    <Screen edges={['left', 'right']} style={styles.screen}>
      <View style={styles.mapWrapper}>
        <AppMap
          exploredShapes={exploredShapes}
          initialCenter={
            recorder.lastPosition
              ? { latitude: recorder.lastPosition.latitude, longitude: recorder.lastPosition.longitude }
              : null
          }
          markers={[
            ...(recorder.lastPosition
              ? [
                  {
                    id: 'me',
                    latitude: recorder.lastPosition.latitude,
                    longitude: recorder.lastPosition.longitude,
                    label: 'You',
                    kind: 'me' as const,
                  },
                ]
              : []),
            ...(hazards.data ?? []).map(
              (hazard): AppMapMarker => ({
                id: hazard.id,
                latitude: hazard.latitude,
                longitude: hazard.longitude,
                label: HAZARD_LABELS[hazard.kind],
                kind: 'other',
                tint: hazard.kind === 'speed_camera' ? '#4DA3FF' : '#FFC107',
                onPress: () => showHazard(hazard),
              }),
            ),
          ]}
          onRegionSettled={setRegion}
        />

        {region && region.latitudeDelta > MAX_SPAN_DEG ? (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>Zoom in to see the roads you&apos;ve unlocked</Text>
          </View>
        ) : null}
      </View>

      {cameraWarning ? (
        <View style={styles.warningBanner}>
          <Ionicons name="camera" size={18} color={colors.onPrimary} />
          <Text style={styles.warningBannerText}>
            Speed camera in {cameraWarning.metres}m — check your speed
          </Text>
        </View>
      ) : null}

      <View style={styles.panel}>
        {isRecording ? (
          <View style={styles.liveRow}>
            <Live label="Distance" value={formatDistance(recorder.distanceM)} />
            <Live label="Time" value={formatDuration(recorder.durationS)} />
            <Live label="Top speed" value={`${recorder.maxSpeedKph} km/h`} />
            <Live label="New squares" value={`${recorder.newSquares}`} />
          </View>
        ) : (
          <View style={styles.liveRow}>
            <Live label="Drives" value={`${stats.data?.trips ?? 0}`} />
            <Live label="Distance" value={formatDistance(stats.data?.total_distance_m ?? 0)} />
            <Live label="Time" value={formatDuration(stats.data?.total_duration_s ?? 0)} />
            <Live label="Explored" value={`${exploredCount.data ?? 0}`} />
          </View>
        )}

        {recorder.permission === 'denied' ? (
          <Text style={styles.warning}>
            Location is off. Allow it for Expo Go in your phone settings, then try again.
          </Text>
        ) : null}

        {recorder.saveFailed ? (
          <Text style={styles.warning}>{"Couldn't save that drive. Please try again."}</Text>
        ) : null}

        {isRecording ? (
          <Button title="Stop and save" onPress={handleStop} loading={recorder.isSaving} />
        ) : (
          <Button
            title={mainCar ? `Record a drive in your ${mainCar.model}` : 'Record a drive'}
            onPress={handleStart}
            loading={recorder.status === 'starting' || recorder.isSaving}
          />
        )}

        <View style={styles.reportRow}>
          <Button title="Report a hazard" variant="secondary" onPress={handleReport} />
          {!isSubscriber ? (
            <Text style={styles.hint}>
              Speed camera alerts while you drive are part of Pro.
            </Text>
          ) : null}
        </View>

        {pending.count > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              pending.stuck[0] ? handleStuck(pending.stuck[0].id) : pending.retry()
            }
            style={styles.pendingRow}
          >
            <Ionicons
              name={pending.stuck.length > 0 ? 'alert-circle' : 'cloud-upload-outline'}
              size={18}
              color={pending.stuck.length > 0 ? colors.danger : colors.primary}
            />
            <Text style={styles.pendingText}>
              {pending.stuck.length > 0
                ? `${pending.stuck.length} drive${pending.stuck.length > 1 ? 's' : ''} won't upload. Tap to sort it out.`
                : `${pending.count} drive${pending.count > 1 ? 's' : ''} waiting to upload${pending.isRetrying ? '…' : '. Tap to retry.'}`}
            </Text>
          </Pressable>
        ) : null}

        <SosButton knownPosition={recorder.lastPosition} />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/map/drives')}
          style={styles.link}
        >
          <Ionicons name="list-outline" size={16} color={colors.primary} />
          <Text style={styles.linkText}>See your drives</Text>
        </Pressable>

        {__DEV__ ? (
          <View style={styles.devRow}>
            <View style={styles.devText}>
              <Text style={styles.devTitle}>Simulate a Mumbai drive</Text>
              <Text style={styles.hint}>
                Testing only. Replays Bandra to Worli instead of using real GPS.
              </Text>
            </View>
            <Switch
              value={simulated}
              onValueChange={(next) => {
                setSimulated(next);
              }}
              disabled={isRecording}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel="Simulate a Mumbai drive"
            />
          </View>
        ) : null}

        <Text style={styles.hint}>
          Recording only works while this screen is open. Tracking with the app closed comes later.
        </Text>
      </View>
    </Screen>
  );
}

function Live({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.live}>
      <Text style={styles.liveValue}>{value}</Text>
      <Text style={styles.liveLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  mapWrapper: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(11, 11, 15, 0.8)',
  },
  overlayText: { ...typography.caption, color: colors.text, textAlign: 'center' },
  panel: {
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  liveRow: { flexDirection: 'row', gap: spacing.sm },
  live: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 2,
  },
  liveValue: { ...typography.body, color: colors.text, fontWeight: '700' },
  liveLabel: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'center' },
  reportRow: { gap: spacing.xs },
  warningBanner: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  warningBannerText: { ...typography.label, color: colors.onPrimary },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pendingText: { ...typography.caption, color: colors.text, flex: 1 },
  linkText: { ...typography.label, color: colors.primary },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  devText: { flex: 1, gap: 2 },
  devTitle: { ...typography.label, color: colors.text },
  warning: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
