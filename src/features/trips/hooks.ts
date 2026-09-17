import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { selectUserId } from '@/features/auth/authSlice';
import { useDataSaver } from '@/features/settings/hooks';
import { SQUARE_LIMIT, limitFor } from '@/features/settings/settingsSlice';
import { trackerFor, type DrivePosition, type LocationPermission } from '@/services/location';
import { useAppSelector } from '@/store';

import {
  deleteTrip,
  eraseExploredMap,
  fetchExploredCount,
  fetchSquaresInView,
  fetchTripStats,
  fetchTrips,
  recordTrip,
} from './api';
import { cellFor, cellKey, distanceBetween, simplifyRoute, type Cell } from './grid';
import {
  MAX_ATTEMPTS,
  clearDraft,
  loadPendingTrips,
  queueTrip,
  recoverDraft,
  removePendingTrip,
  saveDraft,
  updatePendingTrip,
  type PendingTrip,
} from './pending';

export const tripKeys = {
  trips: ['trips'] as const,
  stats: ['trip-stats'] as const,
  explored: ['explored-count'] as const,
  squares: (bounds: string) => ['explored-squares', bounds] as const,
  pending: ['pending-trips'] as const,
};

function logInDev(error: unknown) {
  if (__DEV__) console.warn('[trips]', error);
}

export function useTrips() {
  return useQuery({ queryKey: tripKeys.trips, queryFn: () => fetchTrips() });
}

export function useTripStats() {
  return useQuery({ queryKey: tripKeys.stats, queryFn: fetchTripStats });
}

export function useExploredCount() {
  return useQuery({ queryKey: tripKeys.explored, queryFn: fetchExploredCount });
}

export function useSquaresInView(bounds: {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} | null) {
  // Each square is a row to download and a shape for the map to draw. Data
  // Saver asks for far fewer, so the map stays usable on a slow connection.
  const dataSaver = useDataSaver();
  const limit = limitFor(SQUARE_LIMIT, dataSaver);

  return useQuery({
    queryKey: [
      ...tripKeys.squares(bounds ? Object.values(bounds).join(',') : 'none'),
      limit,
    ],
    // skipToken is how this project says "nothing to fetch yet". Passing an
    // undefined function with enabled:false looks equivalent but TanStack Query
    // rejects it.
    queryFn: bounds ? () => fetchSquaresInView(bounds, limit) : skipToken,
    staleTime: 60_000,
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => deleteTrip(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.trips });
      queryClient.invalidateQueries({ queryKey: tripKeys.stats });
    },
    onError: logInDev,
  });
}

export function useEraseExploredMap() {
  const queryClient = useQueryClient();
  const userId = useAppSelector(selectUserId);

  return useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('Not signed in');
      return eraseExploredMap(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.explored });
      queryClient.invalidateQueries({ queryKey: ['explored-squares'] });
    },
    onError: logInDev,
  });
}

/**
 * One attempt at uploading a queued drive.
 *
 * The two kinds of failure need opposite treatment:
 *
 *   No answer at all (no signal, request timed out) is temporary. Keep it
 *   queued and try again later.
 *
 *   An answer that refuses the drive is not going to change on its own. The
 *   usual cause is the car having been deleted since, which record_trip
 *   rejects because it checks you own it. Rather than lose the drive, the car
 *   is dropped from it and it goes again — you keep the distance and the
 *   squares, the drive just loses its link to a car that no longer exists.
 */
async function uploadPending(trip: PendingTrip): Promise<'uploaded' | 'retry' | 'stuck'> {
  try {
    await recordTrip(trip);
    await removePendingTrip(trip.id);
    return 'uploaded';
  } catch (error) {
    logInDev(error);
    const attempts = trip.attempts + 1;

    // A Supabase error object carries a code; a network failure doesn't.
    const wasRefused = typeof error === 'object' && error !== null && 'code' in error;
    if (wasRefused && trip.vehicleId) {
      await updatePendingTrip(trip.id, { vehicleId: null, attempts });
      return 'retry';
    }

    const stuck = attempts >= MAX_ATTEMPTS;
    await updatePendingTrip(trip.id, { attempts, stuck });
    return stuck ? 'stuck' : 'retry';
  }
}

