/**
 * Indian mobile number helpers.
 *
 * v1 only supports Indian (+91) mobile numbers. A valid Indian mobile number
 * is 10 digits and starts with 6, 7, 8 or 9.
 *
 * These are plain functions with no React or Supabase imports, so they're
 * easy to test and reuse (e.g. later for SOS trusted contacts in Phase 5).
 */

const COUNTRY_CODE = '91';
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/**
 * Keeps the phone input tidy while the user types or pastes:
 * digits only, max 10, and a pasted "+91" or leading "0" is dropped.
 */
export function sanitizeNationalInput(text: string): string {
  let digits = text.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith(COUNTRY_CODE)) {
    digits = digits.slice(COUNTRY_CODE.length);
  } else if (digits.length > 10 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/** True if the 10 digits the user entered look like an Indian mobile number. */
export function isValidNationalNumber(national: string): boolean {
  return INDIAN_MOBILE.test(national);
}

/**
 * "98765 43210" → "+919876543210".
 * E.164 is the international format Supabase Auth expects.
 * Returns null if the input isn't a valid Indian mobile number.
 */
export function toE164(input: string): string | null {
  const national = sanitizeNationalInput(input);
  return isValidNationalNumber(national) ? `+${COUNTRY_CODE}${national}` : null;
}

/**
 * "+919876543210" or "919876543210" → "+91 98765 43210" for showing on screen.
 * (Supabase returns `user.phone` without the "+", so we accept both.)
 */
export function formatForDisplay(phone: string): string {
  const national = sanitizeNationalInput(phone);
  if (national.length !== 10) return phone;
  return `+${COUNTRY_CODE} ${national.slice(0, 5)} ${national.slice(5)}`;
}
