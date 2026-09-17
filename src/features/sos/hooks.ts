import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Linking, Share } from 'react-native';

import { locationTracker, type DrivePosition } from '@/services/location';

import {
  clearEmergencyContact,
  loadEmergencyContact,
  saveEmergencyContact,
  type EmergencyContact,
} from './contact';
import {
  buildSosMessage,
  buildSosMessageWithoutLocation,
  whatsappLinkFor,
  type SosPosition,
} from './message';

export const sosKeys = {
  contact: ['sos-contact'] as const,
};

function logInDev(error: unknown) {
  if (__DEV__) console.warn('[sos]', error);
}

/**
 * The saved emergency contact. It lives in device storage rather than the
 * server (see contact.ts), but it's read through TanStack Query anyway so every
 * screen showing it updates together after a change.
 */
export function useEmergencyContact() {
  return useQuery({
    queryKey: sosKeys.contact,
    queryFn: loadEmergencyContact,
    staleTime: Infinity,
  });
}

export function useSaveEmergencyContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contact: EmergencyContact | null) =>
      contact ? saveEmergencyContact(contact) : clearEmergencyContact(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sosKeys.contact }),
    onError: logInDev,
  });
}

export type SosOutcome =
  | { sent: true; via: 'whatsapp' | 'share'; withLocation: boolean }
  | { sent: false; reason: 'cancelled' | 'failed' };

/**
 * Getting a position without ever throwing.
 *
 * `current()` asks the operating system directly and throws if permission was
 * never granted, so permission is requested first and the whole thing is
 * wrapped. An SOS must not fall over on its way to being sent.
 */
async function bestEffortPosition(known?: DrivePosition | null): Promise<SosPosition | null> {
  if (known) return known;

  try {
    const permission = await locationTracker.requestPermission();
    if (permission !== 'granted') return null;
    return await locationTracker.current();
  } catch (error) {
    logInDev(error);
    return null;
  }
}

/**
 * Sending an SOS.
 *
 * Nothing is sent by us and nothing is stored. The message is handed to
 * WhatsApp, or to the phone's own share sheet, and the person chooses who gets
 * it. That is a deliberate limit: a button that promised to summon help would
 * need to keep working with the app closed and the phone in a pocket, which
 * needs background execution and push notifications we don't have. Better an
 * honest "share my location" than a panic button that quietly fails.
 *
 * `knownPosition` is passed in when the screen already has one, so a drive in
 * progress doesn't wait for a fresh GPS fix.
 */
export function useSendSos() {
  const contact = useEmergencyContact();

  const send = useCallback(
    async (knownPosition?: DrivePosition | null): Promise<SosOutcome> => {
      const now = new Date();
      const position = await bestEffortPosition(knownPosition);

      // No fix — in a tunnel, or location never allowed. The message still
      // goes, saying so, because a silent button is the worst outcome here.
      const message = position
        ? buildSosMessage(position, now)
        : buildSosMessageWithoutLocation(now);
      const withLocation = position !== null;
      const saved = contact.data;

      // Straight to WhatsApp when there's someone to send it to: fewer taps is
      // the entire point at this moment.
      if (saved?.phone) {
        try {
          await Linking.openURL(whatsappLinkFor(saved.phone, message));
          return { sent: true, via: 'whatsapp', withLocation };
        } catch (error) {
          // WhatsApp missing or the link refused: fall through to the share
          // sheet rather than leaving the person with nothing.
          logInDev(error);
        }
      }

      try {
        const result = await Share.share({ message });
        return result.action === Share.dismissedAction
          ? { sent: false, reason: 'cancelled' }
          : { sent: true, via: 'share', withLocation };
      } catch (error) {
        logInDev(error);
        return { sent: false, reason: 'failed' };
      }
    },
    [contact.data],
  );

  return { send, contact: contact.data ?? null };
}