/**
 * Drives waiting to upload.
 *
 * Retried when the screen opens and whenever the app comes back to the
 * foreground. There is deliberately no network-detection library: trying and
 * failing costs less than asking the phone whether it's online, and it can't
 * be wrong about it.
 */
export function usePendingTrips() {
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: tripKeys.pending, queryFn: loadPendingTrips });

  const retry = useMutation({
    mutationFn: async () => {
      const queue = await loadPendingTrips();
      for (const trip of queue) {
        // Ones the app has given up on wait for the person to decide.
        if (trip.stuck) continue;
        await uploadPending(trip);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.pending });
      queryClient.invalidateQueries({ queryKey: tripKeys.trips });
      queryClient.invalidateQueries({ queryKey: tripKeys.stats });
      queryClient.invalidateQueries({ queryKey: tripKeys.explored });
      queryClient.invalidateQueries({ queryKey: ['explored-squares'] });
    },
  });

  const discard = useMutation({
    mutationFn: (id: string) => removePendingTrip(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripKeys.pending }),
    onError: logInDev,
  });

  // The listener below outlives any one render, so it reaches the current
  // mutate function through a ref. Refs are written in an effect because React
  // forbids writing them while rendering.
  const retryRef = useRef(retry.mutate);
  useEffect(() => {
    retryRef.current = retry.mutate;
  }, [retry.mutate]);

  // On open: rescue a drive the app died in the middle of, then try the queue.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await recoverDraft();
      if (cancelled) return;
      await queryClient.invalidateQueries({ queryKey: tripKeys.pending });
      retryRef.current();
    })();
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') retryRef.current();
    });
    return () => subscription.remove();
  }, []);

  const trips = query.data ?? [];

  return {
    trips,
    count: trips.length,
    stuck: trips.filter((trip) => trip.stuck),
    isRetrying: retry.isPending,
    retry: retry.mutate,
    discard: discard.mutate,
  };
}

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'saving';

/**
 * Recording a drive.
 *
 * Positions arrive every second or two. Keeping every one of them in React
 * state would re-render the screen constantly, so the raw path and the squares
 * are collected in refs, and only the numbers people look at live in state.
 *
 * Nothing is sent to the server until the drive is stopped.
 */
