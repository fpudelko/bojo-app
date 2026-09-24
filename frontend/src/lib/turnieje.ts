// Turniej: CRUD, listy, uprawnienia. Wzorem `lib/groups.ts` — komponenty nie
// omijają tego pliku, żadne zapytanie do `turnieje`/`turniej_osoby` nie żyje
// bezpośrednio w komponencie. Plan → docs/turnieje-plan-*.md.

import { supabase } from './supabase';
import { validateName, sanitizeDescription } from './validation';
import { track } from './analytics';
import { zaktualizujJedenWiersz } from './zapytania';
import type { Turniej, TurniejCreate, TurniejOsoba, TurniejOgloszenie, TurniejStatus, TurniejUprawnienia } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toTurniej(row: any): Turniej {
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
    // HH:MM, nie HH:MM:SS. Postgres oddaje kolumnę `time` z sekundami, a cała
    // reszta aplikacji zakłada format z TimeSelect, czyli bez nich. Rozjazd
    // wywracał układanie terminarza: `${dataStartu}T${godzinaStartu}:00` dawało
    // `2026-10-24T10:00:00:00`, czyli nieprawidłową datę, a `toISOString()`
    // rzucało RangeError wewnątrz obsługi kliknięcia. Przycisk „Wygeneruj
    // terminarz" nie robił NIC i nie mówił dlaczego.
    //
    // Normalizacja siedzi tutaj, na granicy z bazą, bo to jedyne miejsce,
    // przez które ta wartość wchodzi do aplikacji.
    godzinaStartu: String(row.godzina_startu ?? '').slice(0, 5),
    zapisyDo: row.zapisy_do ?? undefined,
    maxDruzyn: row.max_druzyn,
    minDruzyn: row.min_druzyn ?? undefined,
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
    // WYŁĄCZNIE przyjęte, ta sama reguła co `zajmujeMiejsce()`. Surowa długość
    // osadzonej tablicy liczyła też zgłoszenia czekające na decyzję, więc karta
    // na liście mówiła „2/8 drużyn" w chwili, gdy strona turnieju mówiła
    // „0 drużyn z 8". To CZWARTE miejsce, w którym ta reguła się rozjechała,
    // dlatego liczenie schodzi tu, do mapowania wiersza: wyżej nikt już nie
    // musi o niej pamiętać.
    liczbaDruzyn: Array.isArray(row.turniej_druzyny)
      ? (row.turniej_druzyny as { status?: string }[]).filter((d) => d.status === 'przyjeta').length
      : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOsoba(row: any, profil?: { display_name?: string | null; avatar_url?: string | null }): TurniejOsoba {
  return {
    turniejId: row.turniej_id,
    userId: row.user_id,
    mozeEdytowac: row.moze_edytowac,
    mozeProwadzic: row.moze_prowadzic,
    mozeZarzadzacDruzynami: row.moze_zarzadzac_druzynami,
    imie: profil?.display_name?.trim() || undefined,
    avatarUrl: profil?.avatar_url ?? undefined,
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
export function przyjmujeZgloszenia(
  t: Pick<Turniej, 'status' | 'maxDruzyn' | 'zapisyDo'>,
  liczbaDruzyn: number,
  teraz: Date = new Date(),
): boolean {
  if (t.status !== 'zapisy' || liczbaDruzyn >= t.maxDruzyn) return false;
  // `zapisy_do` istniało w bazie od migracji `145` i było IGNOROWANE: kolumna
  // bez skutku to gorzej niż brak kolumny, bo organizator ją wypełnia i wierzy,
  // że działa. Termin graniczny jest też jedynym powodem, dla którego kapitan
  // zgłasza drużynę dziś, a nie „kiedyś".
  if (t.zapisyDo && new Date(t.zapisyDo).getTime() <= teraz.getTime()) return false;
  return true;
}

export type ZakladkaTurnieju = 'info' | 'mecze' | 'tabela' | 'druzyny';

/**
 * Która zakładka ma być domyślna — ktoś, kto wchodzi, ma od razu odpowiedź na
 * pytanie, z którym wszedł.
 *
 * Ta funkcja istniała od migracji `145` i NIE BYŁA UŻYWANA: strona turnieju
 * twardo otwierała „Mecze", więc każdy link udostępniony w okresie zapisów —
 * czyli każdy link, jaki organizator wysyła na Facebooka — lądował na napisie
 * „Terminarz jeszcze nie jest gotowy". Przy okazji podpięcia dostaje nazwy
 * zakładek, które naprawdę istnieją (po przebudowie z 2026-09-17 jest ich
 * cztery, nie sześć).
 *
 * Bierze też pod uwagę, CO JEST DO ZOBACZENIA, nie tylko kolumnę `status`:
 * pusta zakładka jest gorsza niż jej brak, a turniej ze „zamkniętymi zapisami"
 * bez wygenerowanego terminarza to stan normalny, nie wyjątek.
 */
export function domyslnaZakladka(
  status: TurniejStatus,
  zawartosc: { maMecze: boolean; maTabele: boolean } = { maMecze: false, maTabele: false },
): ZakladkaTurnieju {
  switch (status) {
    // Zapisy: człowiek z ulicy pyta „co to za turniej i czy się załapię".
    // Odpowiada Info (format, zasady, wpisowe, organizator) — sam termin,
    // miejsce i licznik miejsc stoją i tak nad zakładkami.
    case 'szkic':
    case 'zapisy': return 'info';
    case 'zamkniete_zapisy': return zawartosc.maMecze ? 'mecze' : 'druzyny';
    case 'trwa': return zawartosc.maMecze ? 'mecze' : 'druzyny';
    case 'zakonczony': return zawartosc.maTabele ? 'tabela' : 'mecze';
    case 'odwolany': return 'info';
    default: return 'mecze';
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
  // `null`, nie pominięcie: organizator kasujący minimum w edycji musi móc
  // wrócić do stanu „nie podałem". Bez tego raz wpisana liczba zostawała
  // w bazie na zawsze.
  if (dane.minDruzyn !== undefined) row.min_druzyn = dane.minDruzyn || null;
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
    .select('*, turniej_druzyny(id, status)')
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
    supabase.from('turnieje').select('*, turniej_druzyny(id, status)').eq('organizator_id', userId),
    supabase.from('turniej_zawodnicy').select('turniej_id').eq('user_id', userId),
  ]);
  if (organizowane.error) throw new Error(organizowane.error.message);
  if (graneRaw.error) throw new Error(graneRaw.error.message);

  const idOrganizowanych = new Set((organizowane.data ?? []).map((r) => r.id as string));
  const idGranych = Array.from(new Set((graneRaw.data ?? []).map((r) => r.turniej_id as string)))
    .filter((id) => !idOrganizowanych.has(id));

  let grane: Turniej[] = [];
  if (idGranych.length > 0) {
    const { data, error } = await supabase.from('turnieje').select('*, turniej_druzyny(id, status)').in('id', idGranych);
    if (error) throw new Error(error.message);
    grane = (data ?? []).map(toTurniej);
  }

  const wszystkie = [...(organizowane.data ?? []).map(toTurniej), ...grane];
  return wszystkie.sort((a, b) => a.dataStartu.localeCompare(b.dataStartu));
}

// ---------------------------------------------------------------------------
// Uprawnienia osób
// ---------------------------------------------------------------------------

/**
 * Osoby z uprawnieniami razem z nazwą i awatarem — dla panelu turnieju.
 *
 * Dwa zapytania, nie jeden `select` z zagnieżdżeniem: `turniej_osoby.user_id`
 * ma klucz obcy do `auth.users`, nie do `profiles` (migracja `145`), więc
 * PostgREST nie ma jak wbudować tego joinem i odpowiada `PGRST200`
 * („Could not find a relationship between 'turniej_osoby' and 'profiles'").
 * Ten sam wzorzec co `getEventInvitesWithNames()` w `lib/playerInvites.ts`.
 * `profiles` jest publicznie czytelne (migracja `005`), więc drugie zapytanie
 * nie wymaga dodatkowych uprawnień.
 */
export async function getOsobyTurnieju(turniejId: string): Promise<TurniejOsoba[]> {
  const { data, error } = await supabase
    .from('turniej_osoby')
    .select('*')
    .eq('turniej_id', turniejId);
  if (error) throw new Error(error.message);
  const wiersze = data ?? [];
  if (wiersze.length === 0) return [];

  const { data: profile, error: bladProfili } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', wiersze.map((r) => r.user_id as string));
  if (bladProfili) throw new Error(bladProfili.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wgId = new Map((profile ?? []).map((p: any) => [p.id as string, p]));

  return wiersze.map((r) => toOsoba(r, wgId.get(r.user_id as string)));
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

// ---------------------------------------------------------------------------
// Ogłoszenia — publiczne, pisze wyłącznie zarządzający turniejem (migracja `150`)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOgloszenie(row: any): TurniejOgloszenie {
  return {
    id: row.id,
    turniejId: row.turniej_id,
    autorId: row.autor_id,
    tresc: row.tresc,
    createdAt: row.created_at,
  };
}

export async function getOgloszenia(turniejId: string): Promise<TurniejOgloszenie[]> {
  const { data, error } = await supabase
    .from('turniej_ogloszenia')
    .select('*')
    .eq('turniej_id', turniejId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toOgloszenie);
}

export async function dodajOgloszenie(turniejId: string, autorId: string, tresc: string): Promise<string> {
  const bezpieczneTresc = sanitizeDescription(tresc).trim();
  if (!bezpieczneTresc) throw new Error('Treść ogłoszenia nie może być pusta.');
  const { data, error } = await supabase
    .from('turniej_ogloszenia')
    .insert({ turniej_id: turniejId, autor_id: autorId, tresc: bezpieczneTresc })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function usunOgloszenie(id: string): Promise<void> {
  const { error } = await supabase.from('turniej_ogloszenia').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// BLIK organizatora — osobna tabela, ten sam powód co `event_blik` (migracja
// `120`): RLS jest wierszowe, a `turnieje` czyta każdy (migracja `150`).
// ---------------------------------------------------------------------------

export async function getBlikTurnieju(turniejId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('turniej_blik')
    .select('blik_telefon')
    .eq('turniej_id', turniejId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.blik_telefon ?? null;
}

/** Organizator ustawia/zmienia numer. RLS (migracja `150`) przepuszcza
 *  wyłącznie zarządzającego turniejem. */
export async function ustawBlikTurnieju(turniejId: string, telefon: string): Promise<void> {
  const bezpiecznyTelefon = telefon.trim();
  if (!bezpiecznyTelefon) throw new Error('Podaj numer telefonu.');
  const { error } = await supabase
    .from('turniej_blik')
    .upsert({ turniej_id: turniejId, blik_telefon: bezpiecznyTelefon }, { onConflict: 'turniej_id' });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Statystyki turniejowe gracza — sekcja „Turnieje" na /gracz/[id]
// ---------------------------------------------------------------------------

export interface StatystykiTurniejoweGracza {
  turniejow: number;
  meczow: number;
  goli: number;
  asyst: number;
  mvp: number;
}

export interface TurniejGracza {
  turniejId: string;
  nazwa: string;
  sport: string;
  dataStartu: string;
  druzyna: string;
  wygrany: boolean;
  meczow: number;
  goli: number;
}

/**
 * Liczby do sekcji „Turnieje" na profilu (migracja `156`).
 *
 * ŚWIADOMIE OSOBNO od `get_player_stats()`: tamta liczy mecze, a jej
 * `matchesPlayed`/`noShows` sterują odznaką rzetelnego gracza i paskiem
 * frekwencji. Dopisanie tam turniejów zmieniłoby po cichu znaczenie liczb,
 * które ludzie już widzieli.
 *
 * Funkcja w bazie jest `SECURITY INVOKER`, więc ściana logowania modułu
 * egzekwuje się sama — niezalogowany dostanie zera, nie błąd.
 */
export async function getStatystykiTurniejoweGracza(userId: string): Promise<StatystykiTurniejoweGracza | null> {
  const { data, error } = await supabase.rpc('get_player_turniej_stats', { p_user_id: userId });
  if (error) throw new Error(error.message);
  const wiersz = Array.isArray(data) ? data[0] : data;
  if (!wiersz) return null;
  return {
    turniejow: wiersz.turniejow ?? 0,
    meczow: wiersz.meczow ?? 0,
    goli: wiersz.goli ?? 0,
    asyst: wiersz.asyst ?? 0,
    mvp: wiersz.mvp ?? 0,
  };
}

/** Ostatnie turnieje gracza — nazwa, drużyna i czy wygrała finał (`156`). */
export async function getTurniejeGracza(userId: string, limit = 3): Promise<TurniejGracza[]> {
  const { data, error } = await supabase.rpc('get_player_turnieje', { p_user_id: userId, p_limit: limit });
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    turniejId: r.turniej_id,
    nazwa: r.nazwa,
    sport: r.sport,
    dataStartu: r.data_startu,
    druzyna: r.druzyna,
    wygrany: !!r.wygrany,
    meczow: r.meczow ?? 0,
    goli: r.goli ?? 0,
  }));
}
