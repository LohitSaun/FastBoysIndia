/**
 * Drives that haven't reached the server yet.
 *
 * Two different problems, both of which lose a whole drive today:
 *
 *   1. The save fails. You press stop in a dead zone on the expressway,
 *      record_trip never lands, and 200km disappears. The payload is written
 *      to the phone instead and retried later.
 *
 *   2. The app dies mid-drive. iOS kills backgrounded apps, phones run out of
 *      battery, and a crash costs you everything recorded so far. So the drive
 *      in progress is checkpointed every so often, and a checkpoint found at
 *      startup is turned into a finished drive waiting to upload.
 *
 * Nothing here runs in the background. With the app closed, a queued drive
 * simply sits safely on the phone until it is opened again — the same honest
 * limit as live location and the SOS button.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RecordTripInput } from './api';
import { simplifyRoute, type Cell } from './grid';

const QUEUE_KEY = 'trips.pending.v1';
const DRAFT_KEY = 'trips.draft.v1';

/**
 * How many times a drive is retried before the app stops trying by itself and
 * shows it to the person instead. A drive is never thrown away silently.
 */
export const MAX_ATTEMPTS = 5;

export type PendingTrip = RecordTripInput & {
  /** Local id, so the right one can be removed after it uploads. */
  id: string;
  queuedAt: string;
  attempts: number;
  /** Set once the app has given up retrying on its own. */
  stuck?: boolean;
};

/** A drive still being recorded, saved in case the app doesn't survive it. */
export type TripDraft = {
  vehicleId: string | null;
  startedAt: string;
  /** When the last checkpoint was written, used as the end time on recovery. */
  lastSeenAt: string;
  distanceM: number;
  maxSpeedKph: number;
  route: { latitude: number; longitude: number }[];
  cells: Cell[];
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------

export async function loadPendingTrips(): Promise<PendingTrip[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingTrip[]) : [];
  } catch {
    // Corrupt storage shouldn't stop the app loading. An empty queue is a
    // normal state, so it's treated as one.
    return [];
  }
}

async function writeQueue(trips: PendingTrip[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trips));
}

export async function queueTrip(input: RecordTripInput): Promise<PendingTrip> {
  const pending: PendingTrip = {
    ...input,
    // The stored route is simplified: the distance and top speed were already
    // worked out while driving, so the full point list is only needed for
    // drawing the line and would otherwise be hundreds of kilobytes.
    route: simplifyRoute(input.route),
    id: newId(),
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };

  const queue = await loadPendingTrips();
  await writeQueue([...queue, pending]);
  return pending;
}

export async function removePendingTrip(id: string): Promise<void> {
  const queue = await loadPendingTrips();
  await writeQueue(queue.filter((trip) => trip.id !== id));
}

export async function updatePendingTrip(
  id: string,
  changes: Partial<Pick<PendingTrip, 'attempts' | 'stuck' | 'vehicleId'>>,
): Promise<void> {
  const queue = await loadPendingTrips();
  await writeQueue(queue.map((trip) => (trip.id === id ? { ...trip, ...changes } : trip)));
}

// ---------------------------------------------------------------------------
// The checkpoint of a drive in progress
// ---------------------------------------------------------------------------

export async function saveDraft(draft: TripDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...draft, route: simplifyRoute(draft.route) }),
    );
  } catch {
    // A failed checkpoint must never interrupt the drive being recorded.
  }
}

export async function loadDraft(): Promise<TripDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TripDraft;
    return parsed.startedAt && Array.isArray(parsed.route) ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing useful to do; a stale draft is recovered from, not fatal.
  }
}

/** The shortest drive worth keeping, matching the live recorder's own rule. */
const MIN_RECOVERABLE_M = 50;

/**
 * Turns a checkpoint left behind by a crash into a drive waiting to upload.
 * Returns null when there was nothing worth recovering.
 */
export async function recoverDraft(): Promise<PendingTrip | null> {
  const draft = await loadDraft();
  await clearDraft();

  if (!draft || draft.route.length < 2 || draft.distanceM < MIN_RECOVERABLE_M) return null;

  const startedAt = new Date(draft.startedAt).getTime();
  const endedAt = new Date(draft.lastSeenAt).getTime();

  return queueTrip({
    vehicleId: draft.vehicleId,
    startedAt: draft.startedAt,
    endedAt: draft.lastSeenAt,
    distanceM: Math.round(draft.distanceM),
    // The clock may have moved oddly across a crash, so the duration is
    // clamped to at least a second rather than trusted blindly.
    durationS: Math.max(1, Math.round((endedAt - startedAt) / 1000)),
    maxSpeedKph: draft.maxSpeedKph,
    route: draft.route,
    cells: draft.cells,
  });
}
