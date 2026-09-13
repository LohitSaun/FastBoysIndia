/**
 * Sentry = crash reporting. When the app crashes or throws an error, Sentry records the
 * stack trace, device model and app version, so we can fix bugs we'd never see on our
 * own phones.
 *
 * Privacy: we never send phone numbers or other personal data. We attach only the
 * Supabase user id (a random UUID), and scrub anything that looks like an Indian mobile
 * number before an event leaves the phone.
 */
import * as Sentry from '@sentry/react-native';

import { env } from '@/lib/env';

// Matches "+919876543210", "91 98765 43210", "9876543210", etc.
const INDIAN_PHONE = /(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g;

function scrub(text: string): string {
  return text.replace(INDIAN_PHONE, '[phone]');
}

export function initSentry() {
  if (!env.sentryDsn) return; // No DSN configured yet, so Sentry stays off.

  Sentry.init({
    dsn: env.sentryDsn,
    // Don't attach IP addresses, cookies or other personal data automatically.
    sendDefaultPii: false,
    // Errors from your dev build are tagged "development" so they're easy to filter out.
    environment: __DEV__ ? 'development' : 'production',
    // Errors only for now. Performance tracing can be switched on later if we need it.
    beforeSend(event) {
      if (event.message) event.message = scrub(event.message);
      event.exception?.values?.forEach((exception) => {
        if (exception.value) exception.value = scrub(exception.value);
      });
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.message) breadcrumb.message = scrub(breadcrumb.message);
      return breadcrumb;
    },
  });
}

export function setMonitoringUser(userId: string | null) {
  Sentry.setUser(userId ? { id: userId } : null);
}

/** Wraps the root component so Sentry can catch errors thrown while rendering. */
export const withSentry = Sentry.wrap;
