// Turniej: CRUD, listy, uprawnienia. Wzorem `lib/groups.ts` — komponenty nie
// omijają tego pliku, żadne zapytanie do `turnieje`/`turniej_osoby` nie żyje
// bezpośrednio w komponencie. Plan → docs/turnieje-plan-*.md.

import { supabase } from './supabase';
import { validateName, sanitizeDescription } from './validation';
import { track } from './analytics';
import { zaktualizujJedenWiersz } from './zapytania';
import type { Turniej, TurniejCreate, TurniejOsoba, TurniejStatus, TurniejUprawnienia } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTurniej(row: any): Turniej {
  return {
    id: row.id,
    organizatorId: row.organizator_id,
    nazwa: row.nazwa,
    sport: row.sport,
    format: row.format,
    status: row.status,
    widocznosc: row.widocznosc,
    fieldId: row.field_id ?? undefined,
    miejsceNazwa: row.miejsce_nazwa ?? undefined,
    miejsceAdres: row.miejsce_adres ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    miasto: row.miasto ?? undefined,
    dataStartu: row.data_startu,
    dataKonca: row.data_konca ?? undefined,
    godzinaStartu: row.godzina_startu,
    zapisyDo: row.zapisy_do ?? undefined,
    maxDruzyn: row.max_druzyn,
    minZawodnikow: row.min_zawodnikow,
    maxZawodnikow: row.max_zawodnikow,
    graczyWPolu: row.graczy_w_polu ?? undefined,
    liczbaGrup: row.liczba_grup ?? undefined,
    awansujeZGrupy: row.awansuje_z_grupy,
    meczO3Miejsce: row.mecz_o_3_miejsce,
    czasMeczuMin: row.czas_meczu_min,
    przerwaMin: row.przerwa_min,
    punktyZaWygrana: row.punkty_za_wygrana,
    punktyZaRemis: row.punkty_za_remis,
    karnePrzyRemisie: row.karne_przy_remisie,
    wpisoweGrosze: row.wpisowe_grosz,
    regulamin: row.regulamin ?? undefined,
    opis: row.opis ?? undefined,
    okladkaUrl: row.okladka_url ?? undefined,
    wymagaAkceptacji: row.wymaga_akceptacji,
    mvpZawodnikId: row.mvp_zawodnik_id ?? undefined,
    createdAt: row.created_at,
    liczbaDruzyn: Array.isArray(row.turniej_druzyny) ? row.turniej_druzyny.length : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOsoba(row: any): TurniejOsoba {
  return {
    turniejId: row.turniej_id,
    userId: row.user_id,
    mozeEdytowac: row.moze_edytowac,
    mozeProwadzic: row.moze_prowadzic,
    mozeZarzadzacDruzynami: row.moze_zarzadzac_druzynami,
    imie: row.profiles?.display_name ?? undefined,
    avatarUrl: row.profiles?.avatar_url ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Uprawnienia — czyste funkcje, lustro tego, co liczy RLS w bazie
// ---------------------------------------------------------------------------

/**
 * Uprawnienia wyliczone TAK SAMO, jak liczą je funkcje `czy_organizator_turnieju()`
 * / `czy_zarzadza_turniejem()` / `czy_zarzadza_druzynami()` w bazie (migracja `145`):
 * organizator ma zawsze komplet, niezależnie od tego, czy ma wiersz w `turniej_osoby`.
 * Czysta funkcja — UI może jej użyć od razu, bez czekania na drugi round-trip.
 */
export function uprawnieniaTurnieju(
  turniej: Pick<Turniej, 'organizatorId'>,
  osoba: Pick<TurniejOsoba, 'userId' | 'mozeEdytowac' | 'mozeProwadzic' | 'mozeZarzadzacDruzynami'> | null | undefined,
  userId: string | undefined,
): TurniejUprawnienia {
  const jestOrganizatorem = !!userId && turniej.organizatorId === userId;
  if (jestOrganizatorem) {
    return { jestOrganizatorem: true, mozeEdytowac: true, mozeProwadzic: true, mozeZarzadzacDruzynami: true };
  }
  const maWlasny = !!osoba && !!userId && osoba.userId === userId;
  const mozeEdytowac = !!maWlasny && osoba!.mozeEdytowac;
  return {
    jestOrganizatorem: false,
    mozeEdytowac,
    // `mozeEdytowac` jest nadzbiorem pozostałych dwóch — dokładnie jak
    // w polityce RLS `czy_zarzadza_druzynami()`, która woła `czy_zarzadza_turniejem()`.
    mozeProwadzic: mozeEdytowac || (!!maWlasny && osoba!.mozeProwadzic),
    mozeZarzadzacDruzynami: mozeEdytowac || (!!maWlasny && osoba!.mozeZarzadzacDruzynami),
  };
}

/** Czy w tym stanie i przy tej liczbie drużyn wolno jeszcze przyjmować zgłoszenia. */
export function przyjmujeZgloszenia(t: Pick<Turniej, 'status' | 'maxDruzyn'>, liczbaDruzyn: number): boolean {
  return t.status === 'zapisy' && liczbaDruzyn < t.maxDruzyn;
}

/**
 * Która zakładka ma być domyślna dla tego stanu turnieju — ktoś, kto wchodzi
 * w trakcie, ma od razu odpowiedź na pytanie, z którym wszedł.
 */
export function domyslnaZakladka(status: TurniejStatus): 'terminarz' | 'druzyny' | 'tabela' | 'info' {
  switch (status) {
    case 'trwa': return 'terminarz';
    case 'zamkniete_zapisy': return 'druzyny';
    case 'zakonczony':
    case 'odwolany': return 'tabela';
    default: return 'info';
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(dane: Partial<TurniejCreate>): Record<string, any> {
  const row: Record<string, unknown> = {};
  if (dane.nazwa !== undefined) row.nazwa = validateName(dane.nazwa, 'Nazwa turnieju', 80);
  if (dane.sport !== undefined) row.sport = dane.sport;
  if (dane.format !== undefined) row.format = dane.format;
  if (dane.widocznosc !== undefined) row.widocznosc = dane.widocznosc;
  if (dane.fieldId !== undefined) row.field_id = dane.fieldId || null;
  if (dane.miejsceNazwa !== undefined) row.miejsce_nazwa = dane.miejsceNazwa?.trim() || null;
  if (dane.miejsceAdres !== undefined) row.miejsce_adres = dane.miejsceAdres?.trim() || null;
  if (dane.lat !== undefined) row.lat = dane.lat;
  if (dane.lng !== undefined) row.lng = dane.lng;
  if (dane.miasto !== undefined) row.miasto = dane.miasto?.trim() || null;
  if (dane.dataStartu !== undefined) row.data_startu = dane.dataStartu;
  if (dane.dataKonca !== undefined) row.data_konca = dane.dataKonca || null;
  if (dane.godzinaStartu !== undefined) row.godzina_startu = dane.godzinaStartu;
  if (dane.zapisyDo !== undefined) row.zapisy_do = dane.zapisyDo || null;
  if (dane.maxDruzyn !== undefined) row.max_druzyn = dane.maxDruzyn;
  if (dane.minZawodnikow !== undefined) row.min_zawodnikow = dane.minZawodnikow;
  if (dane.maxZawodnikow !== undefined) row.max_zawodnikow = dane.maxZawodnikow;
  if (dane.graczyWPolu !== undefined) row.graczy_w_polu = dane.graczyWPolu ?? null;
  if (dane.liczbaGrup !== undefined) row.liczba_grup = dane.liczbaGrup ?? null;
  if (dane.awansujeZGrupy !== undefined) row.awansuje_z_grupy = dane.awansujeZGrupy;
  if (dane.meczO3Miejsce !== undefined) row.mecz_o_3_miejsce = dane.meczO3Miejsce;
  if (dane.czasMeczuMin !== undefined) row.czas_meczu_min = dane.czasMeczuMin;
  if (dane.przerwaMin !== undefined) row.przerwa_min = dane.przerwaMin;
  if (dane.punktyZaWygrana !== undefined) row.punkty_za_wygrana = dane.punktyZaWygrana;
  if (dane.punktyZaRemis !== undefined) row.punkty_za_remis = dane.punktyZaRemis;
  if (dane.karnePrzyRemisie !== undefined) row.karne_przy_remisie = dane.karnePrzyRemisie;
  if (dane.wpisoweGrosze !== undefined) row.wpisowe_grosz = dane.wpisoweGrosze;
  if (dane.regulamin !== undefined) row.regulamin = dane.regulamin?.trim() || null;
  if (dane.opis !== undefined) row.opis = dane.opis ? sanitizeDescription(dane.opis) : null;
  if (dane.wymagaAkceptacji !== undefined) row.wymaga_akceptacji = dane.wymagaAkceptacji;
  return row;
}

export async function createTurniej(dane: TurniejCreate, userId: string): Promise<string> {
  const row = toRow(dane);
  row.organizator_id = userId;
  // Kreator jest jednym ekranem, bez osobnego kroku „Opublikuj" — kliknięcie
  // „Utwórz turniej" znaczy „otwórz zapisy teraz". Domyślne `szkic` w bazie
  // zostaje dla ewentualnego wejścia z panelu (np. import/duplikacja w
  // przyszłości), które tego kroku by nie chciało.
  row.status = 'zapisy';
  const { data, error } = await supabase.from('turnieje').insert(row).select('id').single();
  if (error) throw new Error(error.message);
  track('turniej_utworzony', { turniejId: data.id, sport: dane.sport, format: dane.format });
  return data.id as string;
}

export async function updateTurniej(id: string, dane: Partial<TurniejCreate>): Promise<void> {
  await zaktualizujJedenWiersz('turnieje', id, toRow(dane), 'Nie udało się zapisać turnieju');
}

export async function setStatusTurnieju(id: string, status: TurniejStatus): Promise<void> {
  await zaktualizujJedenWiersz('turnieje', id, { status }, 'Nie udało się zmienić stanu turnieju');
}

export async function deleteTurniej(id: string): Promise<void> {
  const { error } = await supabase.from('turnieje').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setOkladkaTurnieju(id: string, url: string | null): Promise<void> {
  await zaktualizujJedenWiersz('turnieje', id, { okladka_url: url }, 'Nie udało się zapisać okładki');
}

// ---------------------------------------------------------------------------
// Listy
// ---------------------------------------------------------------------------

export async function getTurniej(id: string): Promise<Turniej | null> {
  const { data, error } = await supabase.from('turnieje').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toTurniej(data) : null;
}

/** Publiczne, nie-szkic i nie-odwołane, posortowane po dacie startu — na `/turnieje`. */
export async function getTurniejePubliczne(limit = 50): Promise<Turniej[]> {
  const { data, error } = await supabase
    .from('turnieje')
    .select('*, turniej_druzyny(id)')
    .eq('widocznosc', 'publiczny')
    .in('status', ['zapisy', 'zamkniete_zapisy', 'trwa', 'zakonczony'])
    .order('data_startu', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toTurniej);
}

/** Organizowane przeze mnie + te, w których gram (przez `turniej_zawodnicy`). */
export async function getMojeTurnieje(userId: string): Promise<Turniej[]> {
  const [organizowane, graneRaw] = await Promise.all([
    supabase.from('turnieje').select('*, turniej_druzyny(id)').eq('organizator_id', userId),
    supabase.from('turniej_zawodnicy').select('turniej_id').eq('user_id', userId),
  ]);
  if (organizowane.error) throw new Error(organizowane.error.message);
  if (graneRaw.error) throw new Error(graneRaw.error.message);

  const idOrganizowanych = new Set((organizowane.data ?? []).map((r) => r.id as string));
  const idGranych = Array.from(new Set((graneRaw.data ?? []).map((r) => r.turniej_id as string)))
    .filter((id) => !idOrganizowanych.has(id));

  let grane: Turniej[] = [];
  if (idGranych.length > 0) {
    const { data, error } = await supabase.from('turnieje').select('*, turniej_druzyny(id)').in('id', idGranych);
    if (error) throw new Error(error.message);
    grane = (data ?? []).map(toTurniej);
  }

  const wszystkie = [...(organizowane.data ?? []).map(toTurniej), ...grane];
  return wszystkie.sort((a, b) => a.dataStartu.localeCompare(b.dataStartu));
}

// ---------------------------------------------------------------------------
// Uprawnienia osób
// ---------------------------------------------------------------------------

export async function getOsobyTurnieju(turniejId: string): Promise<TurniejOsoba[]> {
  const { data, error } = await supabase
    .from('turniej_osoby')
    .select('*, profiles(display_name, avatar_url)')
    .eq('turniej_id', turniejId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toOsoba);
}

export async function getMojaOsobe(turniejId: string, userId: string): Promise<TurniejOsoba | null> {
  const { data, error } = await supabase
    .from('turniej_osoby')
    .select('*')
    .eq('turniej_id', turniejId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toOsoba(data) : null;
}

export async function setUprawnieniaOsoby(
  turniejId: string,
  userId: string,
  u: Partial<Pick<TurniejOsoba, 'mozeEdytowac' | 'mozeProwadzic' | 'mozeZarzadzacDruzynami'>>,
): Promise<void> {
  const zmiany: Record<string, unknown> = {};
  if (u.mozeEdytowac !== undefined) zmiany.moze_edytowac = u.mozeEdytowac;
  if (u.mozeProwadzic !== undefined) zmiany.moze_prowadzic = u.mozeProwadzic;
  if (u.mozeZarzadzacDruzynami !== undefined) zmiany.moze_zarzadzac_druzynami = u.mozeZarzadzacDruzynami;

  const { error } = await supabase
    .from('turniej_osoby')
    .upsert({ turniej_id: turniejId, user_id: userId, ...zmiany }, { onConflict: 'turniej_id,user_id' });
  if (error) throw new Error(error.message);
}

export async function usunOsobeZTurnieju(turniejId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('turniej_osoby')
    .delete()
    .eq('turniej_id', turniejId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}
