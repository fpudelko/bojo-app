import { supabase } from './supabase';
import type { EventCreate, EventItem } from '@/types';

/**
 * Seria = terminy jednej stałej gierki, spięte `events.recurring_event_id`
 * (szablon w `recurring_events`). Ten plik odpowiada za JEDNO pytanie:
 * „którego terminu dotyczy ta zmiana".
 *
 * Reguły — patrz docs/domena.md:
 *  - szablon niesie regułę powtarzania (dzień, godzina, miejsce, limit),
 *  - ostatni termin serii jest wzorcem reszty ustawień dla kolejnych terminów.
 */

export type ZakresEdycji = 'ten' | 'ten-i-przyszle' | 'cala-seria';

export const ETYKIETY_ZAKRESU: Record<ZakresEdycji, { tytul: string; opis: string }> = {
  'ten': {
    tytul: 'Tylko to wydarzenie',
    opis: 'Pozostałe terminy stałej gierki zostają bez zmian.',
  },
  'ten-i-przyszle': {
    tytul: 'To i przyszłe wydarzenia',
    opis: 'Zmiana obejmie ten termin i wszystkie następne. Rozegrane zostają nietknięte.',
  },
  'cala-seria': {
    tytul: 'Cała seria',
    opis: 'Zmiana obejmie też terminy już rozegrane — użyj przy prostowaniu pomyłki.',
  },
};

/**
 * Terminy objęte wybranym zakresem.
 *
 * `dzis` wstrzykiwane, a nie brane z `new Date()` w środku — inaczej funkcja
 * jest nietestowalna, a to jedyne miejsce, w którym „przyszłe" ma definicję.
 *
 * „Przyszłe" liczymy po DACIE terminu, nie po jego pozycji w serii: terminy
 * bywają dopisywane ręcznie poza kolejnością (`/cykliczne/[id]` pozwala wybrać
 * dowolną datę), więc kolejność wstawiania nie jest kolejnością rozgrywania.
 */
export function terminyWZakresie<T extends { id: string; date: string }>(
  wszystkie: T[],
  tenId: string,
  zakres: ZakresEdycji,
  dzis: string,
): T[] {
  const ten = wszystkie.find((e) => e.id === tenId);
  if (!ten) return [];
  if (zakres === 'ten') return [ten];
  if (zakres === 'cala-seria') return wszystkie;

  // Sam edytowany termin jest w zakresie zawsze — także wtedy, gdy już się odbył
  // (organizator poprawia właśnie jego, więc pominięcie go byłoby zaskoczeniem).
  return wszystkie.filter((e) => e.id === tenId || e.date >= dzis);
}

/**
 * Pola, których NIGDY nie zmieniamy zbiorczo — niezależnie od wybranego zakresu.
 *
 * `date` to własność pojedynczego terminu: wspólna data absolutna dla całej serii
 * jest sprzeczna sama w sobie (wszystkie mecze tego samego dnia). Przesunięcie
 * całej gierki na inny dzień tygodnia to zmiana REGUŁY, czyli edycja szablonu
 * na `/cykliczne/[id]/edytuj`, nie zbiorcza zmiana terminów.
 */
export const POLA_POZA_ZAKRESEM = ['date'] as const;

/** `patch` bez pól, które dotyczą wyłącznie edytowanego terminu. */
export function patchDlaPozostalych(patch: EventCreate): Omit<EventCreate, 'date'> {
  const kopia: Partial<EventCreate> = { ...patch };
  for (const pole of POLA_POZA_ZAKRESEM) delete kopia[pole];
  return kopia as Omit<EventCreate, 'date'>;
}

/** Terminy serii, od najstarszego. Pusto, gdy `recurringEventId` nie ustawione. */
export async function getSeriesEvents(recurringEventId: string): Promise<EventItem[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, event_date, event_time, status')
    .eq('recurring_event_id', recurringEventId)
    .order('event_date', { ascending: true });
  if (error) throw new Error(error.message);
  // Celowo częściowy rzut: do wyboru zakresu wystarczą id i data, a ściąganie
  // pełnych wierszy całej serii przy każdym otwarciu edycji byłoby marnotrawstwem.
  return (data ?? []).map((r) => ({
    id: r.id as string,
    date: r.event_date as string,
    time: r.event_time as string,
    status: r.status ?? 'active',
  })) as EventItem[];
}

