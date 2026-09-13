/**
 * Profile and city queries against Supabase.
 *
 * Security note: these queries don't need an "only my row" check in the app. Row Level
 * Security policies in the database (see supabase/migrations) already block reading or
 * editing anyone else's profile, even if someone tampered with the app.
 */
import { supabase } from '@/services/supabase/client';
import type { Tables } from '@/types/database';

export type Profile = Pick<Tables<'profiles'>, 'id' | 'display_name' | 'home_city_id'>;
export type City = Pick<Tables<'cities'>, 'id' | 'name'>;

const PROFILE_COLUMNS = 'id, display_name, home_city_id';

export async function fetchMyProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyProfile(
  userId: string,
  changes: { display_name: string; home_city_id: string },
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(changes)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/** Cities users can pick as home. Adding a launch city is just a new row in the database. */
export async function fetchActiveCities(): Promise<City[]> {
  const { data, error } = await supabase
    .from('cities')
    .select('id, name')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data;
}
