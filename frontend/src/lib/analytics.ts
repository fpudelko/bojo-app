import { supabase } from './supabase';

/**
 * App-wide analytics events. Fire-and-forget — analytics must never block or
 * break a user action, so all failures are swallowed with a console warning.
 * Read by the admin dashboard at /admin/analityka.
 */
export type AnalyticsEvent =
  | 'login'
  | 'event_created'
  | 'event_joined'
  | 'group_created'
  | 'group_joined';

export async function track(
  eventType: AnalyticsEvent,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    await supabase.from('analytics_events').insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      event_type: eventType,
      path: typeof window !== 'undefined' ? window.location.pathname : null,
      metadata: metadata ?? null,
    });
  } catch (e) {
    console.warn('[analytics]', eventType, e);
  }
}
