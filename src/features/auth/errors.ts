import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

/**
 * Turns a Supabase auth error into a message a user can act on.
 * Supabase's own messages (e.g. "Token has expired or is invalid") are written for developers.
 */
export function getAuthErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) {
    return 'No internet connection. Check your signal and try again.';
  }

  if (isAuthError(error)) {
    switch (error.code) {
      case 'otp_expired':
        return 'That code is wrong or has expired. Check the SMS or request a new code.';
      case 'over_sms_send_rate_limit':
      case 'over_request_rate_limit':
        return 'Too many attempts. Please wait a minute and try again.';
      case 'sms_send_failed':
        return "We couldn't send the SMS. Check the number and try again.";
      case 'phone_provider_disabled':
        return 'Phone sign-in is not switched on for this Supabase project yet.';
    }
    if (error.status === 429) {
      return 'Too many attempts. Please wait a minute and try again.';
    }
  }

  return 'Something went wrong. Please try again.';
}
