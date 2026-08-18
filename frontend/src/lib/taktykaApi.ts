import { supabase } from './supabase';
import { zaktualizujJedenWiersz, zPonowieniemPoOdswiezeniu } from './zapytania';
import type { Taktyka } from './taktyka';

/** Zapis ustawienia i taktyki drużyny (`event_team_setup`, migracja `103`). */
export interface UstawienieDruzyny {
  schemat: string | null;
  taktyka: Taktyka;
  notatka: string | null;
}

export interface WiadomoscDruzyny {
  id: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: string;
}

export type Druzyna = 'A' | 'B';

export async function pobierzUstawienie(
  eventId: string,
  team: Druzyna,
): Promise<UstawienieDruzyny | null> {
  const { data, error } = await supabase
    .from('event_team_setup')
    .select('schemat, taktyka, notatka')
    .eq('event_id', eventId)
    .eq('team', team)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    schemat: data.schemat ?? null,
    taktyka: (data.taktyka ?? {}) as Taktyka,
    notatka: data.notatka ?? null,
  };
}

/**
 * Zapis ustawienia. `upsert`, bo pierwszy zapis tworzy wiersz, a każdy kolejny
 * go zmienia — a z punktu widzenia klikającego to za każdym razem ta sama
 * czynność.
 */
export async function zapiszUstawienie(
  eventId: string,
  team: Druzyna,
  zmiana: Partial<UstawienieDruzyny>,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('event_team_setup').upsert({
    event_id: eventId,
    team,
    ...(zmiana.schemat !== undefined ? { schemat: zmiana.schemat } : {}),
    ...(zmiana.taktyka !== undefined ? { taktyka: zmiana.taktyka } : {}),
    ...(zmiana.notatka !== undefined ? { notatka: zmiana.notatka } : {}),
    updated_at: new Date().toISOString(),
    updated_by: userId,
  }, { onConflict: 'event_id,team' });
  if (error) throw new Error(error.message);
}

/** Mapa `slot → participant_id` dla drużyny. */
export async function pobierzPozycje(
  eventId: string,
  team: Druzyna,
): Promise<Record<number, string>> {
  const { data, error } = await supabase
    .from('event_team_slots')
    .select('slot, participant_id')
    .eq('event_id', eventId)
    .eq('team', team);
  if (error) throw new Error(error.message);
  const wynik: Record<number, string> = {};
  for (const r of data ?? []) wynik[r.slot as number] = r.participant_id as string;
  return wynik;
}

/**
 * Stawia gracza na pozycji.
 *
 * DWA KASOWANIA PRZED ZAPISEM, oba konieczne:
 *  - zwolnij pozycję, jeśli ktoś na niej stał (inaczej `upsert` po kluczu
 *    (event, team, slot) i tak by go nadpisał, ale bez tego nie wiadomo, że
 *    ktoś stracił miejsce),
 *  - zdejmij tego gracza z jego POPRZEDNIEJ pozycji — bez tego jedna osoba
 *    stoi w dwóch miejscach naraz. Baza broni się przed tym indeksem
 *    (`idx_team_slots_uczestnik`), więc bez tego kroku zapis kończy się
 *    błędem zamiast przeniesieniem.
 */
export async function ustawNaPozycji(
  eventId: string,
  team: Druzyna,
  slot: number,
  participantId: string,
): Promise<void> {
  await supabase.from('event_team_slots')
    .delete().eq('event_id', eventId).eq('participant_id', participantId);
  const { error } = await supabase.from('event_team_slots')
    .upsert({ event_id: eventId, team, slot, participant_id: participantId },
      { onConflict: 'event_id,team,slot' });
  if (error) throw new Error(error.message);
}

/** Zdejmuje gracza z pozycji — wraca do puli „bez pozycji". */
export async function zdejmijZPozycji(eventId: string, team: Druzyna, slot: number): Promise<void> {
  const { error } = await supabase.from('event_team_slots')
    .delete().eq('event_id', eventId).eq('team', team).eq('slot', slot);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Czat drużyny
// ---------------------------------------------------------------------------
export async function pobierzWiadomosciDruzyny(
  eventId: string,
  team: Druzyna,
): Promise<WiadomoscDruzyny[]> {
  const { data, error } = await supabase
    .from('event_team_messages')
    .select('id, user_id, user_name, body, created_at')
    .eq('event_id', eventId)
    .eq('team', team)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id, userId: r.user_id, userName: r.user_name, body: r.body, createdAt: r.created_at,
  }));
}

export async function wyslijDoDruzyny(
  eventId: string,
  team: Druzyna,
  userId: string,
  userName: string,
  body: string,
): Promise<WiadomoscDruzyny> {
  const tresc = body.trim().slice(0, 1000);
  if (!tresc) throw new Error('Wiadomość nie może być pusta.');
  // `zPonowieniemPoOdswiezeniu` — ta sama ochrona co w rozmowie meczu: przy
  // wygasłej sesji zapis leci jako niezalogowany i wywala się na polityce.
  const dane = await zPonowieniemPoOdswiezeniu(async () => {
    const { data, error } = await supabase.from('event_team_messages')
      .insert({ event_id: eventId, team, user_id: userId, user_name: userName, body: tresc })
      .select('id, user_id, user_name, body, created_at')
      .single();
    if (error) throw new Error(error.message);
    return data;
  });
  return {
    id: dane.id, userId: dane.user_id, userName: dane.user_name,
    body: dane.body, createdAt: dane.created_at,
  };
}

/** Miękkie kasowanie — przez `zaktualizujJedenWiersz`, żeby zapis, który nie
 *  zmienił żadnego wiersza, był błędem, a nie ciszą (patrz `lib/zapytania.ts`). */
export async function usunWiadomoscDruzyny(id: string): Promise<void> {
  await zPonowieniemPoOdswiezeniu(() => zaktualizujJedenWiersz(
    'event_team_messages', id, { deleted_at: new Date().toISOString() },
    'Nie udało się usunąć wiadomości',
  ));
}
