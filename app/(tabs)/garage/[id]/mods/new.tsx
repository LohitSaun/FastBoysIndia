import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { ModForm } from '@/features/garage/components/ModForm';
import { useCreateModification } from '@/features/garage/hooks';

export default function AddModScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const createMod = useCreateModification(id);

  return (
    <Screen edges={['left', 'right']} avoidKeyboard style={{ padding: 0 }}>
      <ModForm
        submitLabel="Add mod"
        isSaving={createMod.isPending}
        errorMessage={createMod.isError ? "Couldn't save the mod. Please try again." : null}
        onSubmit={(input) => createMod.mutate(input, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}
