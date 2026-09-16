/**
 * The maths behind the explored map.
 *
 * The world is cut into squares of 0.001 degrees. Near India that's about 110m
 * north to south and about 105m east to west, so roughly a city block. Any
 * square you drive through is unlocked forever.
 *
 * Note the naming: `x` counts latitude and `y` counts longitude, matching the
 * cell_x and cell_y columns in the database.
 */
export const CELL_SIZE_DEG = 0.001;

export type Cell = { x: number; y: number };

export function cellFor(latitude: number, longitude: number): Cell {
  return {
    x: Math.floor(latitude / CELL_SIZE_DEG),
    y: Math.floor(longitude / CELL_SIZE_DEG),
  };
}

export function cellKey(cell: Cell): string {
  return `${cell.x}:${cell.y}`;
}

/** The corners of a square, for drawing it on the map. */
export function cellCorners(cell: Cell) {
  const south = cell.x * CELL_SIZE_DEG;
  const west = cell.y * CELL_SIZE_DEG;
  const north = south + CELL_SIZE_DEG;
  const east = west + CELL_SIZE_DEG;

  return [
    { latitude: south, longitude: west },
    { latitude: north, longitude: west },
    { latitude: north, longitude: east },
    { latitude: south, longitude: east },
  ];
}

const EARTH_RADIUS_M = 6_371_000;

/** Distance between two points in metres, allowing for the curve of the earth. */
export function distanceBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

/** Keep the shape of a drive, but drop points that add nothing. */
export function simplifyRoute(
  points: { latitude: number; longitude: number }[],
  minGapMetres = 25,
  maxPoints = 1000,
): { latitude: number; longitude: number }[] {
  if (points.length <= 2) return points;

  const kept = [points[0]];
  for (const point of points.slice(1, -1)) {
    if (distanceBetween(kept[kept.length - 1], point) >= minGapMetres) kept.push(point);
  }
  kept.push(points[points.length - 1]);

  // Very long drives get thinned evenly rather than truncated, so the shape survives.
  if (kept.length <= maxPoints) return kept;
  const step = Math.ceil(kept.length / maxPoints);
  const thinned = kept.filter((_, index) => index % step === 0);
  if (thinned[thinned.length - 1] !== kept[kept.length - 1]) thinned.push(kept[kept.length - 1]);
  return thinned;
}

/** Metres into something a person reads: "800 m" or "12.4 km". */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** Seconds into "9m" or "1h 12m". */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