export function useTripRecorder({ simulated }: { simulated: boolean }) {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [permission, setPermission] = useState<LocationPermission | 'unknown'>('unknown');
  const [distanceM, setDistanceM] = useState(0);
  const [durationS, setDurationS] = useState(0);
  const [maxSpeedKph, setMaxSpeedKph] = useState(0);
  const [newSquares, setNewSquares] = useState(0);
  const [lastPosition, setLastPosition] = useState<DrivePosition | null>(null);

  // Mirrors of the two numbers the checkpoint needs. They're in state for the
  // screen to show, and in refs so the 30-second timer can read the latest
  // values without restarting on every GPS reading.
  const distanceRef = useRef(0);
  const maxSpeedRef = useRef(0);

  const pointsRef = useRef<{ latitude: number; longitude: number }[]>([]);
  const cellsRef = useRef<Map<string, Cell>>(new Map());
  const startedAtRef = useRef<number | null>(null);
  const vehicleIdRef = useRef<string | null>(null);
  const stopWatchingRef = useRef<(() => void) | null>(null);

  // A ticking clock for the duration, so it moves even when the car is stopped.
  useEffect(() => {
    if (status !== 'recording') return;
    const timer = setInterval(() => {
      if (startedAtRef.current) {
        setDurationS(Math.round((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  // Always stop listening if the screen goes away mid-drive.
  useEffect(() => () => stopWatchingRef.current?.(), []);

  /**
   * A copy of the drive on the phone, refreshed every 30 seconds.
   *
   * If the app is killed — iOS reclaiming a backgrounded app, a flat battery,
   * a crash — this is what turns 200km of driving into 30 seconds of loss
   * instead of all of it. It reads from refs, so checkpointing never causes a
   * re-render of the screen.
   */
  useEffect(() => {
    if (status !== 'recording') return;

    const checkpoint = () => {
      const startedAt = startedAtRef.current;
      if (!startedAt || pointsRef.current.length < 2) return;

      void saveDraft({
        vehicleId: vehicleIdRef.current,
        startedAt: new Date(startedAt).toISOString(),
        lastSeenAt: new Date().toISOString(),
        distanceM: distanceRef.current,
        maxSpeedKph: maxSpeedRef.current,
        route: pointsRef.current,
        cells: [...cellsRef.current.values()],
      });
    };

    const timer = setInterval(checkpoint, 30_000);
    return () => clearInterval(timer);
  }, [status]);

  const start = useCallback(
    async (vehicleId: string | null) => {
      if (status !== 'idle') return;
      setStatus('starting');

      const tracker = trackerFor(simulated);
      const result = await tracker.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        setStatus('idle');
        return;
      }

      pointsRef.current = [];
      cellsRef.current = new Map();
      startedAtRef.current = Date.now();
      vehicleIdRef.current = vehicleId;
      distanceRef.current = 0;
      maxSpeedRef.current = 0;
      setDistanceM(0);
      setDurationS(0);
      setMaxSpeedKph(0);
      setNewSquares(0);

      stopWatchingRef.current = await tracker.watch((position) => {
        const point = { latitude: position.latitude, longitude: position.longitude };
        const previous = pointsRef.current[pointsRef.current.length - 1];
        pointsRef.current.push(point);

        if (previous) {
          const step = distanceBetween(previous, point);
          // Ignore jumps: a GPS fix can wander by tens of metres while parked.
          if (step >= 5) {
            distanceRef.current += step;
            setDistanceM(distanceRef.current);
          }
        }

        const cell = cellFor(point.latitude, point.longitude);
        const key = cellKey(cell);
        if (!cellsRef.current.has(key)) {
          cellsRef.current.set(key, cell);
          setNewSquares(cellsRef.current.size);
        }

        if (position.speedKph !== null) {
          maxSpeedRef.current = Math.max(maxSpeedRef.current, position.speedKph);
          setMaxSpeedKph(maxSpeedRef.current);
        }
        setLastPosition(position);
      });

      setStatus('recording');
    },
    [simulated, status],
  );

  const saveMutation = useMutation({
    mutationFn: recordTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.trips });
      queryClient.invalidateQueries({ queryKey: tripKeys.stats });
      queryClient.invalidateQueries({ queryKey: tripKeys.explored });
      queryClient.invalidateQueries({ queryKey: ['explored-squares'] });
    },
    onError: logInDev,
  });

  const stop = useCallback(async () => {
    if (status !== 'recording') return null;
    stopWatchingRef.current?.();
    stopWatchingRef.current = null;
    setStatus('saving');

    const startedAt = startedAtRef.current ?? Date.now();
    const points = pointsRef.current;

    // A drive that never moved isn't worth saving.
    if (points.length < 2 || distanceM < 50) {
      void clearDraft();
      setStatus('idle');
      return { saved: false as const, reason: 'too-short' as const };
    }

    const payload = {
      vehicleId: vehicleIdRef.current,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      distanceM,
      durationS: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      maxSpeedKph,
      route: simplifyRoute(points),
      cells: [...cellsRef.current.values()],
    };

    try {
      await saveMutation.mutateAsync(payload);
      await clearDraft();
      return { saved: true as const };
    } catch (error) {
      // The point of the queue. Pressing stop in a dead zone used to lose the
      // whole drive; now it waits on the phone and goes up later. The start
      // time travels with it, so a late upload still lands in the right month
      // on the leaderboards.
      logInDev(error);
      await queueTrip(payload);
      await clearDraft();
      void queryClient.invalidateQueries({ queryKey: tripKeys.pending });
      return { saved: false as const, reason: 'queued' as const };
    } finally {
      setStatus('idle');
    }
  }, [distanceM, maxSpeedKph, queryClient, saveMutation, status]);

  const cancel = useCallback(() => {
    stopWatchingRef.current?.();
    stopWatchingRef.current = null;
    void clearDraft();
    setStatus('idle');
  }, []);

  return {
    status,
    permission,
    distanceM,
    durationS,
    maxSpeedKph,
    newSquares,
    lastPosition,
    isSaving: saveMutation.isPending,
    saveFailed: saveMutation.isError,
    start,
    stop,
    cancel,
  };
}
