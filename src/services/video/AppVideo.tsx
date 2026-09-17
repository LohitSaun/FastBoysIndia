import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

type AppVideoProps = {
  /** A signed link to the clip, or null while one is being fetched. */
  uri: string | null;
  /** Only the clip on screen plays; the rest stay paused. */
  playing: boolean;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's only video player.
 *
 * Screens never import a video library directly, the same rule maps and
 * location follow. Today it's expo-video; moving to a hosted video service
 * later — one that can drop quality on a weak signal, which this cannot — is a
 * change to this file and the upload path, not to the feed.
 *
 * Clips loop and start muted. Sound arriving unannounced is the rudest thing a
 * feed can do, and on Indian mobile data a muted loop is also the cheaper one.
 */
/**
 * expo-video's player is a native object changed by assignment. That assignment
 * lives out here rather than in the component, because React's rules are about
 * values it manages — and this is a handle to something outside React.
 */
function applyMuted(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}

export function AppVideo({ uri, playing, muted = true, style }: AppVideoProps) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = muted;
  });

  // Play and pause are driven by the feed, so scrolling away stops the clip
  // instead of leaving a dozen videos running behind you.
  useEffect(() => {
    if (!player) return;
    if (playing) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, playing]);

  useEffect(() => {
    if (player) applyMuted(player, muted);
  }, [muted, player]);

  return (
    <VideoView
      player={player}
      style={[styles.video, style]}
      contentFit="cover"
      // The feed has its own controls; the built-in ones would fight with
      // scrolling and cover the caption.
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
});
