/**
 * The short-form video feed.
 *
 * Reading goes through the feed_page database function rather than the table,
 * because it joins the author's name, works out whether a clip is yours, and
 * filters out people you've blocked before anything reaches the phone.
 */
import { supabase } from '@/services/supabase/client';

export const VIDEO_BUCKET = 'post-videos';

/** Matches the check constraint on post_reports.reason. */
export const REPORT_REASONS = [
  'unsafe_driving',
  'not_a_car',
  'offensive',
  'spam',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_LABELS: Record<ReportReason, string> = {
  unsafe_driving: 'Dangerous driving',
  not_a_car: 'Nothing to do with cars',
  offensive: 'Offensive',
  spam: 'Spam or an advert',
  other: 'Something else',
};

export type FeedPost = {
  id: string;
  authorId: string;
  displayName: string | null;
  car: string | null;
  videoPath: string;
  thumbnailPath: string | null;
  caption: string | null;
  cityId: string | null;
  durationS: number | null;
  createdAt: string;
  isYours: boolean;
  reportedByYou: boolean;
};

type FeedRow = {
  id: string | null;
  author_id: string | null;
  display_name: string | null;
  main_car: string | null;
  video_path: string | null;
  thumbnail_path: string | null;
  caption: string | null;
  city_id: string | null;
  duration_s: number | null;
  created_at: string | null;
  is_yours: boolean | null;
  reported_by_you: boolean | null;
};

export async function fetchFeedPage(options: {
  before?: string | null;
  limit?: number;
  cityId?: string | null;
}): Promise<FeedPost[]> {
  const { data, error } = await supabase.rpc('feed_page', {
    // The generated types mark every function argument as required because they
    // can't tell which accept null. All three of these do.
    p_before: (options.before ?? null) as string,
    p_limit: options.limit ?? 10,
    p_city_id: (options.cityId ?? null) as string,
  });
  if (error) throw error;

  return ((data ?? []) as FeedRow[])
    .filter((row) => row.id && row.video_path)
    .map((row) => ({
      id: row.id as string,
      authorId: row.author_id as string,
      displayName: row.display_name,
      car: row.main_car,
      videoPath: row.video_path as string,
      thumbnailPath: row.thumbnail_path,
      caption: row.caption,
      cityId: row.city_id,
      durationS: row.duration_s,
      createdAt: row.created_at ?? new Date().toISOString(),
      isYours: row.is_yours ?? false,
      reportedByYou: row.reported_by_you ?? false,
    }));
}

/**
 * Short-lived links for the clips about to be shown. They expire in an hour,
 * which is the point: a clip taken down stops being reachable instead of living
 * on at a URL somebody saved.
 */
export async function createVideoUrls(
  paths: string[],
  expiresInSeconds = 3600,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .createSignedUrls(paths, expiresInSeconds);
  if (error) throw error;

  const urls: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}

export type NewPost = {
  videoPath: string;
  thumbnailPath: string | null;
  caption: string | null;
  vehicleId: string | null;
  cityId: string | null;
  durationS: number | null;
};

export async function createPost(authorId: string, post: NewPost): Promise<string> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId,
      video_path: post.videoPath,
      thumbnail_path: post.thumbnailPath,
      caption: post.caption,
      vehicle_id: post.vehicleId,
      city_id: post.cityId,
      duration_s: post.durationS,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Taking your own clip down. It's marked removed rather than deleted, so the
 * author can still be told what happened to it and any reports stay attached.
 */
export async function removeOwnPost(postId: string): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({ removed_at: new Date().toISOString(), removed_reason: 'author' })
    .eq('id', postId);
  if (error) throw error;
}

export async function reportPost(postId: string, reason: ReportReason): Promise<void> {
  const { error } = await supabase.rpc('report_post', {
    p_post_id: postId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_users')
    .upsert(
      { blocker_id: blockerId, blocked_id: blockedId },
      { onConflict: 'blocker_id,blocked_id' },
    );
  if (error) throw error;
}
