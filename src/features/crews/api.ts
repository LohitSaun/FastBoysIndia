/**
 * Crew data: the crews you're in, who's in them, and joining by code.
 *
 * As with the garage, these queries don't filter by user. The database's rules
 * already limit every read and write to crews you belong to.
 */
import { supabase } from '@/services/supabase/client';
import type { Tables } from '@/types/database';

export type Crew = Tables<'crews'>;
export type CrewMemberRow = Tables<'crew_members'>;

/** A member of a crew, with the bits we're allowed to show about them. */
export type CrewMember = {
  userId: string;
  role: string;
  joinedAt: string;
  displayName: string | null;
  mainCar: string | null;
};

export async function fetchMyCrews(): Promise<Crew[]> {
  const { data, error } = await supabase.from('crews').select('*').order('created_at');
  if (error) throw error;
  return data;
}

export async function fetchCrew(crewId: string): Promise<Crew> {
  const { data, error } = await supabase.from('crews').select('*').eq('id', crewId).single();
  if (error) throw error;
  return data;
}

export async function createCrew(
  ownerId: string,
  input: { name: string; city_id: string },
): Promise<Crew> {
  const { data, error } = await supabase
    .from('crews')
    .insert({ owner_id: ownerId, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function renameCrew(crewId: string, name: string): Promise<Crew> {
  const { data, error } = await supabase
    .from('crews')
    .update({ name })
    .eq('id', crewId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCrew(crewId: string): Promise<void> {
  const { error } = await supabase.from('crews').delete().eq('id', crewId);
  if (error) throw error;
}

/** Returns the crew's id. The database function checks the code and adds you. */
export async function joinCrewByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_crew_by_code', { code });
  if (error) throw error;
  return data;
}

export async function leaveCrew(crewId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('crew_members')
    .delete()
    .eq('crew_id', crewId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Members, with each person's name and main car.
 *
 * This is three small queries rather than one joined query: membership rows,
 * then profiles, then main cars. Crew mates are allowed to read exactly those
 * three things about each other and nothing more, which the database enforces.
 */
export async function fetchCrewMembers(crewId: string): Promise<CrewMember[]> {
  const { data: rows, error } = await supabase
    .from('crew_members')
    .select('*')
    .eq('crew_id', crewId)
    .order('joined_at');
  if (error) throw error;
  if (rows.length === 0) return [];

  const userIds = rows.map((row) => row.user_id);

  const [{ data: profiles }, { data: cars }] = await Promise.all([
    supabase.from('profiles').select('id, display_name').in('id', userIds),
    supabase.from('vehicles').select('owner_id, make, model, nickname').in('owner_id', userIds).eq('is_primary', true),
  ]);

  const nameByUser = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const carByUser = new Map(
    (cars ?? []).map((car) => [car.owner_id, car.nickname ?? `${car.make} ${car.model}`]),
  );

  return rows.map((row) => ({
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    displayName: nameByUser.get(row.user_id) ?? null,
    mainCar: carByUser.get(row.user_id) ?? null,
  }));
}

export async function removeMember(crewId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('crew_members')
    .delete()
    .eq('crew_id', crewId)
    .eq('user_id', userId);
  if (error) throw error;
}
