import type { DrivePosition, LocationTracker } from './types';

/**
 * A fake drive, for testing without leaving the room.
 *
 * It replays a real route through Mumbai — Bandra, across the Sea Link, down to
 * Worli — feeding positions through exactly the same interface the real GPS
 * uses, so the rest of the app can't tell the difference. The app is for India,
 * and this keeps testing there too, rather than filling the database with
 * wherever the developer happens to be sitting.
 *
 * Development only: the button that turns this on is hidden in real builds.
 */
const ROUTE: { latitude: number; longitude: number }[] = [
  { latitude: 19.0544, longitude: 72.8402 }, // Bandra Reclamation
  { latitude: 19.0470, longitude: 72.8266 },
  { latitude: 19.0418, longitude: 72.8214 }, // onto the Sea Link
  { latitude: 19.0345, longitude: 72.8180 },
  { latitude: 19.0290, longitude: 72.8175 },
  { latitude: 19.0225, longitude: 72.8190 },
  { latitude: 19.0170, longitude: 72.8206 }, // Worli
  { latitude: 19.0110, longitude: 72.8230 },
  { latitude: 19.0050, longitude: 72.8255 }, // towards Prabhadevi
];

/** How many steps to take between two points of the route. */
const STEPS_BETWEEN_POINTS = 12;
/** A position every second, like a phone on a real drive. */
const INTERVAL_MS = 1000;

function interpolate(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  fraction: number,
) {
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * fraction,
    longitude: from.longitude + (to.longitude - from.longitude) * fraction,
  };
}

function bearing(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const angle = Math.atan2(to.longitude - from.longitude, to.latitude - from.latitude);
  return Math.round(((angle * 180) / Math.PI + 360) % 360);
}

export function createSimulatedTracker(): LocationTracker {
  return {
    async requestPermission() {
      return 'granted'; // nothing real is being read
    },

    async watch(onPosition) {
      let leg = 0;
      let step = 0;

      const timer = setInterval(() => {
        const from = ROUTE[leg];
        const to = ROUTE[(leg + 1) % ROUTE.length];
        const point = interpolate(from, to, step / STEPS_BETWEEN_POINTS);

        const position: DrivePosition = {
          ...point,
          // Around city speeds, varying a little so it looks alive.
          speedKph: 45 + Math.round(Math.sin(step / 3) * 12),
          heading: bearing(from, to),
          timestamp: Date.now(),
        };
        onPosition(position);

        step += 1;
        if (step > STEPS_BETWEEN_POINTS) {
          step = 0;
          leg = (leg + 1) % (ROUTE.length - 1);
        }
      }, INTERVAL_MS);

      return () => clearInterval(timer);
    },
  };
}
