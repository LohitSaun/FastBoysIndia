/**
 * Hazards: potholes, waterlogging, fog and speed cameras.
 *
 * Every read goes through the hazards_near database function rather than the
 * table, because the table holds who reported each one and that is never shown
 * to anybody. The same function also enforces the paid gate on speed cameras.
 */
import { supabase } from '@/services/supabase/client';

export const HAZARD_KINDS = ['pothole', 'waterlogging', 'fog', 'speed_camera', 'other'] as const;
export type HazardKind = (typeof HAZARD_KINDS)[number];

export const HAZARD_LABELS: Record<HazardKind, string> = {
  pothole: 'Pothole',
  waterlogging: 'Waterlogging',
  fog: 'Fog',
  speed_camera: 'Speed camera',
  other: 'Something else',
};

/** Ionicons names, so the map and the list agree on what each one looks like. */
export const HAZARD_ICONS: Record<HazardKind, string> = {
  pothole: 'alert-circle',
  waterlogging: 'water',
  fog: 'cloudy',
  speed_camera: 'camera',
  other: 'warning',
};

export type NearbyHazard = {
  id: string;
  kind: HazardKind;
  latitude: number;
  longitude: number;
  note: string | null;
  created_at: string;
  gone_votes: number;
  metres_away: number;
  reported_by_you: boolean;
};

export type Tier = 'free' | 'pro' | 'premium';

export async function fetchTier(): Promise<Tier> {
  const { data, error } = await supabase.rpc('current_tier');
  if (error) throw error;
  return (data as Tier) ?? 'free';
}

export async function fetchHazardsNear(
  latitude: number,
  longitude: number,
  radiusM = 5000,
  includeCameras = true,
): Promise<NearbyHazard[]> {
  const { data, error } = await supabase.rpc('hazards_near', {
    p_latitude: latitude,
    p_longitude: longitude,
    p_radius_m: radiusM,
    p_include_cameras: includeCameras,
  });
  if (error) throw error;
  return (data ?? []) as NearbyHazard[];
}

export async function reportHazard(
  kind: HazardKind,
  latitude: number,
  longitude: number,
  note: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('report_hazard', {
    p_kind: kind,
    p_latitude: latitude,
    p_longitude: longitude,
    p_note: note as string,
  });
  if (error) throw error;
  return data;
}

export async function voteHazard(hazardId: string, vote: 'still_there' | 'gone'): Promise<void> {
  const { error } = await supabase.rpc('vote_hazard', { p_hazard_id: hazardId, p_vote: vote });
  if (error) throw error;
}
