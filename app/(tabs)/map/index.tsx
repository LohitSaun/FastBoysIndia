import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { Region } from 'react-native-maps';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useVehicles } from '@/features/garage/hooks';
import {
  useExploredCount,
  useSquaresInView,
  useTripRecorder,
  useTripStats,
} from '@/features/trips/hooks';
import { CELL_SIZE_DEG, cellCorners, formatDistance, formatDuration } from '@/features/trips/grid';
import { AppMap } from '@/services/maps/AppMap';
import { colors, radius, spacing, typography } from '@/theme';

/** Zoomed out past this, there would be too many squares to draw usefully. */
const MAX_SPAN_DEG = 0.35;

export default function ExploredMapScreen() {
  const router = useRouter();
  const [region, setRegion] = useState<Region | null>(null);
  const [simulated, setSimulated] = useState(false);

  const vehicles = useVehicles();
  const stats = useTripStats();
  const exploredCount = useExploredCount();
  const recorder = useTripRecorder({ simulated });

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

  const handleStart = () => {
    void recorder.start(mainCar?.id ?? null);
  };

  const handleStop = async () => {
    const result = await recorder.stop();
    if (result && !result.saved) {
      Alert.alert('Drive not saved', 'That drive was too short to be worth keeping.');
    }
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
          markers={
            recorder.lastPosition
              ? [
                  {
                    id: 'me',
                    latitude: recorder.lastPosition.latitude,
                    longitude: recorder.lastPosition.longitude,
                    label: 'You',
                    kind: 'me',
                  },
                ]
              : []
          }
          onRegionSettled={setRegion}
        />

        {region && region.latitudeDelta > MAX_SPAN_DEG ? (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>Zoom in to see the roads you&apos;ve unlocked</Text>
          </View>
        ) : null}
      </View>

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
