/**
 * Convoy data. Note what's missing here: positions. Those never touch the
 * database; they travel over Realtime and vanish when the drive ends.
 */
import { supabase } from '@/services/supabase/client';
import type { Tables } from '@/types/database';

export type Convoy = Tables<'convoys'>;

export type ConvoyParticipant = {
  userId: string;
  displayName: string | null;
  joinedAt: string;
};

/** The crew's convoy that hasn't ended yet, if there is one. */
export async function fetchActiveConvoy(crewId: string): Promise<Convoy | null> {
  const { data, error } = await supabase
    .from('convoys')
    .select('*')
    .eq('crew_id', crewId)
    .is('ended_at', null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function startConvoy(crewId: string, userId: string): Promise<Convoy> {
  const { data, error } = await supabase
    .from('convoys')
    .insert({ crew_id: crewId, started_by: userId })
    .select('*')
    .single();
  if (error) throw error;

  await joinConvoy(data.id, userId);
  return data;
}

export async function joinConvoy(convoyId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('convoy_participants')
    .upsert({ convoy_id: convoyId, user_id: userId, left_at: null }, { onConflict: 'convoy_id,user_id' });
  if (error) throw error;
}

export async function leaveConvoy(convoyId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('convoy_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('convoy_id', convoyId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function endConvoy(convoyId: string): Promise<void> {
  const { error } = await supabase
    .from('convoys')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', convoyId);
  if (error) throw error;
}

/** Who has joined this drive, with their names. */
export async function fetchParticipants(convoyId: string): Promise<ConvoyParticipant[]> {
  const { data: rows, error } = await supabase
    .from('convoy_participants')
    .select('*')
    .eq('convoy_id', convoyId)
    .is('left_at', null)
    .order('joined_at');
  if (error) throw error;
  if (rows.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', rows.map((row) => row.user_id));

  const nameByUser = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return rows.map((row) => ({
    userId: row.user_id,
    displayName: nameByUser.get(row.user_id) ?? null,
    joinedAt: row.joined_at,
  }));
}
