/**
 * Auth calls to Supabase.
 * Screens don't call these directly; they use the hooks in ./hooks.ts, which add
 * loading and error state.
 */
import { supabase } from '@/services/supabase/client';

/**
 * Texts a 6-digit code. `phone` must be E.164, e.g. "+919876543210".
 * This one call covers both sign-up and sign-in: if the number is new,
 * Supabase creates the account when the code is verified.
 */
export async function sendOtp(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
}

/**
 * Checks the code. On success Supabase saves the session and fires onAuthStateChange,
 * which useAuthListener turns into a Redux update, and the navigation gate does the rest.
 */
export async function verifyOtp(phone: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
