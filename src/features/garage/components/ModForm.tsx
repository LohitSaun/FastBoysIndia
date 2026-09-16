import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { TextField } from '@/components/TextField';
import { colors, spacing, typography } from '@/theme';

import { MOD_CATEGORIES, MOD_CATEGORY_LABELS, type ModCategory, type ModificationInput } from '../api';

const CATEGORY_OPTIONS = MOD_CATEGORIES.map((category) => ({
  value: category,
  label: MOD_CATEGORY_LABELS[category],
}));

/** Accepts an empty date, or a real calendar date written as YYYY-MM-DD. */
function validateDate(value: string): string | null {
  if (value.trim() === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return 'Use the format YYYY-MM-DD, e.g. 2026-03-15.';
  const date = new Date(`${value.trim()}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "That date doesn't exist.";
  return null;
}

type ModFormProps = {
  initial?: ModificationInput;
  submitLabel: string;
  isSaving: boolean;
  errorMessage?: string | null;
  onSubmit: (input: ModificationInput) => void;
};

export function ModForm({ initial, submitLabel, isSaving, errorMessage, onSubmit }: ModFormProps) {
  const [category, setCategory] = useState<ModCategory | null>(initial?.category ?? null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [installedOn, setInstalledOn] = useState(initial?.installed_on ?? '');

  const trimmedTitle = title.trim();
  const dateError = validateDate(installedOn);
  const canSubmit = category !== null && trimmedTitle.length > 0 && dateError === null && !isSaving;

  const handleSubmit = () => {
    if (!canSubmit || category === null) return;
    onSubmit({
      category,
      title: trimmedTitle,
      brand: brand.trim() === '' ? null : brand.trim(),
      notes: notes.trim() === '' ? null : notes.trim(),
      installed_on: installedOn.trim() === '' ? null : installedOn.trim(),
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ChipGroup label="Category" options={CATEGORY_OPTIONS} selected={category} onSelect={setCategory} />

      <TextField
        label="What is it?"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Cold air intake"
        maxLength={60}
      />
      <TextField
        label="Brand (optional)"
        value={brand}
        onChangeText={setBrand}
        placeholder="e.g. K&N"
        maxLength={40}
      />
      <TextField
        label="Fitted on (optional)"
        value={installedOn}
        onChangeText={setInstalledOn}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        error={dateError}
      />
      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything worth remembering: cost, shop, settings…"
        multiline
        numberOfLines={4}
        maxLength={500}
        style={styles.notes}
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
  notes: {
    minHeight: 96,
    textAlignVertical: 'top',
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
