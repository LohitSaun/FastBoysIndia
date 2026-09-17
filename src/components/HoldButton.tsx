import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

type HoldButtonProps = {
  title: string;
  /** Shown while the finger is down, e.g. "Keep holding…". */
  holdingTitle?: string;
  /** How long the press has to last. */
  holdMs?: number;
  onHoldComplete: () => void;
  disabled?: boolean;
};

/** Redrawn 20 times a second, which is smooth enough for a 1.5s bar. */
const TICK_MS = 50;

/**
 * A button that only fires after being held down.
 *
 * Used for the SOS. A single tap is too easy to trigger by accident in a
 * pocket or while reaching for the phone, and a confirmation dialog is the
 * wrong answer for something urgent — it adds a second decision at the worst
 * moment. Holding is deliberate without being slow, and letting go cancels it.
 */
export function HoldButton({
  title,
  holdingTitle,
  holdMs = 1500,
  onHoldComplete,
  disabled = false,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    startedAtRef.current = null;
    setProgress(0);
  }, []);

  // Lifting a finger off the screen isn't the only way this can end: the screen
  // can be navigated away from mid-hold.
  useEffect(() => stop, [stop]);

  const handlePressIn = () => {
    if (disabled) return;
    startedAtRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt === null) return;

      const ratio = Math.min(1, (Date.now() - startedAt) / holdMs);
      setProgress(ratio);

      if (ratio >= 1) {
        stop();
        onHoldComplete();
      }
    }, TICK_MS);
  };

  const isHolding = progress > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={`Hold for ${Math.round(holdMs / 1000)} seconds to confirm`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={stop}
      style={[styles.base, disabled && styles.disabled]}
    >
      {/* Fills left to right as the hold goes on, so progress is visible. */}
      <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      <Text style={styles.label}>{isHolding ? (holdingTitle ?? title) : title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  // Anchored left so it grows rightwards as the hold goes on.
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.danger,
  },
  label: {
    ...typography.label,
    color: colors.text,
  },
  disabled: {
    opacity: 0.5,
  },
});
