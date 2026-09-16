import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useCoverPhotoUrls, useVehicles } from '@/features/garage/hooks';
import type { Vehicle } from '@/features/garage/api';
import { colors, radius, spacing, typography } from '@/theme';

/** "Rocket" if the car has a nickname, otherwise "Maruti Suzuki Swift". */
function vehicleTitle(vehicle: Vehicle): string {
  return vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`;
}

function vehicleSubtitle(vehicle: Vehicle): string {
  const parts = [vehicle.make, vehicle.model];
  if (vehicle.year) parts.push(String(vehicle.year));
  return parts.join(' · ');
}

export default function GarageScreen() {
  const router = useRouter();
  const vehicles = useVehicles();
  const covers = useCoverPhotoUrls(vehicles.data);

  if (vehicles.isPending) {
    return (
      <Screen edges={['left', 'right']} style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (vehicles.isError) {
    return (
      <Screen edges={['left', 'right']} style={styles.centered}>
        <Text style={styles.emptyTitle}>{"Couldn't load your garage"}</Text>
        <Text style={styles.emptyText}>Check your internet connection and try again.</Text>
        <Button title="Try again" onPress={() => vehicles.refetch()} loading={vehicles.isFetching} />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right']} style={styles.screen}>
      <FlatList
        data={vehicles.data}
        keyExtractor={(vehicle) => vehicle.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="car-sport-outline" size={56} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No cars yet</Text>
            <Text style={styles.emptyText}>
              Add your car, then its photos and the mods you&apos;ve done.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/garage/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            {covers.data?.[item.id] ? (
              <Image source={{ uri: covers.data[item.id] }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverEmpty]}>
                <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
              </View>
            )}

            <View style={styles.cardBody}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {vehicleTitle(item)}
                </Text>
                {item.is_primary ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>MAIN</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {vehicleSubtitle(item)}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        )}
      />

      <View style={styles.footer}>
        <Button title="Add car" onPress={() => router.push('/garage/new')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 0,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  cover: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  coverEmpty: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text,
    flexShrink: 1,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  badgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    fontSize: 11,
  },
  footer: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
});
