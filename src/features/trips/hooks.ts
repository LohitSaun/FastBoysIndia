import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { selectUserId } from '@/features/auth/authSlice';
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

export const tripKeys = {
  trips: ['trips'] as const,
  stats: ['trip-stats'] as const,
  explored: ['explored-count'] as const,
  squares: (bounds: string) => ['explored-squares', bounds] as const,
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
  return useQuery({
    queryKey: tripKeys.squares(bounds ? Object.values(bounds).join(',') : 'none'),
    // skipToken is how this project says "nothing to fetch yet". Passing an
    // undefined function with enabled:false looks equivalent but TanStack Query
    // rejects it.
    queryFn: bounds ? () => fetchSquaresInView(bounds) : skipToken,
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
          if (step >= 5) setDistanceM((current) => current + step);
        }

        const cell = cellFor(point.latitude, point.longitude);
        const key = cellKey(cell);
        if (!cellsRef.current.has(key)) {
          cellsRef.current.set(key, cell);
          setNewSquares(cellsRef.current.size);
        }

        if (position.speedKph !== null) {
          setMaxSpeedKph((current) => Math.max(current, position.speedKph ?? 0));
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
      setStatus('idle');
      return { saved: false as const };
    }

    try {
      await saveMutation.mutateAsync({
        vehicleId: vehicleIdRef.current,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        distanceM,
        durationS: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
        maxSpeedKph,
        route: simplifyRoute(points),
        cells: [...cellsRef.current.values()],
      });
      return { saved: true as const };
    } finally {
      setStatus('idle');
    }
  }, [distanceM, maxSpeedKph, saveMutation, status]);

  const cancel = useCallback(() => {
    stopWatchingRef.current?.();
    stopWatchingRef.current = null;
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
