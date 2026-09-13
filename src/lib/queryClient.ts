/**
 * TanStack Query setup: the cache for everything we fetch from Supabase.
 */
import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Treat fetched data as fresh for 30s so switching tabs doesn't refetch constantly.
      staleTime: 30_000,
      // Retry failed reads twice (mobile data is patchy) instead of the default three.
      retry: 2,
    },
  },
});

// In a browser, TanStack Query refetches stale data when the tab regains focus.
// Phones have no "tab focus", so we signal it when the app returns to the foreground.
// (Handling offline/online properly comes with offline-first work in Phase 6.)
AppState.addEventListener('change', (state) => {
  focusManager.setFocused(state === 'active');
});
