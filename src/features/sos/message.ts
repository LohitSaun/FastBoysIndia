/**
 * Building the "I need help" message.
 *
 * Plain functions with no React, no Supabase and no clock of their own: the
 * caller passes the time in. That keeps them predictable and means a render can
 * call them safely.
 */

export type SosPosition = { latitude: number; longitude: number };

/** Five decimal places is about a metre, which is far more than enough. */
function coordinate(value: number): string {
  return value.toFixed(5);
}

/**
 * A link any phone can open: it opens Google Maps if installed, and the browser
 * otherwise. Deliberately not a geo: URI, which Android handles and iOS doesn't.
 */
export function mapsLinkFor(position: SosPosition): string {
  return `https://maps.google.com/?q=${coordinate(position.latitude)},${coordinate(position.longitude)}`;
}

/**
 * The message body.
 *
 * The coordinates appear as text as well as in the link, because a link can be
 * stripped by an SMS gateway or arrive unclickable, and someone can read
 * numbers down a phone line.
 *
 * It says who sent it and when, so the person receiving it knows it is real and
 * how old it is. It does not claim that help is on the way, because nothing
 * here contacts anybody automatically.
 */
export function buildSosMessage(position: SosPosition, when: Date): string {
  const time = when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return [
    'I need help.',
    '',
    `This is where I am: ${mapsLinkFor(position)}`,
    `Coordinates: ${coordinate(position.latitude)}, ${coordinate(position.longitude)}`,
    '',
    `Sent from Fast Boys India at ${time}.`,
  ].join('\n');
}

/**
 * When there is no position to send.
 *
 * A location fix can be minutes away in a basement car park or a tunnel, and a
 * button that does nothing at that moment is worse than useless. So the message
 * still goes, and it says plainly that the location is missing rather than
 * leaving the reader to guess.
 */
export function buildSosMessageWithoutLocation(when: Date): string {
  const time = when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return [
    'I need help.',
    '',
    "My phone couldn't work out where I am. Please call me.",
    '',
    `Sent from Fast Boys India at ${time}.`,
  ].join('\n');
}

/**
 * A WhatsApp link with the message already typed in. wa.me is WhatsApp's own
 * web address, so this needs nothing from us and no extra permissions.
 *
 * The number must be digits with the country code and no "+".
 */
export function whatsappLinkFor(nationalNumber: string, message: string): string {
  return `https://wa.me/91${nationalNumber}?text=${encodeURIComponent(message)}`;
}
