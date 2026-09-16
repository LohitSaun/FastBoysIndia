/**
 * The one place the app gets location from.
 *
 * Screens import `locationTracker` and never talk to a location library
 * directly. When the paid background tracker is licensed, write a second
 * tracker and change the line below; nothing else has to change.
 */
import { expoLocationTracker } from './expoLocationTracker';
import type { LocationTracker } from './types';

export const locationTracker: LocationTracker = expoLocationTracker;

export type { DrivePosition, LocationPermission, LocationTracker } from './types';
