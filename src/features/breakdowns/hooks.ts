import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { distanceBetween } from '@/features/trips/grid';
import type { DrivePosition } from '@/services/location';
import { supabase } from '@/services/supabase/client';

import { fetchBreakdowns, reportBreakdown, resolveBreakdown, type BreakdownAlert } from './api';

export const breakdownKeys = {
  forConvoy: (convoyId: string) => ['breakdowns', convoyId] as const,
};

function logInDev(error: unknown) {
  if (__DEV__) console.warn('[breakdowns]', error);
}

/**
 * Breakdown alerts on one drive, kept up to date.
 *
 * Two mechanisms, deliberately:
 *
 *   The database row is the truth. Unlike live positions, a breakdown has to
 *   survive being missed — someone who opens the screen a minute later, or
 *   whose phone dropped signal, still needs to know a car is stopped.
 *
 *   Realtime is only a nudge. The broadcast carries no location and no name,
 *   just "something changed on this drive". Everyone then asks the database,
 *   which applies its own permission rules. So a tampered-with app can't
 *   announce a breakdown that isn't there, or put it somewhere it isn't.
 *
 * The 30-second refetch is the backstop for a nudge that never arrives.
 */
export function useConvoyBreakdowns(convoyId: string | undefined) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const query = useQuery({
    queryKey: breakdownKeys.forConvoy(convoyId ?? 'none'),
    queryFn: convoyId ? () => fetchBreakdowns(convoyId) : skipToken,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!convoyId) return;

    // A channel of its own rather than the presence channel positions use:
    // different concern, different lifetime, and no risk of one breaking the
    // other.
    const channel = supabase.channel(`convoy:${convoyId}:alerts`);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'changed' }, () => {
      void queryClient.invalidateQueries({ queryKey: breakdownKeys.forConvoy(convoyId) });
    });
    void channel.subscribe();

    return () => {
      void channel.unsubscribe();
      channelRef.current = null;
    };
  }, [convoyId, queryClient]);

  // Supabase doesn't send a broadcast back to whoever sent it, so the sender
  // refreshes its own copy directly.
  const refreshEveryone = useCallback(() => {
    if (!convoyId) return;
    void queryClient.invalidateQueries({ queryKey: breakdownKeys.forConvoy(convoyId) });
    void channelRef.current?.send({ type: 'broadcast', event: 'changed', payload: {} });
  }, [convoyId, queryClient]);

  const report = useMutation({
    mutationFn: (input: { latitude: number; longitude: number; note: string | null }) => {
      if (!convoyId) throw new Error('No drive running');
      return reportBreakdown(convoyId, input.latitude, input.longitude, input.note);
    },
    onSuccess: refreshEveryone,
    onError: logInDev,
  });

  const resolve = useMutation({
    mutationFn: (breakdownId: string) => resolveBreakdown(breakdownId),
    onSuccess: refreshEveryone,
    onError: logInDev,
  });

  const alerts = query.data ?? [];
  const mine = alerts.find((alert) => alert.isYou) ?? null;

  return {
    alerts,
    /** Your own open breakdown, if you have one. */
    mine,
    isLoading: query.isPending,
    report,
    resolve,
  };
}

/**
 * The nearest stranded crew mate, for the banner at the top of the drive.
 * Yours is left out — you know where you are.
 */
export function useNearestBreakdown(
  position: DrivePosition | null,
  alerts: BreakdownAlert[],
): { alert: BreakdownAlert; metres: number } | null {
  return useMemo(() => {
    if (!position) return null;

    let closest: { alert: BreakdownAlert; metres: number } | null = null;
    for (const alert of alerts) {
      if (alert.isYou) continue;
      const metres = distanceBetween(position, alert);
      if (!closest || metres < closest.metres) closest = { alert, metres };
    }
    return closest;
  }, [alerts, position]);
}
