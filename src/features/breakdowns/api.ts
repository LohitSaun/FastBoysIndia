/**
 * Breakdown alerts during a convoy.
 *
 * Reading goes through the breakdowns_for_convoy database function rather than
 * the table, because the function checks crew membership, pulls the latitude
 * and longitude out of the geography column, and joins the driver's name in one
 * step.
 */
import { supabase } from '@/services/supabase/client';

export type BreakdownAlert = {
  id: string;
  userId: string;
  displayName: string | null;
  latitude: number;
  longitude: number;
  note: string | null;
  createdAt: string;
  isYou: boolean;
};

/**
 * The choices offered when reporting. Kept to four so the dialog stays one
 * glance rather than a list to read while standing on a hard shoulder.
 */
export const BREAKDOWN_REASONS = [
  'Flat tyre',
  'Out of fuel',
  'Engine trouble',
  'Accident',
] as const;

export const NOTE_MAX_LENGTH = 120;

export async function fetchBreakdowns(convoyId: string): Promise<BreakdownAlert[]> {
  const { data, error } = await supabase.rpc('breakdowns_for_convoy', {
    p_convoy_id: convoyId,
  });
  if (error) throw error;

  const rows = (data ?? []) as {
    id: string | null;
    user_id: string | null;
    display_name: string | null;
    latitude: number | null;
    longitude: number | null;
    note: string | null;
    created_at: string | null;
    is_you: boolean | null;
  }[];

  return rows
    .filter((row) => row.id && row.latitude !== null && row.longitude !== null)
    .map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      displayName: row.display_name,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      note: row.note,
      createdAt: row.created_at ?? new Date().toISOString(),
      isYou: row.is_you ?? false,
    }));
}

export async function reportBreakdown(
  convoyId: string,
  latitude: number,
  longitude: number,
  note: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('report_breakdown', {
    p_convoy_id: convoyId,
    p_latitude: latitude,
    p_longitude: longitude,
    // The generated types mark every function argument as required, because
    // they can't tell which ones accept null. A note is optional.
    p_note: note as string,
  });
  if (error) throw error;
  return data;
}

/**
 * Marking yourself sorted. This is a plain update, not a function, because the
 * table's own rules already limit it to your own row.
 */
export async function resolveBreakdown(breakdownId: string): Promise<void> {
  const { error } = await supabase
    .from('breakdowns')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', breakdownId);
  if (error) throw error;
}
