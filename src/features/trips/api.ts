/**
 * Drives and the explored map.
 *
 * Saving a drive goes through one database function so the drive and the
 * squares it unlocked are written together, never half of each.
 */
import { supabase } from '@/services/supabase/client';
import type { Tables } from '@/types/database';

import type { Cell } from './grid';

export type Trip = Tables<'trips'>;

export type TripStats = {
  trips: number;
  total_distance_m: number;
  total_duration_s: number;
  best_speed_kph: number;
};

export type RecordTripInput = {
  vehicleId: string | null;
  startedAt: string;
  endedAt: string;
  distanceM: number;
  durationS: number;
  maxSpeedKph: number;
  route: { latitude: number; longitude: number }[];
  cells: Cell[];
};

export async function recordTrip(input: RecordTripInput): Promise<string> {
  // GeoJSON puts longitude first, which is the opposite of how people say it.
  const routeGeoJson =
    input.route.length >= 2
      ? {
          type: 'LineString',
          coordinates: input.route.map((point) => [point.longitude, point.latitude]),
        }
      : null;

  const { data, error } = await supabase.rpc('record_trip', {
    // The generated types mark every database function argument as required,
    // because they can't tell which ones accept null. Recording a drive without
    // choosing a car is allowed, so this one really can be null.
    p_vehicle_id: input.vehicleId as string,
    p_started_at: input.startedAt,
    p_ended_at: input.endedAt,
    p_distance_m: input.distanceM,
    p_duration_s: input.durationS,
    p_max_speed_kph: input.maxSpeedKph,
    p_route_geojson: routeGeoJson,
    p_cells: input.cells.map((cell) => [cell.x, cell.y]),
  });
  if (error) throw error;
  return data;
}

export async function fetchTrips(limit = 50): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function fetchTripStats(): Promise<TripStats> {
  const { data, error } = await supabase
    .from('my_trip_stats')
    .select('trips, total_distance_m, total_duration_s, best_speed_kph')
    .maybeSingle();
  if (error) throw error;

  return {
    trips: data?.trips ?? 0,
    total_distance_m: Number(data?.total_distance_m ?? 0),
    total_duration_s: Number(data?.total_duration_s ?? 0),
    best_speed_kph: data?.best_speed_kph ?? 0,
  };
}

export async function fetchExploredCount(): Promise<number> {
  const { data, error } = await supabase.from('my_explored_stats').select('squares').maybeSingle();
  if (error) throw error;
  return data?.squares ?? 0;
}

/**
 * The squares inside the part of the map currently on screen. Capped, because
 * drawing thousands of shapes would bring the map to a crawl.
 */
export async function fetchSquaresInView(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  limit = 2000,
): Promise<Cell[]> {
  const { data, error } = await supabase
    .from('explored_squares')
    .select('cell_x, cell_y')
    .gte('cell_x', bounds.minX)
    .lte('cell_x', bounds.maxX)
    .gte('cell_y', bounds.minY)
    .lte('cell_y', bounds.maxY)
    .limit(limit);
  if (error) throw error;
  return data.map((row) => ({ x: row.cell_x, y: row.cell_y }));
}

export async function deleteTrip(tripId: string): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', tripId);
  if (error) throw error;
}

/** Wipes the explored map. The drives themselves are kept. */
export async function eraseExploredMap(userId: string): Promise<void> {
  const { error } = await supabase.from('explored_squares').delete().eq('user_id', userId);
  if (error) throw error;
}
