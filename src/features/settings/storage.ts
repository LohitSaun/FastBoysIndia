/**
 * Making the settings survive the app closing.
 *
 * Redux is memory only, so without this Data Saver would switch itself off
 * every time the app restarts — which is exactly the moment somebody on a
 * limited pack would not notice it had.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'settings.v1';

export type StoredSettings = { dataSaver: boolean };

export async function loadSettings(): Promise<StoredSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { dataSaver: false };

    const parsed: unknown = JSON.parse(raw);
    const dataSaver =
      typeof parsed === 'object' && parsed !== null && 'dataSaver' in parsed
        ? Boolean(parsed.dataSaver)
        : false;
    return { dataSaver };
  } catch {
    // Unreadable storage falls back to off, which is the normal default rather
    // than a surprising one.
    return { dataSaver: false };
  }
}

export async function saveSettings(settings: StoredSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not worth interrupting anyone over; the switch still works this session.
  }
}
