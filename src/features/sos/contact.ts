/**
 * The one person you'd want reached if something went wrong.
 *
 * This is kept on the phone and nowhere else, on purpose. It is somebody
 * else's name and phone number — a partner, a parent, a friend — and they
 * never agreed to being in our database. Storing it on the server would make
 * us the custodian of a third party's personal details for no benefit: the
 * number is only ever used to build a message on this device.
 *
 * The cost of that choice is honest and worth stating: it doesn't follow you to
 * a new phone, and reinstalling the app loses it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'sos.emergency-contact.v1';

export type EmergencyContact = {
  name: string;
  /** Ten national digits, no country code. See src/lib/phone.ts. */
  phone: string;
};

export async function loadEmergencyContact(): Promise<EmergencyContact | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'name' in parsed &&
      'phone' in parsed &&
      typeof parsed.name === 'string' &&
      typeof parsed.phone === 'string'
    ) {
      return { name: parsed.name, phone: parsed.phone };
    }
    return null;
  } catch {
    // Unreadable or corrupt storage shouldn't stop the screen from loading.
    // Not having a contact saved is a normal state, so it's treated as one.
    return null;
  }
}

export async function saveEmergencyContact(contact: EmergencyContact): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(contact));
}

export async function clearEmergencyContact(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
