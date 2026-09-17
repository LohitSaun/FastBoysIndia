/**
 * Leaderboards: who has driven the most, in a city or in a crew.
 *
 * Both boards come out of database functions rather than queries, because
 * ranking people means reading everyone's drives. Those tables stay private;
 * the functions return only what a board shows (name, main car, totals) and
 * never a route, a square or a timestamp of where somebody was.
 *
 * See supabase/migrations/20260917060000_leaderboards.sql.
 */
import { supabase } from '@/services/supabase/client';

/** 'all' for all time, or a month like '2026-09'. The database validates this too. */
export type LeaderboardPeriod = 'all' | (string & {});

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  mainCar: string | null;
  distanceM: number;
  squares: number;
  trips: number;
  isYou: boolean;
};

/** The current month as the database wants it: '2026-09'. */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * The rows arrive as a Postgres composite type, so every field is typed as
 * nullable even though the function always fills them in. This turns them into
 * the shape the screen actually wants, and drops anyone without a name.
 */
function toEntries(rows: unknown): LeaderboardEntry[] {
  const raw = (rows ?? []) as {
    user_id: string | null;
    display_name: string | null;
    main_car: string | null;
    distance_m: number | null;
    squares: number | null;
    trips: number | null;
    is_you: boolean | null;
  }[];

  return raw
    .filter((row) => row.user_id && row.display_name)
    .map((row) => ({
      userId: row.user_id as string,
      displayName: row.display_name as string,
      mainCar: row.main_car,
      // distance_m is a bigint, which can come back as a string in JSON.
      distanceM: Math.round(Number(row.distance_m ?? 0)),
      squares: row.squares ?? 0,
      trips: row.trips ?? 0,
      isYou: row.is_you ?? false,
    }));
}

export async function fetchCityLeaderboard(
  cityId: string,
  period: LeaderboardPeriod,
  limit = 100,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('leaderboard_for_city', {
    p_city_id: cityId,
    p_period: period,
    p_limit: limit,
  });
  if (error) throw error;
  return toEntries(data);
}

export async function fetchCrewLeaderboard(
  crewId: string,
  period: LeaderboardPeriod,
  limit = 100,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('leaderboard_for_crew', {
    p_crew_id: crewId,
    p_period: period,
    p_limit: limit,
  });
  if (error) throw error;
  return toEntries(data);
}