/**
 * Zbiorcza zmiana ustawień na wskazanych terminach. `date` jest odfiltrowana
 * (patrz `POLA_POZA_ZAKRESEM`), więc każdy termin zachowuje swoją datę.
 *
 * Mapowanie kolumn celowo takie samo jak w `updateEvent()` — rozjazd między
 * edycją pojedynczą a zbiorczą byłby najgorszym możliwym błędem w tym miejscu.
 */
export async function updateSeriesEvents(
  eventIds: string[],
  data: EventCreate,
): Promise<void> {
  if (eventIds.length === 0) return;
  const { error } = await supabase
    .from('events')
    .update({
      sport: data.sport,
      field_id: data.fieldId ?? null,
      field_name: data.fieldName,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      title: data.title ?? null,
      description: data.description ?? null,
      event_time: data.time,
      end_time: data.endTime ?? null,
      max_players: data.maxPlayers,
      visibility: data.visibility,
      require_sms_confirmation: data.requireSmsConfirmation ?? false,
      team_mode: data.teamMode ?? 'brak',
      track_payments: data.trackPayments ?? false,
      show_payment_status: data.showPaymentStatus ?? false,
      track_results: data.trackResults ?? false,
      confirmation_deadline_h: data.confirmationDeadlineH ?? 24,
      cost_grosz: data.costGrosze ?? 0,
      require_approval: data.requireApproval ?? false,
      max_goalkeepers: data.maxGoalkeepers ?? 2,
      goalkeepers_enabled: data.goalkeepersEnabled ?? false,
      reserve_claim_hours: data.reserveClaimHours ?? 3,
      accepted_payment_methods: data.acceptedPaymentMethods ?? [],
      blik_phone: data.blikPhone?.trim() || null,
      accepted_sports_cards: data.acceptedSportsCards ?? [],
      sports_card_discount_grosz: data.sportsCardDiscountGrosze ?? null,
      sports_card_other_name: data.sportsCardOtherName?.trim() || null,
    })
    .in('id', eventIds);
  if (error) throw new Error(error.message);
}

/**
 * Sama godzina na wskazanych terminach — dla modala „Zmień termin", który
 * zmienia tylko `when`, a nie cały komplet ustawień.
 *
 * `event_date` świadomie poza zasięgiem (patrz `POLA_POZA_ZAKRESEM`): każdy
 * termin zachowuje swoją datę, przesuwa się wyłącznie godzina.
 */
export async function setSeriesTime(
  eventIds: string[],
  time: string,
  endTime: string | null,
): Promise<void> {
  if (eventIds.length === 0) return;
  const { error } = await supabase
    .from('events')
    .update({ event_time: time, end_time: endTime })
    .in('id', eventIds);
  if (error) throw new Error(error.message);
}

/** Godzina w szablonie — żeby kolejne, jeszcze nieutworzone terminy też ją miały. */
export async function setSeriesTemplateTime(
  recurringEventId: string,
  time: string,
  endTime: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('recurring_events')
    .update({ event_time: time, end_time: endTime })
    .eq('id', recurringEventId);
  if (error) throw new Error(error.message);
}

/**
 * Przeniesienie zmian do szablonu, żeby KOLEJNE terminy też je dostały.
 * Wołane przy zakresie innym niż „tylko to wydarzenie" — bez tego zmiana
 * obejmowałaby istniejące terminy, a każdy nowy wracałby do starych ustawień.
 *
 * Szablon jest właścicielem tylko części pól (reguła powtarzania) — reszta i tak
 * dziedziczy się z ostatniego terminu serii, więc nie ma czego tu dopisywać.
 */
export async function updateSeriesTemplate(
  recurringEventId: string,
  data: EventCreate,
): Promise<void> {
  const { error } = await supabase
    .from('recurring_events')
    .update({
      sport: data.sport,
      field_id: data.fieldId ?? null,
      field_name: data.fieldName,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      title: data.title ?? null,
      description: data.description ?? null,
      event_time: data.time,
      end_time: data.endTime ?? null,
      max_players: data.maxPlayers,
      visibility: data.visibility,
    })
    .eq('id', recurringEventId);
  if (error) throw new Error(error.message);
}
