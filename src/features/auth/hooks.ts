/**
 * React hooks for auth actions, built on TanStack Query's useMutation.
 *
 * A "mutation" is any call that changes something: send a code, sign in, sign out.
 * useMutation gives screens `isPending` (show a spinner) and `error` (show a message)
 * without writing that state by hand.
 */
import { useMutation } from '@tanstack/react-query';

import { analytics } from '@/services/monitoring/analytics';
import { useAppDispatch } from '@/store';

import { sendOtp, signOut, verifyOtp } from './api';
import { otpRequested } from './authSlice';

export function useSendOtp() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (phone: string) => sendOtp(phone),
    onSuccess: (_data, phone) => {
      dispatch(otpRequested(phone));
      analytics.track('otp_requested');
    },
    onError: logInDev,
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: ({ phone, token }: { phone: string; token: string }) => verifyOtp(phone, token),
    onSuccess: () => analytics.track('signed_in'),
    onError: logInDev,
  });
}

export function useSignOut() {
  return useMutation({
    mutationFn: signOut,
    onError: logInDev,
  });
}

// The user sees a friendly message; in development you also get the raw error in the terminal.
function logInDev(error: unknown) {
  if (__DEV__) console.warn('[auth]', error);
}
