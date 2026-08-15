// Jawna odmowa udziału w meczu (migracja `097`) — "nie gram", nie
// "nieobecność". `player_reports` (091) karmi "Niezawodność" wyłącznie ze
// zgłoszeń nie-przyjścia; ta tabela nie ma z tamtą żadnego związku.
import { supabase } from './supabase';
import type { EventDecline } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDecline(row: any): EventDecline {
  return { eventId: row.event_id, userId: row.user_id, createdAt: row.created_at };
}

/** Odmawiam za siebie. `upsert` — dwukrotne kliknięcie "Nie gram" nie rzuca
 *  błędem unikalności klucza głównego. */
export async function odmow(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('event_declines')
    .upsert({ event_id: eventId, user_id: userId }, { onConflict: 'event_id,user_id' });
  if (error) throw new Error(error.message);
}

/** Cofnięcie odmowy. RLS (`097`) pozwala tylko za siebie —
 *  `.select('event_id')` po DELETE wykrywa cichą odmowę RLS (0 usuniętych
 *  wierszy), zamiast pozwolić przyciskowi udawać sukces. */
export async function cofnijOdmowe(eventId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('event_declines')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .select('event_id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Nie udało się cofnąć odmowy — spróbuj ponownie.');
  }
}

export async function getDeclines(eventId: string): Promise<EventDecline[]> {
  const { data, error } = await supabase
    .from('event_declines')
    .select('*')
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toDecline);
}
