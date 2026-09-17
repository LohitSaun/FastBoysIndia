/**
 * Device settings. Right now that means Data Saver.
 *
 * Mobile data in India is cheap but not unlimited, and a lot of people drive on
 * a fixed daily pack. Data Saver is a promise that the app won't quietly spend
 * it: no video plays until you ask for it, car photos load on tap rather than
 * on sight, and the background checks slow down.
 *
 * It's in Redux rather than the database because it's a choice about this
 * phone, and it has to be readable the instant a screen renders. It is mirrored
 * into device storage so it survives the app closing (see ./storage.ts).
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { RootState } from '@/store';

type SettingsState = {
  dataSaver: boolean;
  /** False until the saved value has been read back off the phone. */
  loaded: boolean;
};

const initialState: SettingsState = {
  dataSaver: false,
  loaded: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    dataSaverToggled(state) {
      state.dataSaver = !state.dataSaver;
    },
    /** Applied once at startup with whatever was saved last time. */
    settingsRestored(state, action: PayloadAction<{ dataSaver: boolean }>) {
      state.dataSaver = action.payload.dataSaver;
      state.loaded = true;
    },
  },
});

export const { dataSaverToggled, settingsRestored } = settingsSlice.actions;
export const settingsReducer = settingsSlice.reducer;

export const selectDataSaver = (state: RootState) => state.settings.dataSaver;

// ---------------------------------------------------------------------------
// What Data Saver actually changes
//
// Kept here, next to the switch, so the effects of turning it on can be read in
// one place instead of being hunted for across screens.
// ---------------------------------------------------------------------------

/** How often nearby hazards are re-checked while driving. */
export const HAZARD_STALE_MS = { normal: 60_000, saver: 5 * 60_000 } as const;

/** How many explored squares to draw at once. Each one is a shape to render. */
export const SQUARE_LIMIT = { normal: 2000, saver: 600 } as const;

/** How many feed posts to fetch per page. */
export const FEED_PAGE_SIZE = { normal: 10, saver: 5 } as const;

export function limitFor<T>(limits: { normal: T; saver: T }, dataSaver: boolean): T {
  return dataSaver ? limits.saver : limits.normal;
}
