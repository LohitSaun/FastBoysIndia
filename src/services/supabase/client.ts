/**
 * The one Supabase client for the whole app.
 *
 * Always import `supabase` from here and never call createClient() anywhere else.
 * One client means one login session, one realtime connection (Phase 3), and one
 * place to change settings.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    // Where the login session is saved on the phone, so users stay signed in after
    // closing the app.
    storage: AsyncStorage,
    persistSession: true,
    // Access tokens expire after about an hour; this renews them automatically.
    autoRefreshToken: true,
    // Only used for web redirect logins (magic links, OAuth). Not relevant for phone OTP.
    detectSessionInUrl: false,
  },
});

// Token renewal runs on a timer. Phones pause apps in the background, so we pause the
// timer too and restart it when the app returns to the foreground.
// (This is Supabase's recommended setup for React Native.)
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
