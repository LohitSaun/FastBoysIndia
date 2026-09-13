/**
 * Design tokens: the app's colours, spacing and text sizes in one place.
 * Screens import these instead of hard-coding "#FF5A1F" or "16" everywhere,
 * so a rebrand later means editing this file, not 40 screens.
 *
 * The app is dark-only for v1 (set in app.config.ts), which suits night drives
 * and keeps us from maintaining two themes.
 */

export const colors = {
  background: '#0B0B0F',
  surface: '#16161D',
  surfaceRaised: '#1F1F29',
  border: '#2A2A36',

  text: '#F5F5F7',
  textMuted: '#9A9AA8',

  primary: '#FF5A1F',
  primaryPressed: '#E04A12',
  // Dark text on the orange reads better than white (higher contrast).
  onPrimary: '#0B0B0F',

  danger: '#FF4D4F',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400' },
} as const;
