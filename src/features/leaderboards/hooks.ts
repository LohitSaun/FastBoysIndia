import { skipToken, useQuery } from '@tanstack/react-query';

import {
  fetchCityLeaderboard,
  fetchCrewLeaderboard,
  type LeaderboardPeriod,
} from './api';

export const leaderboardKeys = {
  city: (cityId: string, period: LeaderboardPeriod) => ['leaderboard', 'city', cityId, period] as const,
  crew: (crewId: string, period: LeaderboardPeriod) => ['leaderboard', 'crew', crewId, period] as const,
};

/**
 * Boards are recalculated from everyone's drives, which isn't cheap, and they
 * barely move minute to minute. Two minutes of staleness keeps the screen
 * instant when you flick between City and My crew.
 */
const STALE_TIME = 2 * 60 * 1000;

export function useCityLeaderboard(cityId: string | null | undefined, period: LeaderboardPeriod) {
  return useQuery({
    queryKey: leaderboardKeys.city(cityId ?? 'none', period),
    // skipToken = "nothing to fetch yet" (we don't know the city).
    queryFn: cityId ? () => fetchCityLeaderboard(cityId, period) : skipToken,
    staleTime: STALE_TIME,
  });
}

export function useCrewLeaderboard(crewId: string | null | undefined, period: LeaderboardPeriod) {
  return useQuery({
    queryKey: leaderboardKeys.crew(crewId ?? 'none', period),
    queryFn: crewId ? () => fetchCrewLeaderboard(crewId, period) : skipToken,
    staleTime: STALE_TIME,
  });
}
