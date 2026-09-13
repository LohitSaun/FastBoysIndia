/**
 * TanStack Query hooks for the signed-in user's profile and the city list.
 */
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectUserId } from '@/features/auth/authSlice';
import { analytics } from '@/services/monitoring/analytics';
import { useAppSelector } from '@/store';

import { fetchActiveCities, fetchMyProfile, updateMyProfile, type Profile } from './api';

/**
 * Query keys name each piece of cached data. Keeping them in one object avoids
 * typos like ['profile'] in one file and ['profiles'] in another.
 */
export const profileKeys = {
  me: (userId: string | null) => ['profile', userId] as const,
  activeCities: ['cities', 'active'] as const,
};

export function useMyProfile() {
  const userId = useAppSelector(selectUserId);
  return useQuery({
    queryKey: profileKeys.me(userId),
    // skipToken = "don't run this query yet" (nobody is signed in).
    queryFn: userId ? () => fetchMyProfile(userId) : skipToken,
  });
}

/** Onboarding is done once the user has a display name and a home city. */
export function isProfileComplete(profile: Profile | undefined): boolean {
  return Boolean(profile?.display_name && profile.home_city_id);
}

export function useActiveCities() {
  return useQuery({
    queryKey: profileKeys.activeCities,
    queryFn: fetchActiveCities,
    // The city list almost never changes, so keep it for an hour.
    staleTime: 60 * 60 * 1000,
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  const userId = useAppSelector(selectUserId);

  return useMutation({
    mutationFn: (input: { displayName: string; homeCityId: string }) => {
      if (!userId) throw new Error('Not signed in');
      return updateMyProfile(userId, {
        display_name: input.displayName.trim(),
        home_city_id: input.homeCityId,
      });
    },
    onSuccess: (profile) => {
      // Put the saved profile straight into the cache. The root layout sees a complete
      // profile and switches to the main tabs, with no refetch or manual navigation.
      queryClient.setQueryData(profileKeys.me(profile.id), profile);
      analytics.track('signed_up', { home_city: profile.home_city_id ?? 'unknown' });
    },
    onError: (error) => {
      if (__DEV__) console.warn('[onboarding]', error);
    },
  });
}
