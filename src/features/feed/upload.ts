/**
 * Turning a clip on the phone into a file in Supabase Storage.
 *
 * pick → check the length → grab a still → upload both.
 *
 * The hard limits matter more here than anywhere else in the app. A 30-second
 * clip off a modern phone is 40–80MB, which is brutal to upload on Indian
 * mobile data and eats the free storage tier in an afternoon. We can't
 * re-encode video on the phone without a heavy native library, so instead the
 * picker is asked for a shorter, lower-quality clip up front, and anything
 * still too big is refused with an explanation rather than silently failing
 * halfway through an upload.
 */
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';

import { supabase } from '@/services/supabase/client';

import { VIDEO_BUCKET } from './api';

/** Long enough for a pull-away or a drive-by, short enough to stay small. */
export const MAX_DURATION_S = 30;

/** Matches the bucket's own limit, so a refusal happens before the upload. */
export const MAX_BYTES = 60 * 1024 * 1024;

export type PickedVideo = { uri: string; durationS: number; bytes: number };

export type PickVideoResult =
  | { status: 'picked'; video: PickedVideo }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'too-long'; durationS: number }
  | { status: 'too-big'; megabytes: number };

export async function pickVideo(): Promise<PickVideoResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsMultipleSelection: false,
    // iOS offers a trim window at this length. It isn't enforced everywhere,
    // which is why the check below exists as well.
    videoMaxDuration: MAX_DURATION_S,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
  });

  if (result.canceled || !result.assets[0]) return { status: 'cancelled' };

  const asset = result.assets[0];
  // duration comes back in milliseconds, and can be missing.
  const durationS = asset.duration ? Math.round(asset.duration / 1000) : 0;
  if (durationS > MAX_DURATION_S) return { status: 'too-long', durationS };

  const bytes = asset.fileSize ?? (await fileSize(asset.uri));
  if (bytes > MAX_BYTES) {
    return { status: 'too-big', megabytes: Math.round(bytes / (1024 * 1024)) };
  }

  return { status: 'picked', video: { uri: asset.uri, durationS, bytes } };
}

async function fileSize(uri: string): Promise<number> {
  try {
    return new File(uri).size ?? 0;
  } catch {
    // If the size can't be read, let the bucket's own limit refuse it.
    return 0;
  }
}

function storagePath(userId: string, extension: string): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${userId}/${unique}.${extension}`;
}

/**
 * A still from one second in, so the feed shows something recognisable rather
 * than a black frame from before the camera settled.
 */
async function makeThumbnail(videoUri: string): Promise<string | null> {
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 1000 });
    return uri;
  } catch {
    // A missing thumbnail is a cosmetic problem, not a reason to lose the clip.
    return null;
  }
}

export type UploadedVideo = { videoPath: string; thumbnailPath: string | null };

export async function uploadVideo(userId: string, video: PickedVideo): Promise<UploadedVideo> {
  const extension = video.uri.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';
  const videoPath = storagePath(userId, extension);

  // Supabase's client can't read a file:// address by itself on a phone, so it
  // is handed the bytes.
  const bytes = await new File(video.uri).arrayBuffer();
  const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(videoPath, bytes, {
    contentType: extension === 'mov' ? 'video/quicktime' : 'video/mp4',
  });
  if (error) throw error;

  let thumbnailPath: string | null = null;
  const thumbnailUri = await makeThumbnail(video.uri);
  if (thumbnailUri) {
    const path = storagePath(userId, 'jpg');
    try {
      const thumbBytes = await new File(thumbnailUri).arrayBuffer();
      const upload = await supabase.storage
        .from(VIDEO_BUCKET)
        .upload(path, thumbBytes, { contentType: 'image/jpeg' });
      if (!upload.error) thumbnailPath = path;
    } catch {
      // Again: the clip is what matters, the still is a nicety.
    }
  }

  return { videoPath, thumbnailPath };
}

/** Removes files after a failed post, so nothing is left paid-for and orphaned. */
export async function deleteUploaded(paths: (string | null)[]): Promise<void> {
  const real = paths.filter((path): path is string => Boolean(path));
  if (real.length === 0) return;
  await supabase.storage.from(VIDEO_BUCKET).remove(real);
}
