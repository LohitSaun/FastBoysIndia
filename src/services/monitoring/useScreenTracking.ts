import { useSegments } from 'expo-router';
import { useEffect } from 'react';

import { analytics } from './analytics';

/**
 * Sends a "screen view" to PostHog whenever the user moves to a different screen.
 *
 * It uses route segments, not the actual URL. A future screen like /crews/[id] gets
 * reported as "/crews/[id]" rather than "/crews/8f3a...", so no ids leak into analytics
 * and every crew page counts as the same screen. Group folders like "(tabs)" are dropped.
 */
export function useScreenTracking() {
  const segments = useSegments();
  const screenName = '/' + segments.filter((segment) => !segment.startsWith('(')).join('/');

  useEffect(() => {
    analytics.screen(screenName);
  }, [screenName]);
}
