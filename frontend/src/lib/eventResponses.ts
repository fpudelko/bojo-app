// "Kto milczy" — panel dla organizatora meczu ekipy (migracja `097`). Ankieta
// na WhatsAppie pokazuje, kto zagłosował; nigdy nie pokaże, kto się nie
// odezwał. Bojo zna skład ekipy i zna odpowiedzi, więc potrafi policzyć różnicę.
import { supabase } from './supabase';
import type { GroupMember, EventParticipant, EventDecline } from '@/types';

/**
 * Członkowie ekipy, którzy nie zareagowali na ten mecz — ani nie dołączyli
 * (`event_participants`), ani nie odmówili wprost (`event_declines`).
 * Czysta funkcja: cisza jest tu warunkiem NIEobecności w obu zbiorach, więc
 * odmawiający — kluczowy przypadek całej funkcji — jawnie NIE milczy.
 */
export function ktoMilczy(
  czlonkowie: GroupMember[],
  uczestnicy: EventParticipant[],
  odmowy: EventDecline[],
  organizerId?: string,
): GroupMember[] {
  const odpowiedzieli = new Set<string>();
  for (const u of uczestnicy) { if (u.userId) odpowiedzieli.add(u.userId); }
  for (const o of odmowy) odpowiedzieli.add(o.userId);
  return czlonkowie.filter((m) => m.userId !== organizerId && !odpowiedzieli.has(m.userId));
}

/** Woła RPC `zapytaj_milczacych` — działa wyłącznie dla meczów przypiętych do
 *  grupy (SECURITY DEFINER, `097`), zwraca liczbę realnie zaczepionych osób
 *  (zapora przed spamem pomija zaczepionych w ciągu ostatnich 12 h). */
export async function zapytajMilczacych(eventId: string): Promise<number> {
  const { data, error } = await supabase.rpc('zapytaj_milczacych', { p_event_id: eventId });
  if (error) throw new Error(error.message);
  return (data ?? 0) as number;
}
