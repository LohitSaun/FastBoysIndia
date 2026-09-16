/**
 * Garage data: cars, their photos and their modifications.
 *
 * Screens don't call these directly; they use the hooks in ./hooks.ts.
 *
 * Security note: none of these queries filter by owner. They don't need to.
 * The database's Row Level Security only ever returns or accepts rows that
 * belong to the signed-in user (see supabase/migrations/*_garage.sql).
 */
import { supabase } from '@/services/supabase/client';
import type { Tables } from '@/types/database';

export type Vehicle = Tables<'vehicles'>;
export type VehiclePhoto = Tables<'vehicle_photos'>;
export type Modification = Tables<'modifications'>;

/** Must match the category check constraint in the database. */
export const MOD_CATEGORIES = [
  'intake',
  'exhaust',
  'suspension',
  'wheels',
  'tyres',
  'brakes',
  'tune',
  'interior',
  'exterior',
  'other',
] as const;

export type ModCategory = (typeof MOD_CATEGORIES)[number];

/** Friendly labels for the category chips. */
export const MOD_CATEGORY_LABELS: Record<ModCategory, string> = {
  intake: 'Intake',
  exhaust: 'Exhaust',
  suspension: 'Suspension',
  wheels: 'Wheels',
  tyres: 'Tyres',
  brakes: 'Brakes',
  tune: 'Tune',
  interior: 'Interior',
  exterior: 'Exterior',
  other: 'Other',
};

export const PHOTO_BUCKET = 'vehicle-photos';
export const MAX_PHOTOS_PER_VEHICLE = 10;

// ---------------------------------------------------------------- vehicles --

export async function fetchVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    // Main car first, then newest.
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchVehicle(vehicleId: string): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', vehicleId)
    .single();
  if (error) throw error;
  return data;
}

export type VehicleInput = {
  make: string;
  model: string;
  year: number | null;
  nickname: string | null;
};

export async function createVehicle(ownerId: string, input: VehicleInput): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({ owner_id: ownerId, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateVehicle(vehicleId: string, input: VehicleInput): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .update(input)
    .eq('id', vehicleId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Deleting a car also deletes its photo rows and mods, because the database
 * columns are declared "on delete cascade". The image files are removed
 * separately in hooks.ts, since storage isn't part of the database.
 */
export async function deleteVehicle(vehicleId: string): Promise<void> {
  const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId);
  if (error) throw error;
}

/**
 * Switching the main car. This runs a small database function so that clearing
 * the old main car and setting the new one happen together.
 */
export async function setPrimaryVehicle(vehicleId: string): Promise<void> {
  const { error } = await supabase.rpc('set_primary_vehicle', { target_vehicle_id: vehicleId });
  if (error) throw error;
}

// ------------------------------------------------------------------ photos --

export async function fetchPhotos(vehicleId: string): Promise<VehiclePhoto[]> {
  const { data, error } = await supabase
    .from('vehicle_photos')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('position');
  if (error) throw error;
  return data;
}

export async function createPhotoRow(
  vehicleId: string,
  storagePath: string,
  position: number,
): Promise<VehiclePhoto> {
  const { data, error } = await supabase
    .from('vehicle_photos')
    .insert({ vehicle_id: vehicleId, storage_path: storagePath, position })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deletePhotoRow(photoId: string): Promise<void> {
  const { error } = await supabase.from('vehicle_photos').delete().eq('id', photoId);
  if (error) throw error;
}

/**
 * Closes gaps after a photo is deleted, so the remaining photos stay numbered
 * 1, 2, 3... Without this, deleting the first photo would leave a car with no
 * position 1, and the garage list would show no cover.
 */
export async function resequencePhotos(vehicleId: string): Promise<void> {
  const photos = await fetchPhotos(vehicleId);

  await Promise.all(
    photos.map((photo, index) => {
      const position = index + 1;
      if (photo.position === position) return Promise.resolve();
      return supabase
        .from('vehicle_photos')
        .update({ position })
        .eq('id', photo.id)
        .then(({ error }) => {
          if (error) throw error;
        });
    }),
  );
}

/** Removes the actual image files from storage. */
export async function deletePhotoFiles(storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(storagePaths);
  if (error) throw error;
}

/**
 * The photo bucket is private, so images can't be shown by plain URL. We ask
 * Supabase for short-lived links instead, and TanStack Query caches them.
 */
export async function createSignedUrls(
  storagePaths: string[],
  expiresInSeconds = 3600,
): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(storagePaths, expiresInSeconds);
  if (error) throw error;

  const urls: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}

/**
 * Cover photos (position 1) for several cars in one query, so the garage list
 * doesn't fire a separate request per car.
 */
export async function fetchCoverPhotos(vehicleIds: string[]): Promise<Record<string, string>> {
  if (vehicleIds.length === 0) return {};
  const { data, error } = await supabase
    .from('vehicle_photos')
    .select('vehicle_id, storage_path, position')
    .in('vehicle_id', vehicleIds)
    .order('position');
  if (error) throw error;

  // First photo wins. Reading the lowest position rather than insisting on
  // exactly 1 means a car still shows a cover even if numbering ever slips.
  const covers: Record<string, string> = {};
  for (const row of data) {
    if (!covers[row.vehicle_id]) covers[row.vehicle_id] = row.storage_path;
  }
  return covers;
}

// -------------------------------------------------------------------- mods --

export async function fetchModifications(vehicleId: string): Promise<Modification[]> {
  const { data, error } = await supabase
    .from('modifications')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchModification(modId: string): Promise<Modification> {
  const { data, error } = await supabase
    .from('modifications')
    .select('*')
    .eq('id', modId)
    .single();
  if (error) throw error;
  return data;
}

export type ModificationInput = {
  category: ModCategory;
  title: string;
  brand: string | null;
  notes: string | null;
  installed_on: string | null;
};

export async function createModification(
  vehicleId: string,
  input: ModificationInput,
): Promise<Modification> {
  const { data, error } = await supabase
    .from('modifications')
    .insert({ vehicle_id: vehicleId, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateModification(
  modId: string,
  input: ModificationInput,
): Promise<Modification> {
  const { data, error } = await supabase
    .from('modifications')
    .update(input)
    .eq('id', modId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteModification(modId: string): Promise<void> {
  const { error } = await supabase.from('modifications').delete().eq('id', modId);
  if (error) throw error;
}
