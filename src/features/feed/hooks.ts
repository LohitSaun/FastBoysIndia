import {
  skipToken,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { selectUserId } from '@/features/auth/authSlice';
import { useDataSaver } from '@/features/settings/hooks';
import { FEED_PAGE_SIZE, limitFor } from '@/features/settings/settingsSlice';
import { useAppSelector } from '@/store';

import {
  blockUser,
  createPost,
  createVideoUrls,
  fetchFeedPage,
  removeOwnPost,
  reportPost,
  type FeedPost,
  type NewPost,
  type ReportReason,
} from './api';
import { uploadVideo, type PickedVideo } from './upload';

export const feedKeys = {
  feed: (cityId: string | null, pageSize: number) => ['feed', cityId ?? 'all', pageSize] as const,
  urls: (paths: string[]) => ['feed-urls', ...paths] as const,
};

function logInDev(error: unknown) {
  if (__DEV__) console.warn('[feed]', error);
}

/**
 * The feed, a page at a time.
 *
 * Paged by timestamp rather than by an offset: the feed gains rows at the top
 * while somebody scrolls, and an offset would quietly show the same clip twice.
 */
export function useFeed(cityId: string | null) {
  const dataSaver = useDataSaver();
  const pageSize = limitFor(FEED_PAGE_SIZE, dataSaver);

  return useInfiniteQuery({
    queryKey: feedKeys.feed(cityId, pageSize),
    queryFn: ({ pageParam }) =>
      fetchFeedPage({ before: pageParam, limit: pageSize, cityId }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: FeedPost[]) =>
      // A short page means the end; otherwise carry on from the oldest clip.
      lastPage.length < pageSize ? undefined : (lastPage[lastPage.length - 1]?.createdAt ?? undefined),
  });
}

/**
 * Signed links for the clips currently loaded.
 *
 * Asked for in one batch rather than per clip, and re-fetched every 50 minutes
 * because the links last an hour.
 */
export function useVideoUrls(posts: FeedPost[]) {
  const paths = posts.flatMap((post) =>
    [post.videoPath, post.thumbnailPath].filter((path): path is string => Boolean(path)),
  );

  return useQuery({
    queryKey: feedKeys.urls(paths),
    queryFn: paths.length > 0 ? () => createVideoUrls(paths) : skipToken,
    staleTime: 50 * 60 * 1000,
  });
}

export function usePostVideo() {
  const queryClient = useQueryClient();
  const userId = useAppSelector(selectUserId);

  return useMutation({
    mutationFn: async (input: {
      video: PickedVideo;
      caption: string | null;
      vehicleId: string | null;
      cityId: string | null;
    }) => {
      if (!userId) throw new Error('Not signed in');

      const uploaded = await uploadVideo(userId, input.video);
      const post: NewPost = {
        videoPath: uploaded.videoPath,
        thumbnailPath: uploaded.thumbnailPath,
        caption: input.caption,
        vehicleId: input.vehicleId,
        cityId: input.cityId,
        durationS: input.video.durationS || null,
      };
      return createPost(userId, post);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
    onError: logInDev,
  });
}

export function useRemoveOwnPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => removeOwnPost(postId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
    onError: logInDev,
  });
}

export function useReportPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { postId: string; reason: ReportReason }) =>
      reportPost(input.postId, input.reason),
    // A clip may have just crossed the reporting threshold and come down, so
    // the feed is refreshed rather than assumed unchanged.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
    onError: logInDev,
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  const userId = useAppSelector(selectUserId);

  return useMutation({
    mutationFn: (blockedId: string) => {
      if (!userId) throw new Error('Not signed in');
      return blockUser(userId, blockedId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
    onError: logInDev,
  });
}
