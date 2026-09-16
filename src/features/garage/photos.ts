/**
 * Turning a photo on the phone into a file in Supabase Storage.
 *
 * The steps are always: pick → shrink → upload.
 *
 * Shrinking matters a lot here. A photo straight from an iPhone camera is
 * 3–5 MB; resized to 1600px and saved at 70% quality it's usually under 400 KB.
 * That's faster on Indian mobile data, cheaper for the user, and keeps us well
 * inside Supabase's free 1 GB of storage.
 */
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { PHOTO_BUCKET } from './api';
import { supabase } from '@/services/supabase/client';

/** Longest side of the stored image, in pixels. */
const MAX_DIMENSION = 1600;
/** 0 = smallest file, 1 = best quality. */
const JPEG_QUALITY = 0.7;

export type PickResult =
  | { status: 'picked'; uri: string }
  | { status: 'cancelled' }
  | { status: 'denied' };

/** Opens the phone's photo library. */
export async function pickFromLibrary(): Promise<PickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    // Full quality here; we do our own resizing next, which gives a better
    // result than letting the picker compress twice.
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return { status: 'cancelled' };
  return { status: 'picked', uri: result.assets[0].uri };
}

/** Opens the camera. */
export async function takePhoto(): Promise<PickResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return { status: 'cancelled' };
  return { status: 'picked', uri: result.assets[0].uri };
}

/** Resizes and compresses, returning the location of the smaller copy. */
async function shrink(localUri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(localUri)
    .resize({ width: MAX_DIMENSION })
    .renderAsync();

  const saved = await image.saveAsync({
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });

  return saved.uri;
}

/**
 * Files are stored as <user id>/<car id>/<unique name>.jpg. The storage rules
 * check that first folder against the signed-in user, so a person can only
 * write into their own folder.
 */
function buildStoragePath(userId: string, vehicleId: string): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${userId}/${vehicleId}/${unique}.jpg`;
}

/**
 * Shrinks the photo and uploads it, returning the path to store in the
 * vehicle_photos table.
 */
export async function uploadVehiclePhoto(
  userId: string,
  vehicleId: string,
  localUri: string,
): Promise<string> {
  const smallerUri = await shrink(localUri);
  const storagePath = buildStoragePath(userId, vehicleId);

  // Read the file's raw bytes. Supabase's client can't read a file:// address
  // by itself in a mobile app, so we hand it the contents.
  const bytes = await new File(smallerUri).arrayBuffer();

  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(storagePath, bytes, {
    contentType: 'image/jpeg',
  });
  if (error) throw error;

  return storagePath;
}
