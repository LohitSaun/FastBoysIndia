import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { usePostVideo } from '@/features/feed/hooks';
import { MAX_DURATION_S, pickVideo, type PickedVideo } from '@/features/feed/upload';
import { useVehicles } from '@/features/garage/hooks';
import { useMyProfile } from '@/features/profile/hooks';
import { colors, radius, spacing, typography } from '@/theme';

const CAPTION_MAX = 150;

export default function NewPostScreen() {
  const router = useRouter();
  const profile = useMyProfile();
  const vehicles = useVehicles();
  const postVideo = usePostVideo();

  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [caption, setCaption] = useState('');
  const [vehicleId, setVehicleId] = useState<string | null>(null);

  const handlePick = async () => {
    const result = await pickVideo();

    switch (result.status) {
      case 'picked':
        setVideo(result.video);
        return;
      case 'denied':
        Alert.alert(
          'Photos access needed',
          'Allow access to your videos in your phone settings, then try again.',
        );
        return;
      case 'too-long':
        Alert.alert(
          'That clip is too long',
          `Clips are up to ${MAX_DURATION_S} seconds. Trim it in your photos app and try again.`,
        );
        return;
      case 'too-big':
        Alert.alert(
          'That file is too big',
          `It's about ${result.megabytes}MB. Clips have to stay under 60MB so they don't eat everyone's data. A shorter clip, or a lower recording quality, will do it.`,
        );
        return;
      case 'cancelled':
        return;
    }
  };

  const handlePost = () => {
    if (!video) return;

    postVideo.mutate(
      {
        video,
        caption: caption.trim() || null,
        vehicleId,
        cityId: profile.data?.home_city_id ?? null,
      },
      {
        onSuccess: () => router.back(),
        onError: () =>
          Alert.alert(
            "Couldn't post that",
            'Check your connection and try again. Nothing has been posted.',
          ),
      },
    );
  };

  const carOptions = (vehicles.data ?? []).map((vehicle) => ({
    value: vehicle.id,
    label: vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`,
  }));

  return (
    <Screen edges={['top', 'right', 'left']} style={styles.screen} avoidKeyboard>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Post a clip</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" onPress={() => void handlePick()} style={styles.picker}>
          {video ? (
            <>
              <Image source={{ uri: video.uri }} style={styles.preview} resizeMode="cover" />
              <Text style={styles.pickerText}>
                {video.durationS ? `${video.durationS}s · ` : ''}
                {Math.max(1, Math.round(video.bytes / (1024 * 1024)))}MB · tap to change
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="videocam-outline" size={40} color={colors.textMuted} />
              <Text style={styles.pickerText}>Choose a clip</Text>
              <Text style={styles.hint}>Up to {MAX_DURATION_S} seconds</Text>
            </>
          )}
        </Pressable>

        <TextField
          label="Caption (optional)"
          value={caption}
          onChangeText={setCaption}
          placeholder="Sea Link at sunrise"
          maxLength={CAPTION_MAX}
          multiline
        />

        {carOptions.length > 0 ? (
          <ChipGroup
            label="Which car? (optional)"
            options={carOptions}
            selected={vehicleId}
            onSelect={(id) => setVehicleId((current) => (current === id ? null : id))}
          />
        ) : null}

        <Button
          title="Post"
          onPress={handlePost}
          disabled={!video}
          loading={postVideo.isPending}
        />

        <Text style={styles.hint}>
          {"Anyone signed in can see this. Keep it about cars, and don't post anything filmed while driving dangerously — clips get taken down when people report them."}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  container: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.title, color: colors.text },
  picker: {
    height: 220,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  preview: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  pickerText: {
    ...typography.label,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
