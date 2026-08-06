import { supabase } from './supabase';
import type { FieldComment } from '@/types';

// Bliźniak `lib/comments.ts` dla obiektów z katalogu. Osobna tabela, bo
// komentarz pod boiskiem przeżywa każdy pojedynczy mecz na tym boisku —
// uzasadnienie w komentarzu do migracji `063`.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toComment(row: any): FieldComment {
  return {
    id: row.id,
    fieldId: row.field_id,
    userId: row.user_id,
    userName: row.user_name,
    body: row.body,
    deletedAt: row.deleted_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function getFieldComments(fieldId: string): Promise<FieldComment[]> {
  const { data, error } = await supabase
    .from('field_comments')
    .select('*')
    .eq('field_id', fieldId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toComment);
}

export async function addFieldComment(
  fieldId: string,
  userId: string,
  userName: string,
  body: string,
): Promise<FieldComment> {
  const safe = body.trim().slice(0, 1000);
  if (!safe) throw new Error('Komentarz nie może być pusty.');
  const { data, error } = await supabase
    .from('field_comments')
    .insert({ field_id: fieldId, user_id: userId, user_name: userName, body: safe })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toComment(data);
}

/** Kasowanie miękkie — wiersz zostaje, znika z odczytu. Twarde `DELETE`
 *  zabrałoby ślad po wpisie, który ktoś mógł zgłosić do moderacji. */
export async function deleteFieldComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('field_comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) throw new Error(error.message);
}
