/**
 * The one place the app reads environment variables.
 *
 * Two things worth knowing:
 * 1. Expo only swaps in EXPO_PUBLIC_* values when they're written out in full,
 *    like `process.env.EXPO_PUBLIC_SUPABASE_URL`. Destructuring `process.env`
 *    or using `process.env[name]` gives `undefined` in the built app, which is
 *    why each variable is spelled out below.
 * 2. Every EXPO_PUBLIC_* value is bundled INTO the app, and anyone who downloads
 *    the app can read it. Only public values belong here, never secrets.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env, fill it in, ` +
        'then restart the bundler with "npx expo start --clear".',
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),

  // Optional. Sentry and PostHog simply stay switched off while these are empty,
  // so the app works before those accounts exist.
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
  posthogApiKey: process.env.EXPO_PUBLIC_POSTHOG_API_KEY || undefined,
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST || undefined,
} as const;
