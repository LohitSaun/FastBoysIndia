import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useActiveCities, useCompleteOnboarding } from '@/features/profile/hooks';
import { colors, radius, spacing, typography } from '@/theme';

// Must match the check constraint on profiles.display_name in the database.
const NAME_MIN = 2;
const NAME_MAX = 30;

/**
 * Collects a display name and home city. Home city matters later: city leaderboards
 * (Phase 5) rank people by where they're based.
 */
export default function WelcomeScreen() {
  const cities = useActiveCities();
  const completeOnboarding = useCompleteOnboarding();
  const [displayName, setDisplayName] = useState('');
  const [homeCityId, setHomeCityId] = useState<string | null>(null);

  const trimmedName = displayName.trim();
  const nameError =
    trimmedName.length > 0 && trimmedName.length < NAME_MIN
      ? `Use at least ${NAME_MIN} characters.`
      : null;
  const canSubmit = trimmedName.length >= NAME_MIN && homeCityId !== null;

  const handleSubmit = () => {
    if (!canSubmit || !homeCityId) return;
    // No onSuccess navigation: once the profile is complete, the root layout shows the tabs.
    completeOnboarding.mutate({ displayName: trimmedName, homeCityId });
  };

  return (
    <Screen avoidKeyboard style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to the crew</Text>
          <Text style={styles.subtitle}>{"Two quick things and you're in."}</Text>
        </View>

        <TextField
          label="What should people call you?"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="e.g. Arjun"
          autoCapitalize="words"
          autoComplete="name"
          maxLength={NAME_MAX}
          error={nameError}
        />

        <View style={styles.section}>
          <Text style={styles.label}>Home city</Text>

          {cities.isPending ? (
            <ActivityIndicator color={colors.primary} style={styles.cityLoading} />
          ) : cities.isError ? (
            <View style={styles.cityError}>
              <Text style={styles.errorText}>{"Couldn't load cities."}</Text>
              <Button title="Try again" variant="secondary" onPress={() => cities.refetch()} />
            </View>
          ) : (
            <View style={styles.cityList}>
              {cities.data.map((city) => {
                const selected = city.id === homeCityId;
                return (
                  <Pressable
                    key={city.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setHomeCityId(city.id)}
                    style={[styles.cityChip, selected && styles.cityChipSelected]}
                  >
                    <Text style={[styles.cityText, selected && styles.cityTextSelected]}>
                      {city.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {completeOnboarding.isError ? (
          <Text style={styles.errorText}>{"Couldn't save your profile. Please try again."}</Text>
        ) : null}

        <Button
          title="Let's go"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={completeOnboarding.isPending}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    // The ScrollView handles padding so content can scroll edge to edge.
    padding: 0,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  section: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
  },
  cityLoading: {
    alignSelf: 'flex-start',
    marginVertical: spacing.md,
  },
  cityError: {
    gap: spacing.sm,
  },
  cityList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cityChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cityChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceRaised,
  },
  cityText: {
    ...typography.body,
    color: colors.text,
  },
  cityTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
});
