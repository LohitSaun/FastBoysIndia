import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { VehicleForm } from '@/features/garage/components/VehicleForm';
import { useCreateVehicle } from '@/features/garage/hooks';

export default function AddVehicleScreen() {
  const router = useRouter();
  const createVehicle = useCreateVehicle();

  return (
    <Screen edges={['left', 'right']} avoidKeyboard style={{ padding: 0 }}>
      <VehicleForm
        submitLabel="Add car"
        isSaving={createVehicle.isPending}
        errorMessage={createVehicle.isError ? "Couldn't save the car. Please try again." : null}
        onSubmit={(input) =>
          createVehicle.mutate(input, {
            // Straight to the new car, so the next step (photos) is obvious.
            onSuccess: (vehicle) =>
              router.replace({ pathname: '/garage/[id]', params: { id: vehicle.id } }),
          })
        }
      />
    </Screen>
  );
}
