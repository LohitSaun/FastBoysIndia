import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import type { ModCategory } from '@/features/garage/api';
import { ModForm } from '@/features/garage/components/ModForm';
import {
  useDeleteModification,
  useModification,
  useUpdateModification,
} from '@/features/garage/hooks';
import { colors, spacing } from '@/theme';

export default function EditModScreen() {
  const { id, modId } = useLocalSearchParams<{ id: string; modId: string }>();
  const router = useRouter();

  const mod = useModification(modId);
  const updateMod = useUpdateModification(id, modId);
  const deleteMod = useDeleteModification(id);

  if (mod.isPending) {
    return (
      <Screen edges={['left', 'right']} style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (mod.isError || !mod.data) {
    return (
      <Screen edges={['left', 'right']} style={styles.centered}>
        <Text style={styles.message}>{"Couldn't load this mod"}</Text>
        <Button title="Try again" onPress={() => mod.refetch()} />
      </Screen>
    );
  }

  const handleDelete = () => {
    Alert.alert(`Delete "${mod.data.title}"?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMod.mutate(modId, { onSuccess: () => router.back() }),
      },
    ]);
  };

  return (
    <Screen edges={['left', 'right']} avoidKeyboard style={styles.screen}>
      <ModForm
        initial={{
          category: mod.data.category as ModCategory,
          title: mod.data.title,
          brand: mod.data.brand,
          notes: mod.data.notes,
          installed_on: mod.data.installed_on,
        }}
        submitLabel="Save changes"
        isSaving={updateMod.isPending}
        errorMessage={updateMod.isError ? "Couldn't save your changes. Please try again." : null}
        onSubmit={(input) => updateMod.mutate(input, { onSuccess: () => router.back() })}
      />

      <View style={styles.footer}>
        <Button
          title="Delete mod"
          variant="secondary"
          onPress={handleDelete}
          loading={deleteMod.isPending}
        />
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
  message: {
    color: colors.text,
  },
  footer: {
    padding: spacing.lg,
    paddingTop: 0,
  },
});
