/**
 * Redux slice for auth state on THIS device.
 *
 * Why Redux and not TanStack Query? This isn't a row in our database. It's
 * "is someone signed in on this phone right now?", and lots of the app reacts to it
 * instantly: the navigation gate now, live location sharing in Phase 3.
 *
 * What we deliberately DON'T store here: the session tokens. The Supabase client
 * already saves and refreshes those. Copying them into Redux would give us two
 * copies that could drift apart.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// Type-only import: erased at runtime, so there's no circular import with the store.
import type { RootState } from '@/store';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthState = {
  /** 'loading' until Supabase has checked for a saved session on startup. */
  status: AuthStatus;
  userId: string | null;
  /** As Supabase returns it: digits only, e.g. "919876543210". */
  phone: string | null;
  /**
   * The number we just sent a code to, kept between the sign-in and verify screens.
   * Stored here rather than in the route URL so the phone number never ends up in
   * navigation history, logs or analytics.
   */
  pendingPhone: string | null;
};

const initialState: AuthState = {
  status: 'loading',
  userId: null,
  phone: null,
  pendingPhone: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Dispatched by useAuthListener whenever Supabase reports a new session (or none). */
    sessionChanged(state, action: PayloadAction<{ userId: string; phone: string | null } | null>) {
      if (action.payload) {
        state.status = 'signedIn';
        state.userId = action.payload.userId;
        state.phone = action.payload.phone;
      } else {
        state.status = 'signedOut';
        state.userId = null;
        state.phone = null;
        state.pendingPhone = null;
      }
    },
    /** The OTP was sent; remember which number for the verify screen. */
    otpRequested(state, action: PayloadAction<string>) {
      state.pendingPhone = action.payload;
    },
  },
});

export const { sessionChanged, otpRequested } = authSlice.actions;
export const authReducer = authSlice.reducer;

export const selectAuthStatus = (state: RootState) => state.auth.status;
export const selectUserId = (state: RootState) => state.auth.userId;
export const selectPhone = (state: RootState) => state.auth.phone;
export const selectPendingPhone = (state: RootState) => state.auth.pendingPhone;
