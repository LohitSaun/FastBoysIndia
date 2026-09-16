import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useVehicles } from '@/features/garage/hooks';
import { formatDistance, formatDuration } from '@/features/trips/grid';
import { useDeleteTrip, useEraseExploredMap, useExploredCount, useTrips } from '@/features/trips/hooks';
import { colors, radius, spacing, typography } from '@/theme';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DrivesScreen() {
  const trips = useTrips();
  const vehicles = useVehicles();
  const exploredCount = useExploredCount();
  const deleteTrip = useDeleteTrip();
  const eraseMap = useEraseExploredMap();

  const carName = (vehicleId: string | null) => {
    if (!vehicleId) return 'No car';
    const car = vehicles.data?.find((vehicle) => vehicle.id === vehicleId);
    return car ? (car.nickname ?? `${car.make} ${car.model}`) : 'Deleted car';
  };

  const handleDelete = (tripId: string) => {
    Alert.alert('Delete this drive?', 'The roads it unlocked stay unlocked.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTrip.mutate(tripId) },
    ]);
  };

  const handleErase = () => {
    Alert.alert(
      'Erase your explored map?',
      'Every unlocked square is removed. Your drives are kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase', style: 'destructive', onPress: () => eraseMap.mutate() },
      ],
    );
  };

  if (trips.isPending) {
    return (
      <Screen edges={['left', 'right']} style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right']} style={styles.screen}>
      <FlatList
        data={trips.data ?? []}
        keyExtractor={(trip) => trip.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={52} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No drives yet</Text>
            <Text style={styles.hint}>
              Record one from the Explored tab and it will show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onLongPress={() => handleDelete(item.id)}
            style={styles.card}
          >
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{formatDistance(item.distance_m)}</Text>
              <Text style={styles.cardMeta}>
                {[
                  formatWhen(item.started_at),
                  formatDuration(item.duration_s),
                  item.max_speed_kph ? `${item.max_speed_kph} km/h top` : null,
                  carName(item.vehicle_id),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          (trips.data ?? []).length > 0 ? (
            <View style={styles.footer}>
              <Text style={styles.hint}>
                {exploredCount.data ?? 0} squares unlocked. Press and hold a drive to delete it.
              </Text>
              <Button
                title="Erase explored map"
                variant="secondary"
                onPress={handleErase}
                loading={eraseMap.isPending}
              />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyTitle: { ...typography.subtitle, color: colors.text },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBody: { gap: spacing.xs },
  cardTitle: { ...typography.subtitle, color: colors.text },
  cardMeta: { ...typography.caption, color: colors.textMuted },
  footer: { gap: spacing.md, paddingTop: spacing.md },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
