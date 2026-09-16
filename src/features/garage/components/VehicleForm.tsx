import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, spacing, typography } from '@/theme';

import type { VehicleInput } from '../api';

const CURRENT_YEAR = new Date().getFullYear();
const OLDEST_YEAR = 1950;

type VehicleFormProps = {
  initial?: VehicleInput;
  submitLabel: string;
  isSaving: boolean;
  errorMessage?: string | null;
  onSubmit: (input: VehicleInput) => void;
};

/** Shared by the "Add car" and "Edit car" screens so both behave identically. */
export function VehicleForm({
  initial,
  submitLabel,
  isSaving,
  errorMessage,
  onSubmit,
}: VehicleFormProps) {
  const [make, setMake] = useState(initial?.make ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [year, setYear] = useState(initial?.year ? String(initial.year) : '');
  const [nickname, setNickname] = useState(initial?.nickname ?? '');

  const trimmedMake = make.trim();
  const trimmedModel = model.trim();
  const trimmedNickname = nickname.trim();

  // Year is optional, but if it's filled in it has to make sense.
  const yearNumber = year.trim() === '' ? null : Number(year.trim());
  const yearError =
    yearNumber !== null && (!Number.isInteger(yearNumber) || yearNumber < OLDEST_YEAR || yearNumber > CURRENT_YEAR + 1)
      ? `Use a year between ${OLDEST_YEAR} and ${CURRENT_YEAR + 1}.`
      : null;

  const canSubmit =
    trimmedMake.length > 0 && trimmedModel.length > 0 && yearError === null && !isSaving;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      make: trimmedMake,
      model: trimmedModel,
      year: yearNumber,
      nickname: trimmedNickname === '' ? null : trimmedNickname,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TextField
        label="Make"
        value={make}
        onChangeText={setMake}
        placeholder="e.g. Maruti Suzuki"
        autoCapitalize="words"
        maxLength={40}
      />
      <TextField
        label="Model"
        value={model}
        onChangeText={setModel}
        placeholder="e.g. Swift"
        autoCapitalize="words"
        maxLength={40}
      />
      <TextField
        label="Year (optional)"
        value={year}
        onChangeText={setYear}
        placeholder={`e.g. ${CURRENT_YEAR - 3}`}
        keyboardType="number-pad"
        maxLength={4}
        error={yearError}
      />
      <TextField
        label="Nickname (optional)"
        value={nickname}
        onChangeText={setNickname}
        placeholder="e.g. Rocket"
        maxLength={30}
      />

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <Button title={submitLabel} onPress={handleSubmit} disabled={!canSubmit} loading={isSaving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  errorBox: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
});
