/**
 * TanStack Query hooks for the garage.
 *
 * Reads are queries (cached), changes are mutations. After a change we
 * invalidate the affected queries so the screens refresh themselves.
 */
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectUserId } from '@/features/auth/authSlice';
import { analytics } from '@/services/monitoring/analytics';
import { useAppSelector } from '@/store';

import {
  createModification,
  createPhotoRow,
  createSignedUrls,
  createVehicle,
  deleteModification,
  deletePhotoFiles,
  deletePhotoRow,
  deleteVehicle,
  resequencePhotos,
  fetchCoverPhotos,
  fetchModification,
  fetchModifications,
  fetchPhotos,
  fetchVehicle,
  fetchVehicles,
  setPrimaryVehicle,
  updateModification,
  updateVehicle,
  type ModificationInput,
  type Vehicle,
  type VehicleInput,
  type VehiclePhoto,
} from './api';
import { uploadVehiclePhoto } from './photos';

export const garageKeys = {
  vehicles: ['vehicles'] as const,
  vehicle: (vehicleId: string) => ['vehicle', vehicleId] as const,
  photos: (vehicleId: string) => ['vehicle-photos', vehicleId] as const,
  photoUrls: (storagePaths: string[]) => ['vehicle-photo-urls', ...storagePaths] as const,
  mods: (vehicleId: string) => ['modifications', vehicleId] as const,
  mod: (modId: string) => ['modification', modId] as const,
};

function logInDev(error: unknown) {
  if (__DEV__) console.warn('[garage]', error);
}

// ---------------------------------------------------------------- vehicles --

export function useVehicles() {
  return useQuery({ queryKey: garageKeys.vehicles, queryFn: fetchVehicles });
}

export function useVehicle(vehicleId: string | undefined) {
  return useQuery({
    queryKey: garageKeys.vehicle(vehicleId ?? 'none'),
    queryFn: vehicleId ? () => fetchVehicle(vehicleId) : skipToken,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  const userId = useAppSelector(selectUserId);

  return useMutation({
    mutationFn: (input: VehicleInput) => {
      if (!userId) throw new Error('Not signed in');
      return createVehicle(userId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: garageKeys.vehicles });
      analytics.track('vehicle_added');
    },
    onError: logInDev,
  });
}

export function useUpdateVehicle(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: VehicleInput) => updateVehicle(vehicleId, input),
    onSuccess: (vehicle) => {
      queryClient.setQueryData(garageKeys.vehicle(vehicleId), vehicle);
      queryClient.invalidateQueries({ queryKey: garageKeys.vehicles });
    },
    onError: logInDev,
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vehicleId: string) => {
      // Delete the image files first. The database removes the photo rows and
      // mods by itself when the car goes, but it knows nothing about storage.
      const photos = await fetchPhotos(vehicleId);
      await deletePhotoFiles(photos.map((photo) => photo.storage_path));
      await deleteVehicle(vehicleId);
    },
    onSuccess: (_result, vehicleId) => {
      queryClient.removeQueries({ queryKey: garageKeys.vehicle(vehicleId) });
      queryClient.removeQueries({ queryKey: garageKeys.photos(vehicleId) });
      queryClient.removeQueries({ queryKey: garageKeys.mods(vehicleId) });
      queryClient.invalidateQueries({ queryKey: garageKeys.vehicles });
    },
    onError: logInDev,
  });
}

export function useSetPrimaryVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vehicleId: string) => setPrimaryVehicle(vehicleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: garageKeys.vehicles }),
    onError: logInDev,
  });
}

// ------------------------------------------------------------------ photos --

export function usePhotos(vehicleId: string | undefined) {
  return useQuery({
    queryKey: garageKeys.photos(vehicleId ?? 'none'),
    queryFn: vehicleId ? () => fetchPhotos(vehicleId) : skipToken,
  });
}

/**
 * Turns stored file paths into temporary links the app can display.
 * The links last an hour; we refresh them after 50 minutes.
 */
export function usePhotoUrls(photos: VehiclePhoto[] | undefined) {
  const paths = (photos ?? []).map((photo) => photo.storage_path);

  return useQuery({
    queryKey: garageKeys.photoUrls(paths),
    queryFn: paths.length > 0 ? () => createSignedUrls(paths) : skipToken,
    staleTime: 50 * 60 * 1000,
  });
}

export function useAddPhoto(vehicleId: string) {
  const queryClient = useQueryClient();
  const userId = useAppSelector(selectUserId);

  return useMutation({
    mutationFn: async ({ localUri, position }: { localUri: string; position: number }) => {
      if (!userId) throw new Error('Not signed in');
      const storagePath = await uploadVehiclePhoto(userId, vehicleId, localUri);
      return createPhotoRow(vehicleId, storagePath, position);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: garageKeys.photos(vehicleId) });
      analytics.track('photo_added');
    },
    onError: logInDev,
  });
}

export function useDeletePhoto(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (photo: VehiclePhoto) => {
      await deletePhotoRow(photo.id);
      await deletePhotoFiles([photo.storage_path]);
      // Keep the remaining photos numbered 1..n so the cover photo still exists.
      await resequencePhotos(vehicleId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: garageKeys.photos(vehicleId) }),
    onError: logInDev,
  });
}

/** Cover photo links for the garage list, keyed by car id. */
export function useCoverPhotoUrls(vehicles: Vehicle[] | undefined) {
  const vehicleIds = (vehicles ?? []).map((vehicle) => vehicle.id);

  return useQuery({
    queryKey: ['vehicle-covers', ...vehicleIds] as const,
    queryFn:
      vehicleIds.length > 0
        ? async () => {
            const coverPaths = await fetchCoverPhotos(vehicleIds);
            const urls = await createSignedUrls(Object.values(coverPaths));

            const byVehicle: Record<string, string> = {};
            for (const [vehicleId, path] of Object.entries(coverPaths)) {
              const url = urls[path];
              if (url) byVehicle[vehicleId] = url;
            }
            return byVehicle;
          }
        : skipToken,
    staleTime: 50 * 60 * 1000,
  });
}

// -------------------------------------------------------------------- mods --

export function useModifications(vehicleId: string | undefined) {
  return useQuery({
    queryKey: garageKeys.mods(vehicleId ?? 'none'),
    queryFn: vehicleId ? () => fetchModifications(vehicleId) : skipToken,
  });
}

export function useModification(modId: string | undefined) {
  return useQuery({
    queryKey: garageKeys.mod(modId ?? 'none'),
    queryFn: modId ? () => fetchModification(modId) : skipToken,
  });
}

export function useCreateModification(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ModificationInput) => createModification(vehicleId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: garageKeys.mods(vehicleId) });
      analytics.track('mod_added');
    },
    onError: logInDev,
  });
}

export function useUpdateModification(vehicleId: string, modId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ModificationInput) => updateModification(modId, input),
    onSuccess: (mod) => {
      queryClient.setQueryData(garageKeys.mod(modId), mod);
      queryClient.invalidateQueries({ queryKey: garageKeys.mods(vehicleId) });
    },
    onError: logInDev,
  });
}

export function useDeleteModification(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (modId: string) => deleteModification(modId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: garageKeys.mods(vehicleId) }),
    onError: logInDev,
  });
}
