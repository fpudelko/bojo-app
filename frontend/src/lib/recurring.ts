import { supabase } from './supabase';
import { createEvent } from './events';
import type { RecurringEvent, RecurringEventInvite, Visibility } from '@/types';

export const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Poniedziałek' },
  { value: 2, label: 'Wtorek' },
  { value: 3, label: 'Środa' },
  { value: 4, label: 'Czwartek' },
  { value: 5, label: 'Piątek' },
  { value: 6, label: 'Sobota' },
  { value: 7, label: 'Niedziela' },
];

/** 1=Poniedziałek…7=Niedziela, liczone od stringa 'YYYY-MM-DD' (lokalna
 *  północ, bez przesunięć strefy — inaczej niż `new Date(date)` samo w sobie,
 *  które parsuje jako UTC i potrafi zjechać o dzień w zależności od strefy
 *  przeglądarki). */
export function dayOfWeekFromDate(date: string): number {
  const jsDay = new Date(`${date}T00:00:00`).getDay(); // 0=Niedz…6=Sob
  return jsDay === 0 ? 7 : jsDay;
}

export function dayOfWeekLabelFromDate(date: string): string {
  const n = dayOfWeekFromDate(date);
  return DAY_OPTIONS.find((d) => d.value === n)!.label.toLowerCase();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRecurringEvent(row: any): RecurringEvent {
  return {
    id: row.id,
    organizerId: row.organizer_id,
    organizerName: row.organizer_name,
    sport: row.sport,
    fieldId: row.field_id ?? undefined,
    fieldName: row.field_name,
    lat: row.lat != null ? Number(row.lat) : undefined,
    lng: row.lng != null ? Number(row.lng) : undefined,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    dayOfWeek: row.day_of_week,
    eventTime: row.event_time,
    endTime: row.end_time ?? undefined,
    maxPlayers: row.max_players,
    visibility: row.visibility,
    notifyDaysBefore: row.notify_days_before,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toInvite(row: any): RecurringEventInvite {
  return {
    id: row.id,
    recurringEventId: row.recurring_event_id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    createdAt: row.created_at,
  };
}

interface RecurringEventData {
  sport: string;
  fieldId?: string;
  fieldName: string;
  lat?: number;
  lng?: number;
  title?: string;
  description?: string;
  dayOfWeek: number;
  eventTime: string;
  endTime?: string;
  maxPlayers: number;
  visibility: Visibility;
  notifyDaysBefore: number;
}

export async function createRecurringEvent(
  data: RecurringEventData,
  organizerId: string,
  organizerName: string,
): Promise<string> {
  const { data: row, error } = await supabase
    .from('recurring_events')
    .insert({
      organizer_id: organizerId,
      organizer_name: organizerName,
      sport: data.sport,
      field_id: data.fieldId ?? null,
      field_name: data.fieldName,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      title: data.title ?? null,
      description: data.description ?? null,
      day_of_week: data.dayOfWeek,
      event_time: data.eventTime,
      end_time: data.endTime ?? null,
      max_players: data.maxPlayers,
      visibility: data.visibility,
      notify_days_before: data.notifyDaysBefore,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return row.id as string;
}

export async function updateRecurringEvent(id: string, data: RecurringEventData): Promise<void> {
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
      day_of_week: data.dayOfWeek,
      event_time: data.eventTime,
      end_time: data.endTime ?? null,
      max_players: data.maxPlayers,
      visibility: data.visibility,
      notify_days_before: data.notifyDaysBefore,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function getRecurringEvent(
  id: string,
): Promise<{ event: RecurringEvent; invites: RecurringEventInvite[] }> {
  const { data: eventRow, error } = await supabase
    .from('recurring_events')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);

  const { data: inviteRows, error: iErr } = await supabase
    .from('recurring_event_invites')
    .select('*')
    .eq('recurring_event_id', id)
    .order('created_at', { ascending: true });
  if (iErr) throw new Error(iErr.message);

  return {
    event: toRecurringEvent(eventRow),
    invites: (inviteRows ?? []).map(toInvite),
  };
}

export async function getMyRecurringEvents(userId: string): Promise<RecurringEvent[]> {
  const { data, error } = await supabase
    .from('recurring_events')
    .select('*')
    .eq('organizer_id', userId)
    .order('day_of_week', { ascending: true })
    .order('event_time', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toRecurringEvent);
}

/** Fetch the next upcoming event linked to each recurring template, keyed by recurringEventId. */
export async function getNextEventsForRecurring(
  recurringIds: string[],
): Promise<Record<string, { id: string; date: string; maxPlayers: number; status: string; confirmedCount?: number } | null>> {
  if (recurringIds.length === 0) return {};

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('events')
    .select('id, recurring_event_id, event_date, max_players, status')
    .in('recurring_event_id', recurringIds)
    .gte('event_date', today)
    .order('event_date', { ascending: true });

  if (error) return {};

  const result: Record<string, { id: string; date: string; maxPlayers: number; status: string } | null> = {};
  for (const id of recurringIds) result[id] = null;
  for (const row of (data ?? [])) {
    const rid = row.recurring_event_id;
    if (rid && !result[rid]) {
      result[rid] = {
        id: row.id,
        date: row.event_date,
        maxPlayers: row.max_players,
        status: row.status ?? 'active',
      };
    }
  }

  return result;
}

export async function addInvite(
  recurringEventId: string,
  name: string,
  email?: string,
  phone?: string,
): Promise<void> {
  const { error } = await supabase.from('recurring_event_invites').insert({
    recurring_event_id: recurringEventId,
    name,
    email: email ?? null,
    phone: phone ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function removeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('recurring_event_invites')
    .delete()
    .eq('id', inviteId);
  if (error) throw new Error(error.message);
}

export async function toggleActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('recurring_events')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteRecurringEvent(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_events').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Tworzy jeden termin serii na wskazaną datę.
 *
 * Wywołanie idzie do funkcji `utworz_termin_serii` w bazie (migracja `073`) —
 * tej samej, której używa cron. To nie jest obejście, tylko warunek poprawności:
 * termin utworzony ręcznie musi być identyczny z utworzonym automatycznie, więc
 * logika kopiowania ustawień może istnieć TYLKO w jednym miejscu.
 *
 * Wcześniej ta funkcja składała wydarzenie sama, z samego szablonu — a szablon
 * nie zna ceny, metod płatności, bramkarzy ani akceptacji zapisów. Płatna gierka
 * odradzała się jako DARMOWA. Dziś ustawienia dziedziczy z ostatniego terminu serii.
 *
 * Uprawnienia pilnuje funkcja w bazie (tylko organizator serii); `SECURITY
 * DEFINER` jest tam po to, żeby ten sam kod mógł odpalić cron, który nie działa
 * w niczyim imieniu.
 *
 * @returns id nowego wydarzenia
 * @throws gdy termin na tę datę już istnieje
 */
export async function spawnEventInstance(
  recurringEventId: string,
  targetDate: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('utworz_termin_serii', {
    p_szablon_id: recurringEventId,
    p_data: targetDate,
  });
  if (error) throw new Error(error.message);
  // NULL = termin na tę datę już istniał. Cichy sukces byłby mylący: organizator
  // zobaczyłby „utworzono" i przekierowanie na cudzy/stary termin.
  if (!data) throw new Error('Termin na ten dzień już istnieje w tej serii.');
  return data as string;
}

export async function sendInvites(
  recurringEventId: string,
  eventId: string,
  eventDate: string,
  eventUrl: string,
): Promise<{ emailsSent: number; smsSent: number; errors: string[] }> {
  const { data, error } = await supabase.functions.invoke('send-invites', {
    body: { recurringEventId, eventId, eventDate, eventUrl },
  });
  if (error) throw new Error(error.message);
  return data as { emailsSent: number; smsSent: number; errors: string[] };
}

// ---------------------------------------------------------------------------
// Następny termin serii
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD` z lokalnej daty. Nie `toISOString()`: ten przelicza na UTC
 *  i w naszej strefie potrafi cofnąć wynik o dzień. */
function jakoData(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Data następnego wystąpienia serii — ta sama reguła, którą liczy
 * `utworz_nalezne_terminy_serii()` w migracji `073`:
 * najbliższy dzień tygodnia (1=pon … 7=niedz), a gdy wypada dziś i godzina
 * już minęła — za tydzień. Bez tego drugiego warunku „następny termin"
 * pokazywałby mecz kilka godzin po jego zakończeniu.
 */
export function nastepnyTermin(dayOfWeek: number, eventTime: string, teraz = new Date()): string {
  const dzisIso = teraz.getDay() === 0 ? 7 : teraz.getDay();
  let odstep = (dayOfWeek - dzisIso + 7) % 7;
  if (odstep === 0) {
    const godzinaTeraz = `${String(teraz.getHours()).padStart(2, '0')}:${String(teraz.getMinutes()).padStart(2, '0')}`;
    if ((eventTime || '').slice(0, 5) <= godzinaTeraz) odstep = 7;
  }
  const cel = new Date(teraz);
  cel.setDate(teraz.getDate() + odstep);
  return jakoData(cel);
}

/** Ile dni dzieli dziś od podanej daty (ujemne = przeszłość). */
export function dniDo(data: string, teraz = new Date()): number {
  const [y, m, d] = data.split('-').map(Number);
  const cel = new Date(y, m - 1, d);
  const dzis = new Date(teraz.getFullYear(), teraz.getMonth(), teraz.getDate());
  return Math.round((cel.getTime() - dzis.getTime()) / 86_400_000);
}
