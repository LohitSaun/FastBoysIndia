import { useEffect } from 'react';

import { useAppDispatch, useAppSelector } from '@/store';

import {
  dataSaverToggled,
  selectDataSaver,
  settingsRestored,
} from './settingsSlice';
import { loadSettings, saveSettings } from './storage';

/** Read Data Saver anywhere without caring how it's stored. */
export function useDataSaver(): boolean {
  return useAppSelector(selectDataSaver);
}

export function useToggleDataSaver() {
  const dispatch = useAppDispatch();
  const dataSaver = useAppSelector(selectDataSaver);

  return () => {
    // Redux first so the switch moves immediately; the phone catches up.
    dispatch(dataSaverToggled());
    void saveSettings({ dataSaver: !dataSaver });
  };
}

/**
 * Reads the saved settings back once at startup. Mounted by the root layout,
 * before any screen that cares about them renders.
 */
export function useRestoreSettings() {
  const dispatch = useAppDispatch();
  const loaded = useAppSelector((state) => state.settings.loaded);

  useEffect(() => {
    if (loaded) return;

    let cancelled = false;
    void loadSettings().then((settings) => {
      if (!cancelled) dispatch(settingsRestored(settings));
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, loaded]);
}
