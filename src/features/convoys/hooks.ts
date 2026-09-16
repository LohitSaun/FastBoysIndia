import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { selectUserId } from '@/features/auth/authSlice';
import { locationTracker, type DrivePosition, type LocationPermission } from '@/services/location';
import { supabase } from '@/services/supabase/client';
import { useAppSelector } from '@/store';

import {
  endConvoy,
  fetchActiveConvoy,
  fetchParticipants,
  joinConvoy,
  leaveConvoy,
  startConvoy,
} from './api';
import { selectGhostMode } from './convoySlice';

export const convoyKeys = {
  active: (crewId: string) => ['convoy-active', crewId] as const,
  participants: (convoyId: string) => ['convoy-participants', convoyId] as const,
};

function logInDev(error: unknown) {
  if (__DEV__) console.warn('[convoy]', error);
}

export function useActiveConvoy(crewId: string | undefined) {
  return useQuery({
    queryKey: convoyKeys.active(crewId ?? 'none'),
    queryFn: crewId ? () => fetchActiveConvoy(crewId) : skipToken,
    // A convoy can be started by someone else, so check now and then.
    refetchInterval: 30_000,
  });
}

export function useParticipants(convoyId: string | undefined) {
  return useQuery({
    queryKey: convoyKeys.participants(convoyId ?? 'none'),
    queryFn: convoyId ? () => fetchParticipants(convoyId) : skipToken,
    refetchInterval: 30_000,
  });
}

export function useStartConvoy(crewId: string) {
  const queryClient = useQueryClient();
  const userId = useAppSelector(selectUserId);

  return useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('Not signed in');
      return startConvoy(crewId, userId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: convoyKeys.active(crewId) }),
    onError: logInDev,
  });
}

export function useJoinConvoy(crewId: string) {
  const queryClient = useQueryClient();
  const userId = useAppSelector(selectUserId);

  return useMutation({
    mutationFn: (convoyId: string) => {
      if (!userId) throw new Error('Not signed in');
      return joinConvoy(convoyId, userId);
    },
    onSuccess: (_r, convoyId) => {
      queryClient.invalidateQueries({ queryKey: convoyKeys.participants(convoyId) });
      queryClient.invalidateQueries({ queryKey: convoyKeys.active(crewId) });
    },
    onError: logInDev,
  });
}

export function useLeaveConvoy(crewId: string) {
  const queryClient = useQueryClient();
  const userId = useAppSelector(selectUserId);

  return useMutation({
    mutationFn: (convoyId: string) => {
      if (!userId) throw new Error('Not signed in');
      return leaveConvoy(convoyId, userId);
    },
    onSuccess: (_r, convoyId) => {
      queryClient.invalidateQueries({ queryKey: convoyKeys.participants(convoyId) });
      queryClient.invalidateQueries({ queryKey: convoyKeys.active(crewId) });
    },
    onError: logInDev,
  });
}

export function useEndConvoy(crewId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (convoyId: string) => endConvoy(convoyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: convoyKeys.active(crewId) }),
    onError: logInDev,
  });
}

/** Someone else on the drive, as seen right now. */
export type LivePosition = {
  userId: string;
  displayName: string;
  position: DrivePosition;
};

type PresencePayload = {
  userId: string;
  displayName: string;
  position: DrivePosition;
};

/**
 * The live part of a convoy.
 *
 * Positions are shared over a Supabase Realtime "presence" channel: each phone
 * publishes where it is, and everyone subscribed sees the current picture. When
 * a phone goes quiet, its dot disappears by itself. Nothing is written to the
 * database, so there's no location history to leak or clean up.
 *
 * Ghost Mode is handled in two places: we stop publishing new positions, and we
 * withdraw the last one that was already out there.
 */
export function useConvoyLive(convoyId: string | undefined, displayName: string) {
  const userId = useAppSelector(selectUserId);
  const ghostMode = useAppSelector(selectGhostMode);

  const [myPosition, setMyPosition] = useState<DrivePosition | null>(null);
  const [others, setOthers] = useState<LivePosition[]>([]);
  const [permission, setPermission] = useState<LocationPermission | 'unknown'>('unknown');

  // The location callback lives for the whole drive, so it reads Ghost Mode
  // through a ref rather than capturing whatever the value was at the start.
  // The ref is updated in an effect: React forbids writing to refs while
  // rendering, because a render can be thrown away and repeated.
  const ghostModeRef = useRef(ghostMode);
  useEffect(() => {
    ghostModeRef.current = ghostMode;
  }, [ghostMode]);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // The most recent reading, so Ghost Mode can be switched off without waiting
  // for the next one to arrive.
  const lastPositionRef = useRef<DrivePosition | null>(null);

  useEffect(() => {
    if (!convoyId || !userId) return;

    let cancelled = false;
    let stopWatching: (() => void) | undefined;

    const channel = supabase.channel(`convoy:${convoyId}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresencePayload>();
      const list: LivePosition[] = [];

      for (const [key, entries] of Object.entries(state)) {
        if (key === userId) continue; // that's me
        const latest = entries[entries.length - 1];
        if (latest?.position) {
          list.push({
            userId: latest.userId ?? key,
            displayName: latest.displayName ?? 'Someone',
            position: latest.position,
          });
        }
      }
      setOthers(list);
    });

    void channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED' || cancelled) return;

      const result = await locationTracker.requestPermission();
      if (cancelled) return;
      setPermission(result);
      if (result !== 'granted') return;

      stopWatching = await locationTracker.watch((position) => {
        setMyPosition(position);
        lastPositionRef.current = position;
        if (ghostModeRef.current) return; // invisible: publish nothing
        void channel.track({ userId, displayName, position } satisfies PresencePayload);
      });
    });

    return () => {
      cancelled = true;
      stopWatching?.();
      void channel.unsubscribe();
      channelRef.current = null;
    };
  }, [convoyId, userId, displayName]);

  // Reacting to the Ghost Mode switch straight away, rather than waiting for the
  // next GPS reading: turning it on withdraws the position that's already out
  // there, and turning it off republishes the last known one. Either way the
  // change shows on other people's maps within a couple of seconds.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    if (ghostMode) {
      void channel.untrack();
      return;
    }

    const position = lastPositionRef.current;
    if (position && userId) {
      void channel.track({ userId, displayName, position } satisfies PresencePayload);
    }
  }, [ghostMode, userId, displayName]);

  return { myPosition, others, permission, ghostMode };
}
