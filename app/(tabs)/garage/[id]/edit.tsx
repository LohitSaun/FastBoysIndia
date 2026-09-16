import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { VehicleForm } from '@/features/garage/components/VehicleForm';
import { useUpdateVehicle, useVehicle } from '@/features/garage/hooks';
import { colors } from '@/theme';

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const vehicle = useVehicle(id);
  const updateVehicle = useUpdateVehicle(id);

  if (vehicle.isPending) {
    return (
      <Screen edges={['left', 'right']} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (vehicle.isError || !vehicle.data) {
    return (
      <Screen edges={['left', 'right']} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.text }}>{"Couldn't load this car"}</Text>
        <Button title="Try again" onPress={() => vehicle.refetch()} />
      </Screen>
    );
  }

  const car = vehicle.data;

  return (
    <Screen edges={['left', 'right']} avoidKeyboard style={{ padding: 0 }}>
      <VehicleForm
        initial={{
          make: car.make,
          model: car.model,
          year: car.year,
          nickname: car.nickname,
        }}
        submitLabel="Save changes"
        isSaving={updateVehicle.isPending}
        errorMessage={updateVehicle.isError ? "Couldn't save your changes. Please try again." : null}
        onSubmit={(input) => updateVehicle.mutate(input, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}
