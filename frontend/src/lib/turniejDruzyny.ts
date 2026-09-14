// Drużyny turniejowe: zgłoszenia, składy, kod dołączenia. Wzorem
// `lib/turnieje.ts` — komponenty nie omijają tego pliku.

import { supabase } from './supabase';
import { validateName, validatePhone, normalizePhone, validateEmail } from './validation';
import { track } from './analytics';
import { zaktualizujJedenWiersz } from './zapytania';
import type { DruzynaStatus, Turniej, TurniejDruzyna, TurniejZawodnik } from '@/types';

const DRUZYNA_COLS =
  'id,turniej_id,nazwa,kapitan_id,kod_dolaczenia,status,dodana_recznie,grupa_id,' +
  'rozstawienie,pozycja_recznie,kontakt_imie,wpisowe_oplacone_at,regulamin_zaakceptowany_at,created_at';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDruzyna(row: any): TurniejDruzyna {
  return {
    id: row.id,
    turniejId: row.turniej_id,
    nazwa: row.nazwa,
    kapitanId: row.kapitan_id ?? undefined,
    kodDolaczenia: row.kod_dolaczenia,
    status: row.status,
    dodanaRecznie: row.dodana_recznie,
    grupaId: row.grupa_id ?? undefined,
    rozstawienie: row.rozstawienie ?? undefined,
    pozycjaRecznie: row.pozycja_recznie ?? undefined,
    kontaktImie: row.kontakt_imie ?? undefined,
    wpisoweOplaconeAt: row.wpisowe_oplacone_at ?? undefined,
    regulaminZaakceptowanyAt: row.regulamin_zaakceptowany_at ?? undefined,
    createdAt: row.created_at,
    zawodnicy: Array.isArray(row.turniej_zawodnicy) ? row.turniej_zawodnicy.map(toZawodnik) : undefined,
    liczbaZawodnikow: Array.isArray(row.turniej_zawodnicy) ? row.turniej_zawodnicy.length : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toZawodnik(row: any): TurniejZawodnik {
  return {
    id: row.id,
    druzynaId: row.druzyna_id,
    turniejId: row.turniej_id,
    userId: row.user_id ?? undefined,
    imie: row.imie,
    numer: row.numer ?? undefined,
    kapitan: row.kapitan,
    createdAt: row.created_at,
  };
}

export interface ZgloszenieDruzyny {
  nazwa: string;
  kontaktImie?: string;
  kontaktTelefon?: string;
  kontaktEmail?: string;
}

export interface KontaktDruzyny {
  druzynaId: string;
  druzyna: string;
  kapitan?: string;
  telefon?: string;
  email?: string;
  oplacone: boolean;
}

// ---------------------------------------------------------------------------
// Odczyt
// ---------------------------------------------------------------------------

export async function getDruzyny(turniejId: string): Promise<TurniejDruzyna[]> {
  const { data, error } = await supabase
    .from('turniej_druzyny')
    .select(DRUZYNA_COLS)
    .eq('turniej_id', turniejId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toDruzyna);
}

/** Ze składem — dla `anon` `turniej_zawodnicy` przyjdzie zawsze puste (ściana
 *  logowania w RLS), więc wywołanie jest bezpieczne niezależnie od tego, kto pyta. */
export async function getDruzynyZeSkladem(turniejId: string): Promise<TurniejDruzyna[]> {
  const { data, error } = await supabase
    .from('turniej_druzyny')
    .select(`${DRUZYNA_COLS}, turniej_zawodnicy(*)`)
    .eq('turniej_id', turniejId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toDruzyna);
}

export async function getDruzyna(id: string): Promise<TurniejDruzyna | null> {
  const { data, error } = await supabase
    .from('turniej_druzyny')
    .select(`${DRUZYNA_COLS}, turniej_zawodnicy(*)`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toDruzyna(data) : null;
}

export async function getDruzynaPoKodzie(kod: string): Promise<TurniejDruzyna | null> {
  const { data, error } = await supabase
    .from('turniej_druzyny')
    .select(`${DRUZYNA_COLS}, turniej_zawodnicy(*)`)
    .ilike('kod_dolaczenia', kod.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toDruzyna(data) : null;
}

/** Drużyna, w której gram w tym turnieju (kapitan albo zawodnik) — steruje
 *  filtrem „tylko moja drużyna" na terminarzu (od Etapu 1). */
export async function getMojaDruzyne(turniejId: string, userId: string): Promise<TurniejDruzyna | null> {
  const { data, error } = await supabase
    .from('turniej_zawodnicy')
    .select(`turniej_druzyny(${DRUZYNA_COLS})`)
    .eq('turniej_id', turniejId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const druzyna = (data as any)?.turniej_druzyny; // eslint-disable-line @typescript-eslint/no-explicit-any
  return druzyna ? toDruzyna(druzyna) : null;
}

export async function getKontakty(turniejId: string): Promise<KontaktDruzyny[]> {
  const { data, error } = await supabase.rpc('turniej_kontakty', { p_turniej: turniejId });
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    druzynaId: r.druzyna_id,
    druzyna: r.druzyna,
    kapitan: r.kapitan ?? undefined,
    telefon: r.telefon ?? undefined,
    email: r.email ?? undefined,
    oplacone: r.oplacone,
  }));
}

// ---------------------------------------------------------------------------
// Zapis — drużyny
// ---------------------------------------------------------------------------

export async function zglosDruzyne(turniejId: string, dane: ZgloszenieDruzyny, userId: string): Promise<string> {
  const nazwa = validateName(dane.nazwa, 'Nazwa drużyny', 40);
  if (nazwa.length < 2) throw new Error('Nazwa drużyny musi mieć co najmniej 2 znaki.');
  if (dane.kontaktTelefon && !validatePhone(dane.kontaktTelefon)) {
    throw new Error('Podaj poprawny numer telefonu.');
  }
  const email = dane.kontaktEmail ? validateEmail(dane.kontaktEmail) : undefined;

  const { data, error } = await supabase
    .from('turniej_druzyny')
    .insert({
      turniej_id: turniejId,
      nazwa,
      kapitan_id: userId,
      kontakt_imie: dane.kontaktImie?.trim() || null,
      kontakt_telefon: dane.kontaktTelefon ? normalizePhone(dane.kontaktTelefon) : null,
      kontakt_email: email ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  track('turniej_druzyna_zgloszona', { turniejId, druzynaId: data.id });
  return data.id as string;
}

export async function dodajDruzyneRecznie(turniejId: string, nazwa: string, kontaktImie?: string): Promise<string> {
  const safeName = validateName(nazwa, 'Nazwa drużyny', 40);
  const { data, error } = await supabase
    .from('turniej_druzyny')
    .insert({
      turniej_id: turniejId,
      nazwa: safeName,
      dodana_recznie: true,
      status: 'przyjeta',
      kontakt_imie: kontaktImie?.trim() || null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function setStatusDruzyny(id: string, status: DruzynaStatus): Promise<void> {
  await zaktualizujJedenWiersz('turniej_druzyny', id, { status }, 'Nie udało się zmienić statusu drużyny');
}

export async function setWpisowe(id: string, oplacone: boolean): Promise<void> {
  await zaktualizujJedenWiersz(
    'turniej_druzyny', id,
    { wpisowe_oplacone_at: oplacone ? new Date().toISOString() : null },
    'Nie udało się zapisać wpisowego',
  );
}

export async function ustawGrupeDruzyny(id: string, grupaId: string | null): Promise<void> {
  await zaktualizujJedenWiersz('turniej_druzyny', id, { grupa_id: grupaId }, 'Nie udało się przypisać drużyny do grupy');
}

export async function updateDruzyne(id: string, dane: Partial<ZgloszenieDruzyny>): Promise<void> {
  const zmiany: Record<string, unknown> = {};
  if (dane.nazwa !== undefined) zmiany.nazwa = validateName(dane.nazwa, 'Nazwa drużyny', 40);
  if (dane.kontaktImie !== undefined) zmiany.kontakt_imie = dane.kontaktImie?.trim() || null;
  if (dane.kontaktTelefon !== undefined) {
    if (dane.kontaktTelefon && !validatePhone(dane.kontaktTelefon)) throw new Error('Podaj poprawny numer telefonu.');
    zmiany.kontakt_telefon = dane.kontaktTelefon ? normalizePhone(dane.kontaktTelefon) : null;
  }
  if (dane.kontaktEmail !== undefined) zmiany.kontakt_email = dane.kontaktEmail ? validateEmail(dane.kontaktEmail) : null;
  await zaktualizujJedenWiersz('turniej_druzyny', id, zmiany, 'Nie udało się zapisać drużyny');
}

export async function usunDruzyne(id: string): Promise<void> {
  const { error } = await supabase.from('turniej_druzyny').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Zapis — skład
// ---------------------------------------------------------------------------

export async function dodajZawodnika(druzynaId: string, turniejId: string, imie: string, numer?: number): Promise<string> {
  const safeName = validateName(imie, 'Imię i nazwisko', 60);
  const { data, error } = await supabase
    .from('turniej_zawodnicy')
    .insert({ druzyna_id: druzynaId, turniej_id: turniejId, imie: safeName, numer: numer ?? null })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateZawodnika(id: string, dane: { imie?: string; numer?: number | null }): Promise<void> {
  const zmiany: Record<string, unknown> = {};
  if (dane.imie !== undefined) zmiany.imie = validateName(dane.imie, 'Imię i nazwisko', 60);
  if (dane.numer !== undefined) zmiany.numer = dane.numer;
  await zaktualizujJedenWiersz('turniej_zawodnicy', id, zmiany, 'Nie udało się zapisać zawodnika');
}

export async function usunZawodnika(id: string): Promise<void> {
  const { error } = await supabase.from('turniej_zawodnicy').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Jedyna droga wejścia do drużyny — RPC `dolacz_do_druzyny_kodem` (145).
 *  Kapitanat, przypisanie do wolnego wpisu („to ja") albo dopisanie nowego
 *  — wszystkie trzy sprawdzają w JEDNEJ transakcji stan turnieju, limit
 *  składu i unikalność osoby, żeby te reguły nie rozjechały się między
 *  trzema osobnymi ścieżkami po stronie klienta. */
export async function dolaczDoDruzyny(
  kod: string,
  opcje: { jakoKapitan?: boolean; zawodnikId?: string; imie?: string } = {},
): Promise<{ druzynaId: string; turniejId: string; zostalKapitanem: boolean; zawodnikId: string }> {
  const { data, error } = await supabase.rpc('dolacz_do_druzyny_kodem', {
    p_kod: kod,
    p_jako_kapitan: opcje.jakoKapitan ?? false,
    p_zawodnik_id: opcje.zawodnikId ?? null,
    p_imie: opcje.imie ?? null,
  });
  if (error) throw new Error(error.message);
  const wiersz = Array.isArray(data) ? data[0] : data;
  track('turniej_dolaczyl_do_druzyny', { druzynaId: wiersz.druzyna_id, zostalKapitanem: wiersz.zostal_kapitanem });
  return {
    druzynaId: wiersz.druzyna_id,
    turniejId: wiersz.turniej_id,
    zostalKapitanem: wiersz.zostal_kapitanem,
    zawodnikId: wiersz.zawodnik_id,
  };
}

// ---------------------------------------------------------------------------
// Czyste funkcje
// ---------------------------------------------------------------------------

/** Czy skład wolno jeszcze zmieniać — stan turnieju i drużyny razem. */
export function mozeEdytowacSklad(t: Pick<Turniej, 'status'>, d: Pick<TurniejDruzyna, 'status'>): boolean {
  if (t.status === 'zakonczony' || t.status === 'odwolany') return false;
  if (d.status === 'odrzucona' || d.status === 'wycofana') return false;
  return true;
}

/** Braki w składzie względem `minZawodnikow` — do plakietki „brakuje N osób". */
export function brakiWSkladzie(t: Pick<Turniej, 'minZawodnikow'>, liczba: number): number {
  return Math.max(0, t.minZawodnikow - liczba);
}
