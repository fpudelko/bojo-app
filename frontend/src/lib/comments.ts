import { supabase } from './supabase';
import type { EventComment } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toComment(row: any): EventComment {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    userName: row.user_name,
    body: row.body,
    deletedAt: row.deleted_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function getComments(eventId: string): Promise<EventComment[]> {
  const { data, error } = await supabase
    .from('event_comments')
    .select('*')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toComment);
}

export async function addComment(
  eventId: string,
  userId: string,
  userName: string,
  body: string,
): Promise<EventComment> {
  const safe = body.trim().slice(0, 1000);
  if (!safe) throw new Error('Komentarz nie może być pusty.');
  const { data, error } = await supabase
    .from('event_comments')
    .insert({ event_id: eventId, user_id: userId, user_name: userName, body: safe })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toComment(data);
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('event_comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) throw new Error(error.message);
}
