import { supabase } from './supabase';
import type { AppNotification } from '@/types';

export function toNotif(row: any): AppNotification {
  return {
    id:        row.id,
    userId:    row.user_id,
    type:      row.type,
    title:     row.title,
    body:      row.body ?? undefined,
    eventId:   row.event_id ?? undefined,
    alertId:   row.alert_id ?? undefined,
    readAt:    row.read_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function getMyNotifications(limit = 20): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toNotif);
}

export async function markRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .is('read_at', null);
}
