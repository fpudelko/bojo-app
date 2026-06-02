// Global feature flag — set NEXT_PUBLIC_FEATURE_RESERVATIONS=true in .env to enable.
export const FEATURE_RESERVATIONS =
  process.env.NEXT_PUBLIC_FEATURE_RESERVATIONS === 'true';

// Returns true if the booking UI should be shown for a specific field.
// Either the global flag is ON, or the individual field has booking_enabled=true.
export function showBookingForField(field: { bookingEnabled: boolean }): boolean {
  return FEATURE_RESERVATIONS || field.bookingEnabled;
}
