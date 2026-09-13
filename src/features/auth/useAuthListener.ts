import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { analytics } from '@/services/monitoring/analytics';
import { setMonitoringUser } from '@/services/monitoring/sentry';
import { supabase } from '@/services/supabase/client';
import { useAppDispatch } from '@/store';

import { sessionChanged } from './authSlice';

/**
 * Keeps Redux in sync with Supabase's login state. Used once, in app/_layout.tsx.
 *
 * Supabase calls our callback:
 *  - right away on startup, with the saved session or null (this ends the 'loading' state)
 *  - after verifyOtp succeeds (signed in)
 *  - after sign-out, or if the saved session is no longer valid (signed out)
 *  - every time it silently refreshes the token (same user, so nothing visibly changes)
 */
export function useAuthListener() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep this callback quick and synchronous. Supabase warns that awaiting other
      // supabase calls in here can deadlock the auth client.
      const user = session?.user ?? null;

      dispatch(sessionChanged(user ? { userId: user.id, phone: user.phone ?? null } : null));
      setMonitoringUser(user?.id ?? null);

      if (event === 'SIGNED_OUT') {
        // Drop cached data from the previous account so the next person can't see it.
        queryClient.clear();
        analytics.reset();
      } else if (user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        analytics.identify(user.id);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [dispatch, queryClient]);
}
