import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Expo app config. It's TypeScript (not app.json) so it can change per build variant.
 *
 * APP_VARIANT is set for each build profile in eas.json:
 *   development → "Fast Boys (Dev)"     in.fastboys.app.dev
 *   preview     → "Fast Boys (Preview)" in.fastboys.app.preview
 *   production  → "Fast Boys India"     in.fastboys.app
 * Because each variant has its own ID, all three can be installed on one phone side by side.
 *
 * ⚠️ The production ID `in.fastboys.app` becomes permanent once the app is published
 * to the App Store / Play Store.
 *
 * Changes in this file only take effect after a NEW native build (eas build),
 * not on a normal reload.
 */

const VARIANTS = {
  development: { name: 'Fast Boys (Dev)', id: 'in.fastboys.app.dev', scheme: 'fastboys-dev' },
  preview: { name: 'Fast Boys (Preview)', id: 'in.fastboys.app.preview', scheme: 'fastboys-preview' },
  production: { name: 'Fast Boys India', id: 'in.fastboys.app', scheme: 'fastboys' },
} as const;

type Variant = keyof typeof VARIANTS;

function currentVariant(): Variant {
  const value = process.env.APP_VARIANT;
  return value === 'preview' || value === 'production' ? value : 'development';
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = VARIANTS[currentVariant()];

  return {
    ...config,
    name: variant.name,
    slug: 'fast-boys-india',
    // The Expo account that owns this project (expo.dev/accounts/lohitsaun/projects/fast-boys-india).
    owner: 'lohitsaun',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    // The app's own link prefix, e.g. fastboys://... Phase 3 adds https://fastboys.in links on top.
    scheme: variant.scheme,
    // Dark-only for v1 (see src/theme).
    userInterfaceStyle: 'dark',
    ios: {
      bundleIdentifier: variant.id,
      // Phone-only for now. Supporting iPad would also mean iPad screenshots for App Store review.
      supportsTablet: false,
    },
    android: {
      package: variant.id,
      // Template icons for now; swap in real Fast Boys branding before any public release.
      adaptiveIcon: {
        backgroundColor: '#0B0B0F',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      'expo-router',
      [
        // Wires Sentry into the native iOS/Android projects and uploads source maps during
        // EAS builds so crash reports show our real file names and line numbers.
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          organization: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
        },
      ],
    ],
    experiments: {
      // Lets TypeScript catch links to screens that don't exist, e.g. router.push('/garaje').
      typedRoutes: true,
    },
    extra: {
      ...config.extra,
      eas: {
        // Links this app to its project on expo.dev. Needed for EAS builds, and for Expo Go
        // to open the project when you're logged in. Not a secret.
        projectId: '0de7fa0f-d1f1-4b3c-8052-b2e392bf492b',
      },
    },
  };
};
