import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewToken,
} from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { selectUserId } from '@/features/auth/authSlice';
import {
  REPORT_LABELS,
  REPORT_REASONS,
  type FeedPost,
  type ReportReason,
} from '@/features/feed/api';
import {
  useBlockUser,
  useFeed,
  useRemoveOwnPost,
  useReportPost,
  useVideoUrls,
} from '@/features/feed/hooks';
import { useMyProfile } from '@/features/profile/hooks';
import { useDataSaver } from '@/features/settings/hooks';
import { AppVideo } from '@/services/video/AppVideo';
import { useAppSelector } from '@/store';
import { colors, radius, spacing, typography } from '@/theme';

/** A clip counts as "the one being watched" once most of it is on screen. */
const VIEWABILITY = { itemVisiblePercentThreshold: 60 } as const;

export default function FeedScreen() {
  const router = useRouter();
  const myUserId = useAppSelector(selectUserId);
  const profile = useMyProfile();
  const dataSaver = useDataSaver();

  const [myCityOnly, setMyCityOnly] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [height, setHeight] = useState(0);
  // Tapping a clip in Data Saver plays that one without turning autoplay on.
  const [unmuted, setUnmuted] = useState<string | null>(null);

  const cityId = myCityOnly ? (profile.data?.home_city_id ?? null) : null;
  const feed = useFeed(cityId);

  const posts = feed.data?.pages.flat() ?? [];
  const urls = useVideoUrls(posts);

  const reportPost = useReportPost();
  const blockUser = useBlockUser();
  const removeOwnPost = useRemoveOwnPost();

  // FlatList refuses to have this swapped out mid-scroll, so it has to keep the
  // same identity on every render.
  const handleViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (typeof first?.index === 'number') setActiveIndex(first.index);
  }, []);

  const handleLayout = (event: LayoutChangeEvent) => {
    setHeight(event.nativeEvent.layout.height);
  };

  const handleMenu = (post: FeedPost) => {
    if (post.isYours) {
      Alert.alert('Your clip', post.caption ?? 'Posted by you', [
        { text: 'Close', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => removeOwnPost.mutate(post.id),
        },
      ]);
      return;
    }

    Alert.alert(
      post.displayName ?? 'This clip',
      post.reportedByYou ? "You've already reported this." : 'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', onPress: () => askReason(post) },
        {
          text: 'Block this person',
          style: 'destructive',
          onPress: () => confirmBlock(post),
        },
      ],
    );
  };

  const askReason = (post: FeedPost) => {
    Alert.alert(
      "What's wrong with it?",
      'Reports are private. Enough of them and the clip comes down on its own.',
      [
        ...REPORT_REASONS.map((reason: ReportReason) => ({
          text: REPORT_LABELS[reason],
          onPress: () => reportPost.mutate({ postId: post.id, reason }),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const confirmBlock = (post: FeedPost) => {
    Alert.alert(
      `Block ${post.displayName ?? 'this person'}?`,
      "You won't see anything they post again. They aren't told.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => blockUser.mutate(post.authorId),
        },
      ],
    );
  };

  if (feed.isPending) {
    return (
      <Screen edges={['top', 'right', 'left']} style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'right', 'left']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: myCityOnly }}
            onPress={() => setMyCityOnly((current) => !current)}
            style={[styles.chip, myCityOnly && styles.chipOn]}
          >
            <Text style={[styles.chipText, myCityOnly && styles.chipTextOn]}>My city</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post a clip"
            onPress={() => router.push('/new-post')}
            style={styles.postButton}
          >
            <Ionicons name="add" size={22} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.listWrapper} onLayout={handleLayout}>
        {posts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="videocam-outline" size={52} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.hint}>
              {myCityOnly
                ? 'Nobody in your city has posted. Try turning off the city filter.'
                : 'Be the first. Post a clip of your car.'}
            </Text>
            <Button title="Post a clip" onPress={() => router.push('/new-post')} />
          </View>
        ) : height > 0 ? (
          <FlatList
            data={posts}
            keyExtractor={(post) => post.id}
            pagingEnabled
            snapToInterval={height}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={handleViewable}
            viewabilityConfig={VIEWABILITY}
            refreshing={feed.isRefetching}
            onRefresh={() => feed.refetch()}
            onEndReached={() => {
              if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            renderItem={({ item, index }) => (
              <Clip
                post={item}
                height={height}
                videoUrl={urls.data?.[item.videoPath] ?? null}
                thumbnailUrl={item.thumbnailPath ? (urls.data?.[item.thumbnailPath] ?? null) : null}
                // In Data Saver nothing plays until it's tapped.
                playing={index === activeIndex && (!dataSaver || unmuted === item.id)}
                muted={unmuted !== item.id}
                onToggleSound={() => setUnmuted((current) => (current === item.id ? null : item.id))}
                onMenu={() => handleMenu(item)}
                isMine={item.authorId === myUserId}
              />
            )}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function Clip({
  post,
  height,
  videoUrl,
  thumbnailUrl,
  playing,
  muted,
  onToggleSound,
  onMenu,
  isMine,
}: {
  post: FeedPost;
  height: number;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  playing: boolean;
  muted: boolean;
  onToggleSound: () => void;
  onMenu: () => void;
  isMine: boolean;
}) {
  return (
    <View style={[styles.clip, { height }]}>
      {playing && videoUrl ? (
        <AppVideo uri={videoUrl} playing muted={muted} />
      ) : thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={styles.still} resizeMode="cover" />
      ) : (
        <View style={styles.stillEmpty} />
      )}

      {/* Tapping anywhere starts it in Data Saver, and toggles sound otherwise. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Turn sound on or off' : 'Play this clip'}
        onPress={onToggleSound}
        style={styles.tapLayer}
      >
        {!playing ? (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={28} color={colors.text} />
          </View>
        ) : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More options"
        onPress={onMenu}
        style={styles.menuButton}
      >
        <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
      </Pressable>

      <View style={styles.overlay}>
        <Text style={styles.author}>
          {post.displayName ?? 'Someone'}
          {isMine ? ' (you)' : ''}
        </Text>
        {post.car ? <Text style={styles.car}>{post.car}</Text> : null}
        {post.caption ? (
          <Text style={styles.caption} numberOfLines={3}>
            {post.caption}
          </Text>
        ) : null}
        {muted && playing ? <Text style={styles.mutedHint}>Tap for sound</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { ...typography.title, color: colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.surfaceRaised },
  chipText: { ...typography.caption, color: colors.text },
  chipTextOn: { color: colors.primary, fontWeight: '700' },
  postButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listWrapper: { flex: 1 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  emptyTitle: { ...typography.subtitle, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  clip: { width: '100%', backgroundColor: '#000', justifyContent: 'flex-end' },
  still: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  stillEmpty: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.surface },
  tapLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  author: { ...typography.label, color: colors.text },
  car: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  caption: { ...typography.body, color: colors.text },
  mutedHint: { ...typography.caption, color: colors.textMuted },
});
