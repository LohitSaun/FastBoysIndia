/**
 * The one place the app gets location from.
 *
 * Screens import `locationTracker` and never talk to a location library
 * directly. When the paid background tracker is licensed, write a second
 * tracker and change the line below; nothing else has to change.
 */
import { expoLocationTracker } from './expoLocationTracker';
import { createSimulatedTracker } from './simulatedTracker';
import type { LocationTracker } from './types';

export const locationTracker: LocationTracker = expoLocationTracker;

/**
 * A pretend drive through Mumbai, for testing from a desk. Screens only offer
 * this while developing; `__DEV__` is false in a real build.
 */
export const simulatedTracker: LocationTracker = createSimulatedTracker();

/** Pick which source to use. */
export function trackerFor(simulated: boolean): LocationTracker {
  return simulated && __DEV__ ? simulatedTracker : locationTracker;
}

export type { DrivePosition, LocationPermission, LocationTracker } from './types';
