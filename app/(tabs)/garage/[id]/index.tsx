import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import {
  MAX_PHOTOS_PER_VEHICLE,
  MOD_CATEGORY_LABELS,
  type Modification,
  type ModCategory,
  type VehiclePhoto,
} from '@/features/garage/api';
import {
  useAddPhoto,
  useDeletePhoto,
  useDeleteVehicle,
  useModifications,
  usePhotoUrls,
  usePhotos,
  useSetPrimaryVehicle,
  useVehicle,
} from '@/features/garage/hooks';
import { pickFromLibrary, takePhoto } from '@/features/garage/photos';
import { colors, radius, spacing, typography } from '@/theme';

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const vehicle = useVehicle(id);
  const photos = usePhotos(id);
  const photoUrls = usePhotoUrls(photos.data);
  const mods = useModifications(id);

  const addPhoto = useAddPhoto(id);
  const deletePhoto = useDeletePhoto(id);
  const deleteVehicle = useDeleteVehicle();
  const setPrimary = useSetPrimaryVehicle();

  if (vehicle.isPending) {
    return (
      <Screen edges={['left', 'right']} style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (vehicle.isError || !vehicle.data) {
    return (
      <Screen edges={['left', 'right']} style={styles.centered}>
        <Text style={styles.sectionTitle}>{"Couldn't load this car"}</Text>
        <Button title="Try again" onPress={() => vehicle.refetch()} loading={vehicle.isFetching} />
      </Screen>
    );
  }

  const car = vehicle.data;
  const title = car.nickname ?? `${car.make} ${car.model}`;
  const photoCount = photos.data?.length ?? 0;
  const photosFull = photoCount >= MAX_PHOTOS_PER_VEHICLE;

  /** Ask where the photo should come from, then upload it. */
  const handleAddPhoto = () => {
    if (photosFull) {
      Alert.alert('Photo limit reached', `A car can have up to ${MAX_PHOTOS_PER_VEHICLE} photos.`);
      return;
    }

    const upload = async (pick: typeof pickFromLibrary) => {
      const result = await pick();
      if (result.status === 'denied') {
        Alert.alert(
          'Permission needed',
          'Allow photo access in your phone settings to add pictures.',
        );
        return;
      }
      if (result.status !== 'picked') return;

      // Position 1 is the cover photo shown in the garage list.
      addPhoto.mutate({ localUri: result.uri, position: photoCount + 1 });
    };

    Alert.alert('Add photo', undefined, [
      { text: 'Choose from library', onPress: () => void upload(pickFromLibrary) },
      { text: 'Take a photo', onPress: () => void upload(takePhoto) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleDeletePhoto = (photo: VehiclePhoto) => {
    Alert.alert('Delete this photo?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePhoto.mutate(photo) },
    ]);
  };

  const handleDeleteCar = () => {
    Alert.alert(
      `Delete ${title}?`,
      'Its photos and mods will be deleted too. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteVehicle.mutate(car.id, {
              onSuccess: () => router.back(),
            }),
        },
      ],
    );
  };

  return (
    <Screen edges={['left', 'right']} style={styles.screen}>
      {/* Shows the car's name in the header bar instead of a generic title. */}
      <Stack.Screen options={{ title }} />

      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {car.is_primary ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>MAIN CAR</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.subtitle}>
            {[car.make, car.model, car.year ? String(car.year) : null].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {/* ---------------------------------------------------------- photos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <Text style={styles.sectionCount}>
              {photoCount}/{MAX_PHOTOS_PER_VEHICLE}
            </Text>
          </View>

          <FlatList
            horizontal
            data={photos.data ?? []}
            keyExtractor={(photo) => photo.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoRow}
            ListFooterComponent={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add photo"
                onPress={handleAddPhoto}
                style={[styles.photo, styles.photoAdd, photosFull && styles.photoAddDisabled]}
              >
                {addPhoto.isPending ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Ionicons name="add" size={28} color={colors.primary} />
                )}
              </Pressable>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel="Car photo. Press and hold to delete."
                onLongPress={() => handleDeletePhoto(item)}
              >
                {photoUrls.data?.[item.storage_path] ? (
                  <Image source={{ uri: photoUrls.data[item.storage_path] }} style={styles.photo} />
                ) : (
                  <View style={[styles.photo, styles.photoLoading]}>
                    <ActivityIndicator color={colors.textMuted} />
                  </View>
                )}
              </Pressable>
            )}
          />

          {addPhoto.isError ? (
            <Text style={styles.errorText}>
              {"Couldn't upload that photo. Check your connection and try again."}
            </Text>
          ) : (
            <Text style={styles.hint}>
              {photoCount > 0
                ? 'The first photo is the cover. Press and hold a photo to delete it.'
                : 'Add a photo to use as the cover in your garage.'}
            </Text>
          )}
        </View>

        {/* ------------------------------------------------------------ mods */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Modifications</Text>
            <Text style={styles.sectionCount}>{mods.data?.length ?? 0}</Text>
          </View>

          {mods.isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : mods.data && mods.data.length > 0 ? (
            <View style={styles.modList}>
              {mods.data.map((mod: Modification) => (
                <Pressable
                  key={mod.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/garage/[id]/mods/[modId]',
                      params: { id: car.id, modId: mod.id },
                    })
                  }
                  style={({ pressed }) => [styles.modRow, pressed && styles.modRowPressed]}
                >
                  <View style={styles.modBody}>
                    <Text style={styles.modTitle}>{mod.title}</Text>
                    <Text style={styles.modMeta}>
                      {[
                        MOD_CATEGORY_LABELS[mod.category as ModCategory] ?? mod.category,
                        mod.brand,
                        mod.installed_on,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>No mods yet. Stock is also a choice.</Text>
          )}

          <Button
            title="Add mod"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/garage/[id]/mods/new', params: { id: car.id } })
            }
          />
        </View>

        {/* --------------------------------------------------------- actions */}
        <View style={styles.section}>
          {!car.is_primary ? (
            <Button
              title="Make this my main car"
              variant="secondary"
              onPress={() => setPrimary.mutate(car.id)}
              loading={setPrimary.isPending}
            />
          ) : null}
          <Button
            title="Edit details"
            variant="secondary"
            onPress={() => router.push({ pathname: '/garage/[id]/edit', params: { id: car.id } })}
          />
          <Button
            title="Delete car"
            variant="secondary"
            onPress={handleDeleteCar}
            loading={deleteVehicle.isPending}
          />
        </View>
      </ScrollView>
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
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.text,
    flexShrink: 1,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
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
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  sectionCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  photoRow: {
    gap: spacing.sm,
  },
  photo: {
    width: 110,
    height: 110,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  photoLoading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoAdd: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  photoAddDisabled: {
    opacity: 0.4,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  modList: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modRowPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  modBody: {
    flex: 1,
    gap: 2,
  },
  modTitle: {
    ...typography.body,
    color: colors.text,
  },
  modMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
