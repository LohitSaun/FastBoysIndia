/**
 * Ghost Mode lives here rather than in the database on purpose: it's a choice
 * about this phone, right now, and the fastest possible switch. Turning it on
 * stops your position being sent at all, so there's nothing for anyone to see.
 */
import { createSlice } from '@reduxjs/toolkit';

import type { RootState } from '@/store';

type ConvoyState = {
  ghostMode: boolean;
};

const initialState: ConvoyState = {
  ghostMode: false,
};

const convoySlice = createSlice({
  name: 'convoy',
  initialState,
  reducers: {
    ghostModeToggled(state) {
      state.ghostMode = !state.ghostMode;
    },
    ghostModeReset(state) {
      state.ghostMode = false;
    },
  },
});

export const { ghostModeToggled, ghostModeReset } = convoySlice.actions;
export const convoyReducer = convoySlice.reducer;

export const selectGhostMode = (state: RootState) => state.convoy.ghostMode;
