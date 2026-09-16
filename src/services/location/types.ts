/**
 * The app's idea of "where someone is". Deliberately small, so that swapping
 * the library underneath doesn't ripple through the screens.
 */
export type DrivePosition = {
  latitude: number;
  longitude: number;
  /** Kilometres per hour, or null if the phone doesn't know yet. */
  speedKph: number | null;
  /** Degrees clockwise from north, or null. */
  heading: number | null;
  /** Milliseconds since the epoch. */
  timestamp: number;
};

export type LocationPermission = 'granted' | 'denied';

export type LocationTracker = {
  requestPermission(): Promise<LocationPermission>;
  /** Where the phone is right now, for one-off needs like reporting a pothole. */
  current(): Promise<DrivePosition | null>;
  /**
   * Starts following the phone's location. Returns a function that stops it.
   * Only works while the app is open; background tracking comes later.
   */
  watch(onPosition: (position: DrivePosition) => void): Promise<() => void>;
};
