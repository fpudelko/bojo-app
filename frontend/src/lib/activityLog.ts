import { supabase } from './supabase';

export type ActivityAction =
  | 'event_created'
  | 'event_updated'
  | 'event_cancelled'
  | 'event_restored'
  | 'participant_joined'
  | 'participant_left'
  | 'guest_added'
  | 'participant_removed'
  | 'payment_updated'
  | 'status_changed'
  | 'visibility_changed'
  | 'result_saved'
  | 'comment_added'
  | 'team_assigned'
  | 'teams_randomized';

export async function logActivity(
  eventId: string,
  userId: string | null,
  userName: string | null,
  action: ActivityAction,
  payload?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('event_activity_log').insert({
    event_id: eventId,
    user_id: userId,
    user_name: userName,
    action,
    payload: payload ?? null,
  });
  if (error) console.warn('[ActivityLog]', action, error.message);
}
