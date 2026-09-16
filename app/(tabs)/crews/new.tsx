import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useCreateCrew } from '@/features/crews/hooks';
import { useActiveCities } from '@/features/profile/hooks';
import { colors, spacing, typography } from '@/theme';

const NAME_MIN = 2;
const NAME_MAX = 40;

export default function CreateCrewScreen() {
  const router = useRouter();
  const cities = useActiveCities();
  const createCrew = useCreateCrew();

  const [name, setName] = useState('');
  const [cityId, setCityId] = useState<string | null>(null);

  const trimmedName = name.trim();
  const nameError =
    trimmedName.length > 0 && trimmedName.length < NAME_MIN
      ? `Use at least ${NAME_MIN} characters.`
      : null;
  const canSubmit = trimmedName.length >= NAME_MIN && cityId !== null && !createCrew.isPending;

  const handleSubmit = () => {
    if (!canSubmit || !cityId) return;
    createCrew.mutate(
      { name: trimmedName, city_id: cityId },
      { onSuccess: (crew) => router.replace({ pathname: '/crews/[id]', params: { id: crew.id } }) },
    );
  };

  return (
    <Screen edges={['left', 'right']} avoidKeyboard style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField
          label="Crew name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Mumbai Night Runs"
          maxLength={NAME_MAX}
          error={nameError}
          autoFocus
        />

        {cities.isPending ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <ChipGroup
            label="City"
            options={(cities.data ?? []).map((city) => ({ value: city.id, label: city.name }))}
            selected={cityId}
            onSelect={setCityId}
          />
        )}

        {createCrew.isError ? (
          <Text style={styles.error}>{"Couldn't create the crew. Please try again."}</Text>
        ) : null}

        <Button
          title="Create crew"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={createCrew.isPending}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  content: { padding: spacing.lg, gap: spacing.lg },
  error: { ...typography.caption, color: colors.danger },
});
