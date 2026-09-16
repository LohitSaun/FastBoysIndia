import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { DrivePosition } from '@/services/location';

import {
  fetchHazardsNear,
  fetchTier,
  reportHazard,
  voteHazard,
  type HazardKind,
  type NearbyHazard,
} from './api';

export const hazardKeys = {
  tier: ['tier'] as const,
  near: (latitude: number, longitude: number, radiusM: number) =>
    // Rounded so small movements reuse the same cached answer.
    ['hazards-near', latitude.toFixed(2), longitude.toFixed(2), radiusM] as const,
};

function logInDev(error: unknown) {
  if (__DEV__) console.warn('[hazards]', error);
}

/** 'free', 'pro' or 'premium'. Checked again in the database on every read. */
export function useTier() {
  return useQuery({ queryKey: hazardKeys.tier, queryFn: fetchTier, staleTime: 5 * 60 * 1000 });
}

export function useHazardsNear(
  center: { latitude: number; longitude: number } | null,
  radiusM = 5000,
) {
  return useQuery({
    queryKey: center
      ? hazardKeys.near(center.latitude, center.longitude, radiusM)
      : ['hazards-near', 'none'],
    queryFn: center ? () => fetchHazardsNear(center.latitude, center.longitude, radiusM) : skipToken,
    staleTime: 60_000,
  });
}

export function useReportHazard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      kind: HazardKind;
      latitude: number;
      longitude: number;
      note: string | null;
    }) => reportHazard(input.kind, input.latitude, input.longitude, input.note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hazards-near'] }),
    onError: logInDev,
  });
}

export function useVoteHazard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { hazardId: string; vote: 'still_there' | 'gone' }) =>
      voteHazard(input.hazardId, input.vote),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hazards-near'] }),
    onError: logInDev,
  });
}

/** How close a camera has to be before the app says anything. */
const WARN_WITHIN_M = 350;

const EARTH_RADIUS_M = 6_371_000;
function metresBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(toRad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(toRad(b.longitude - a.longitude) / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

/**
 * The paid extra: while driving, the nearest speed camera within a few hundred
 * metres, or nothing.
 *
 * This is worked out fresh from the current position each time rather than
 * remembered, which keeps it simple and means the warning clears by itself once
 * you're past the camera. The database already refuses to send cameras to free
 * accounts, so this is only presentation; it isn't the gate.
 */
export function useCameraWarning(
  position: DrivePosition | null,
  hazards: NearbyHazard[] | undefined,
  enabled: boolean,
) {
  return useMemo(() => {
    if (!enabled || !position || !hazards) return null;

    let closest: { id: string; metres: number } | null = null;
    for (const hazard of hazards) {
      if (hazard.kind !== 'speed_camera') continue;
      const metres = metresBetween(position, hazard);
      if (metres <= WARN_WITHIN_M && (!closest || metres < closest.metres)) {
        closest = { id: hazard.id, metres };
      }
    }
    return closest;
  }, [enabled, hazards, position]);
}
