/**
 * Deleting your account.
 *
 * Two halves, in this order:
 *
 *   1. The files. Photos and clips live in Supabase Storage, which the database
 *      can't reach, so the app removes them itself. It can, because every
 *      storage rule checks that the first folder of the path is your own user
 *      id.
 *
 *   2. The rows. One database function removes the auth user, and every table's
 *      foreign key takes the rest with it. It also hands over any crew you own
 *      first, so leaving never destroys other people's crew.
 *
 * Files first on purpose: if the run is interrupted, a few leftover files are a
 * far smaller problem than an account that is half deleted and can still sign
 * in.
 */
import { PHOTO_BUCKET } from '@/features/garage/api';
import { VIDEO_BUCKET } from '@/features/feed/api';
import { supabase } from '@/services/supabase/client';

/**
 * Everything of yours in one bucket. Storage has no "delete this folder", so
 * the paths have to be listed and removed by name.
 */
async function removeFolder(bucket: string, userId: string): Promise<number> {
  let removed = 0;

  // Files sit either directly under <user id>/ (clips) or one level deeper,
  // under <user id>/<car id>/ (photos), so both levels are walked.
  const { data: top, error } = await supabase.storage.from(bucket).list(userId, { limit: 1000 });
  if (error) throw error;

  const files: string[] = [];
  for (const entry of top ?? []) {
    // A folder comes back with no id; a file has one.
    if (entry.id === null) {
      const { data: inner } = await supabase.storage
        .from(bucket)
        .list(`${userId}/${entry.name}`, { limit: 1000 });
      for (const file of inner ?? []) {
        if (file.id !== null) files.push(`${userId}/${entry.name}/${file.name}`);
      }
    } else {
      files.push(`${userId}/${entry.name}`);
    }
  }

  // Storage takes a limited number of paths per call, so they go in batches.
  const BATCH = 100;
  for (let index = 0; index < files.length; index += BATCH) {
    const batch = files.slice(index, index + BATCH);
    const { error: removeError } = await supabase.storage.from(bucket).remove(batch);
    if (removeError) throw removeError;
    removed += batch.length;
  }

  return removed;
}

export async function deleteMyFiles(userId: string): Promise<number> {
  const photos = await removeFolder(PHOTO_BUCKET, userId);
  const clips = await removeFolder(VIDEO_BUCKET, userId);
  return photos + clips;
}

export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
}
