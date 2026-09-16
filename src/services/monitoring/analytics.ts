/**
 * Product analytics (PostHog): which screens people use, and key moments like signing up.
 *
 * Every analytics call goes through this file, so:
 *  - screens never import PostHog directly (easy to swap or remove later)
 *  - with no API key set, every function quietly does nothing
 *  - there's one place to check we never send personal data
 *    (no phone numbers, names or locations)
 */
import PostHog from 'posthog-react-native';

import { env } from '@/lib/env';

const client = env.posthogApiKey
  ? new PostHog(env.posthogApiKey, {
      host: env.posthogHost,
      // App opened / backgrounded events: useful for "how often do people open the app".
      captureAppLifecycleEvents: true,
      // Never record the user's screen.
      enableSessionReplay: false,
    })
  : null;

/**
 * Every event name we send. Listing them here turns a typo like 'singed_up' into a
 * TypeScript error, and keeps the PostHog dashboard free of near-duplicate events.
 */
type AnalyticsEvent =
  | 'otp_requested'
  | 'signed_in'
  | 'signed_up'
  | 'vehicle_added'
  | 'photo_added'
  | 'mod_added';

export const analytics = {
  track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean>) {
    client?.capture(event, properties);
  },
  screen(name: string) {
    client?.screen(name);
  },
  identify(userId: string) {
    client?.identify(userId);
  },
  reset() {
    client?.reset();
  },
};
