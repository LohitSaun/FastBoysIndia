import * as Location from 'expo-location';

import type { DrivePosition, LocationTracker } from './types';

/** metres per second → kilometres per hour */
function toKph(metresPerSecond: number | null): number | null {
  if (metresPerSecond === null || metresPerSecond < 0) return null;
  return Math.round(metresPerSecond * 3.6);
}

/**
 * Location while the app is open, using Expo's own location package.
 *
 * This is the stand-in for the paid background tracker. It works in Expo Go and
 * needs no licence, but stops updating when the app is backgrounded. Swapping
 * in the real one later means writing another file like this and changing the
 * single line in ./index.ts.
 */
export const expoLocationTracker: LocationTracker = {
  async requestPermission() {
    const result = await Location.requestForegroundPermissionsAsync();
    return result.granted ? 'granted' : 'denied';
  },

  async watch(onPosition) {
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.LocationAccuracy.High,
        // A reading every 3 seconds or 10 metres, whichever comes first. Often
        // enough to look live, rarely enough to be kind to the battery.
        timeInterval: 3000,
        distanceInterval: 10,
      },
      (location) => {
        const position: DrivePosition = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          speedKph: toKph(location.coords.speed),
          heading: location.coords.heading,
          timestamp: location.timestamp,
        };
        onPosition(position);
      },
    );

    return () => subscription.remove();
  },
};
