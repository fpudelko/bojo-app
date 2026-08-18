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
    claimToken: row.claim_token ?? undefined,
    groupId:   row.group_id ?? undefined,
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

/** Typy powiadomień, które proszą użytkownika o zrobienie czegoś. */
export const WYMAGA_AKCJI = new Set(['prosba_o_dolaczenie', 'reserve_claim_offered', 'pytanie_o_udzial', 'zaproszenie_na_mecz']);

/**
 * Które z tych powiadomień mają jeszcze COŚ DO ZROBIENIA.
 *
 * Powiadomienie samo w sobie nie wie, czy sprawa została załatwiona — niesie
 * tylko fakt „coś się wydarzyło". Dzwonek oznacza wszystko jako przeczytane
 * przy otwarciu, więc bez tego zapytania każdy stan wizualny jest zgadywaniem:
 * albo prośba rozpatrzona wygląda na czekającą, albo czekająca na rozpatrzoną.
 * Oba warianty już się w tej apce zdarzyły.
 *
 * Stan bierzemy stamtąd, gdzie naprawdę jest:
 *   - `prosba_o_dolaczenie` — czy w tym meczu wisi jeszcze jakiś wpis
 *     `pending_approval` (RLS pokazuje je organizatorowi),
 *   - `reserve_claim_offered` — czy MÓJ wpis w tym meczu ma nadal aktywną
 *     ofertę zwolnionego miejsca,
 *   - `pytanie_o_udzial` (097) — czy JA nadal nie odpowiedziałem, czyli nie
 *     mam ani wpisu w `event_participants`, ani jawnej odmowy w
 *     `event_declines`. Odmowa jest tu kluczowym przypadkiem: zamyka sprawę
 *     dokładnie tak samo jak dołączenie — „nie gram" to odpowiedź, nie cisza.
 *
 * Zwraca zbiór identyfikatorów powiadomień, które są nadal otwarte. Błąd
 * zapytania oznacza `null` — wywołujący ma wtedy zostawić dotychczasowy
 * wygląd, a nie zgadywać w drugą stronę.
 */
export async function otwarteSprawy(
  userId: string,
  powiadomienia: AppNotification[],
): Promise<Set<string> | null> {
  const doSprawdzenia = powiadomienia.filter((n) => WYMAGA_AKCJI.has(n.type) && n.eventId);
  if (doSprawdzenia.length === 0) return new Set();

  const meczeProsb = Array.from(new Set(
    doSprawdzenia.filter((n) => n.type === 'prosba_o_dolaczenie').map((n) => n.eventId!),
  ));
  const meczeOfert = Array.from(new Set(
    doSprawdzenia.filter((n) => n.type === 'reserve_claim_offered').map((n) => n.eventId!),
  ));
  // `zaproszenie_na_mecz` liczy się tak samo jak `pytanie_o_udzial`: oba
  // pytają MNIE, czy gram, i oba zamyka ta sama odpowiedź — wpis w składzie
  // albo jawna odmowa. Zaproszenie było wcześniej poza tym mechanizmem, więc
  // wisiało w panelu jako zwykła informacja, mimo że czekało na decyzję.
  const meczePytan = Array.from(new Set(
    doSprawdzenia
      .filter((n) => n.type === 'pytanie_o_udzial' || n.type === 'zaproszenie_na_mecz')
      .map((n) => n.eventId!),
  ));

  try {
    const [prosby, oferty, udzial, odmowy] = await Promise.all([
      meczeProsb.length
        ? supabase.from('event_participants').select('event_id')
            .eq('pending_approval', true).in('event_id', meczeProsb)
        : Promise.resolve({ data: [], error: null }),
      meczeOfert.length
        ? supabase.from('event_participants').select('event_id')
            .eq('user_id', userId).not('claim_offered_at', 'is', null).in('event_id', meczeOfert)
        : Promise.resolve({ data: [], error: null }),
      meczePytan.length
        ? supabase.from('event_participants').select('event_id')
            .eq('user_id', userId).in('event_id', meczePytan)
        : Promise.resolve({ data: [], error: null }),
      meczePytan.length
        ? supabase.from('event_declines').select('event_id')
            .eq('user_id', userId).in('event_id', meczePytan)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (prosby.error || oferty.error || udzial.error || odmowy.error) return null;

    const zProsbami = new Set((prosby.data ?? []).map((r: any) => r.event_id as string));
    const zOfertami = new Set((oferty.data ?? []).map((r: any) => r.event_id as string));
    const zOdpowiedzia = new Set([
      ...(udzial.data ?? []).map((r: any) => r.event_id as string),
      ...(odmowy.data ?? []).map((r: any) => r.event_id as string),
    ]);

    return new Set(
      doSprawdzenia
        .filter((n) => {
          if (n.type === 'prosba_o_dolaczenie') return zProsbami.has(n.eventId!);
          if (n.type === 'reserve_claim_offered') return zOfertami.has(n.eventId!);
          return !zOdpowiedzia.has(n.eventId!);
        })
        .map((n) => n.id),
    );
  } catch {
    return null;
  }
}

export async function markRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .is('read_at', null);
}
