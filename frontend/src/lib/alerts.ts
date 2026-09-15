import { supabase } from './supabase';
import { zaktualizujJedenWiersz } from './zapytania';
import type { GameAlert } from '@/types';
import { PROMIEN_DOMYSLNY_KM, indeksPromienia, promienZIndeksu } from './miejscowosci';
import { etykietaKiedy } from './eventFilters';
import { distanceKm } from './geo';
import { sportLabel } from './sports';

function toAlert(row: any): GameAlert {
  return {
    id:          row.id,
    userId:      row.user_id,
    // Wiersz sprzed migracji `152` ma wyłącznie `sport`; nowy ma `sports`.
    // Czytamy oba, bo migracje uruchamia się RĘCZNIE (AGENTS.md) i przez
    // chwilę baza może być starsza niż paczka JS.
    sports:      row.sports?.length ? row.sports : (row.sport ? [row.sport] : []),
    daysOfWeek:  row.days_of_week ?? [],
    lat:         row.lat,
    lng:         row.lng,
    radiusKm:    row.radius_km,
    cityLabel:   row.city_label ?? undefined,
    isActive:    row.is_active,
    createdAt:   row.created_at,
    expiresAt:   row.expires_at ?? undefined,
    godzinaOd:   row.godzina_od ?? undefined,
    godzinaDo:   row.godzina_do ?? undefined,
    kanalEmail:  row.kanal_email ?? true,
  };
}

/**
 * WIELE ALERTÓW NA KONTO — decyzja właściciela 2026-09-15.
 *
 * Schemat umiał to od zawsze: `game_alerts` nie ma unikalności na `user_id`,
 * a `notifications.alert_id` (migracja `025`) wskazuje KONKRETNY alert. Limit
 * „jeden na konto" siedział w jednej linijce `saveAlert()`, która przed każdym
 * zapisem gasiła wszystkie poprzednie — po cichu, bez ostrzeżenia i bez
 * cofnięcia. Kto założył alert na siatkówkę w Poznaniu, tracił ten na piłkę we
 * Wrocławiu i nie miał jak się o tym dowiedzieć.
 *
 * Zwraca TAKŻE wyłączone — lista w profilu ma je pokazać, żeby dało się je
 * włączyć z powrotem albo skasować. Kto pyta „czy mam jakiś alert", filtruje
 * `isActive` u siebie (`maAktywnyAlert()` niżej).
 *
 * Bez `.eq('user_id', …)`, bo pilnuje tego polityka `own_alerts` z `025`
 * (`auth.uid() = user_id`, `FOR ALL`) — ta sama zasada co przy reszcie zapytań
 * w tym pliku. Asercje w `supabase/test/rls.sql`.
 */
export async function getMojeAlerty(): Promise<GameAlert[]> {
  const { data } = await supabase
    .from('game_alerts')
    .select('*')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });
  return (data ?? []).map(toAlert);
}

/** Czy człowiek ma CHOĆ JEDEN działający alert — do stanu przycisku w pasku. */
export function maAktywnyAlert(alerty: GameAlert[]): boolean {
  return alerty.some((a) => a.isActive);
}

export interface AlertInput {
  /** Pusta tablica = dowolny sport. */
  sports:      string[];
  daysOfWeek:  number[];
  lat:         number;
  lng:         number;
  radiusKm:    number;
  cityLabel?:  string;
  /** ISO albo `null` = bezterminowo (domyślnie, decyzja właściciela 2026-09-14). */
  expiresAt?:  string | null;
  /** Para 0–23 albo oba `null` = dowolna pora. Migracja `149` pilnuje, że idą parami. */
  godzinaOd?:  number | null;
  godzinaDo?:  number | null;
  kanalEmail?: boolean;
}

/** Pola wiersza wspólne dla wstawiania i edycji — jedno miejsce, żeby przy
 *  dokładaniu kolumny nie dało się zaktualizować mniej, niż się wstawia. */
function doWiersza(input: AlertInput) {
  return {
    sports:       input.sports,
    // Stara kolumna zostaje wypełniona przy DOKŁADNIE jednym sporcie — czyta
    // ją starsza wersja `notify-game-alert`, wdrażana osobno od migracji
    // (AGENTS.md). Przy wielu sportach nie ma czego tam wpisać i wtedy stara
    // funkcja potraktuje alert jak „dowolny sport": za szeroko, ale nie za
    // wąsko — mail przyjdzie. Pilnuje tego `alert_sport_w_tablicy` z `152`.
    sport:        input.sports.length === 1 ? input.sports[0] : null,
    days_of_week: input.daysOfWeek,
    lat:          input.lat,
    lng:          input.lng,
    radius_km:    input.radiusKm,
    city_label:   input.cityLabel ?? null,
    expires_at:   input.expiresAt ?? null,
    godzina_od:   input.godzinaOd ?? null,
    godzina_do:   input.godzinaDo ?? null,
    kanal_email:  input.kanalEmail ?? true,
  };
}

/**
 * NOWY alert. NIE gasi poprzednich — patrz komentarz przy `getMojeAlerty()`.
 * Edycję istniejącego robi `zaktualizujAlert()` niżej, żeby zmiana alertu nie
 * zmieniała jego `id`: `notifications.alert_id` wskazuje konkretny wiersz,
 * a `wylacz_token` z wysłanych już maili musi dalej działać.
 */
export async function saveAlert(userId: string, input: AlertInput): Promise<GameAlert> {
  const { data, error } = await supabase
    .from('game_alerts')
    .insert({ user_id: userId, ...doWiersza(input) })
    .select()
    .single();
  if (error) throw error;
  return toAlert(data);
}

/** Edycja ISTNIEJĄCEGO alertu — ten sam wiersz, to samo `id`, ten sam token.
 *  Zapis wraca też do `is_active = true`: kto właśnie poprawiał wyłączony
 *  alert, chce go mieć z powrotem, a nie zapisać zmiany w czymś martwym. */
export async function zaktualizujAlert(id: string, input: AlertInput): Promise<GameAlert> {
  // Przez `zaktualizujJedenWiersz`, nie gołym `.update()`: niepasująca polityka
  // RLS nie rzuca błędu, tylko aktualizuje zero wierszy i zwraca sukces —
  // pułapka opisana w AGENTS.md. Bez tego „Zaktualizuj alert" mogłoby nic nie
  // robić i wyglądać na zapisane.
  await zaktualizujJedenWiersz(
    'game_alerts', id, { ...doWiersza(input), is_active: true },
    'Nie udało się zapisać alertu',
  );
  const { data, error } = await supabase.from('game_alerts').select('*').eq('id', id).single();
  if (error) throw error;
  return toAlert(data);
}

/** Włącz/wyłącz bez kasowania — to samo, co robi link „nie chcę więcej"
 *  z maila, tylko z drugiej strony. Wyłączony alert zostaje na liście
 *  w profilu, więc da się go wskrzesić jednym dotknięciem. */
export async function ustawAktywnoscAlertu(id: string, aktywny: boolean): Promise<void> {
  await zaktualizujJedenWiersz(
    'game_alerts', id, { is_active: aktywny },
    aktywny ? 'Nie udało się włączyć alertu' : 'Nie udało się wyłączyć alertu',
  );
}

/**
 * Wyłącza alert tokenem z maila, BEZ logowania (migracja `149`).
 *
 * Leci przez funkcję `SECURITY DEFINER`, nie przez zwykły `update`: polityka
 * RLS pozwalająca `anon` aktualizować `game_alerts` po tokenie otworzyłaby całą
 * tabelę — także `lat`, `lng` i `user_id` — a potrzebna jest dokładnie jedna
 * operacja. Zwraca `false`, gdy tokenu nie ma albo alert był już wyłączony;
 * strona nie rozróżnia tych przypadków, bo dla klikającego znaczą to samo.
 */
export async function wylaczAlertTokenem(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('wylacz_alert_tokenem', { p_token: token });
  if (error) throw error;
  return data === true;
}

export async function deleteMyAlert(id: string): Promise<void> {
  await supabase.from('game_alerts').delete().eq('id', id);
}

/** Count users with active alerts matching a potential event — shown on create form */
export async function countAlertSeekers(lat: number, lng: number, sport: string, dow: number): Promise<number> {
  const { data } = await supabase.rpc('count_alert_seekers', {
    p_lat: lat, p_lng: lng, p_sport: sport, p_dow: dow,
  });
  return (data as number) ?? 0;
}

/** Geocode a Polish city/address via Nominatim (free, no key) */
export async function geocodeCity(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return null;
    return {
      lat:   parseFloat(data[0].lat),
      lng:   parseFloat(data[0].lon),
      label: data[0].display_name.split(',').slice(0, 2).join(', '),
    };
  } catch {
    return null;
  }
}

// Promień alertu chodzi po TEJ SAMEJ skali co filtry (`PROMIENIE_SUWAK_KM`
// w `lib/miejscowosci.ts`) — od 2026-09-14 okno alertu używa tych samych
// kontrolek co arkusz filtrów, więc własny zakres 3–30 km oznaczałby, że te
// same kilometry znaczą w dwóch miejscach co innego. Ograniczenie w bazie
// poszerzyła migracja `149` do 1–100 km.
export const PROMIEN_DOMYSLNY = PROMIEN_DOMYSLNY_KM;

/**
 * KONIEC ALERTU JAKO DATA, NIE JAKO JEDEN Z CZTERECH OKRESÓW — 2026-09-14,
 * zgłoszone wprost („niech będzie jako selektor daty subtelny, a nie 4 opcje").
 *
 * Cztery pigułki („Bezterminowo / Miesiąc / 2 tygodnie / Tydzień") zajmowały
 * dwa rzędy na pytanie, które dla większości ma jedną odpowiedź: alert jest
 * domyślnie bezterminowy. Kto naprawdę chce go ograniczyć, zwykle ma w głowie
 * DATĘ („do końca sezonu", „do wyjazdu"), a nie liczbę dni — i wtedy liczenie
 * „to dziś plus ile?" robił człowiek, zamiast kalendarza.
 *
 * Poniżej para przeliczników między tym, co widzi człowiek (`YYYY-MM-DD`
 * w `<input type="date">`) a tym, co trzyma baza (`timestamptz`).
 */

/** Moment wygaśnięcia z bazy → `YYYY-MM-DD`. `null`/pusto = bezterminowo.
 *
 *  ZOSTAJE, choć okno alertu nie pyta już o czas (patrz niżej): wiersze
 *  założone przed 2026-09-15 mogą mieć `expires_at`, funkcja brzegowa dalej
 *  go honoruje, a `opisAlertu()` musi umieć powiedzieć o nim prawdę. */
export function dataWygasniecia(expiresAt: string | null | undefined): string {
  if (!expiresAt) return '';
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return '';
  const dwie = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dwie(d.getMonth() + 1)}-${dwie(d.getDate())}`;
}

/*
 * ZNIKNĘŁY TU: `koniecDnia()`, `najwczesniejszyKoniec()`, `wygasaZKiedy()`
 * i `kiedyZWygasniecia()` — cztery przeliczniki między „Kiedy" a `expires_at`.
 *
 * Powód: 2026-09-15 z okna alertu zeszła sekcja „Jak długo powiadamiać"
 * (zgłoszone wprost: „większa prostota plus słabe do zrozumienia"). Te same
 * cztery przyciski — Dzisiaj / 3 dni / Tydzień / Termin — stały w filtrach
 * listy i znaczyły tam „mecze w tym oknie", a w oknie alertu „tak długo
 * powiadamiaj". Ten sam kształt dla dwóch różnych pytań okazał się kosztem,
 * nie oszczędnością: żeby przeczytać go poprawnie, trzeba było pamiętać,
 * w którym oknie się stoi.
 *
 * Alert jest dziś ZAWSZE bezterminowy, a wyłącza się go jednym kliknięciem —
 * linkiem z każdej wiadomości (`wylacz_token`, migracja `149`) albo
 * przełącznikiem w profilu. To jest prostsza odpowiedź na to samo pytanie:
 * zamiast zgadywać z góry, jak długo będzie się chciało dostawać wiadomości,
 * przestaje się je dostawać w chwili, w której przestają być potrzebne.
 *
 * Kolumna `expires_at` i jej obsługa w funkcji brzegowej zostają NIETKNIĘTE —
 * tak samo jak `days_of_week` i `godzina_od`/`godzina_do`, wyjęte z okna dzień
 * wcześniej. Stary wiersz z datą dalej wygasa; okno po prostu jej nie ustawia.
 */

/**
 * Ustawienia, z jakimi otwiera się okno alertu wywołane z pustej listy meczów.
 *
 * Człowiek właśnie powiedział filtrami, czego szuka — pytanie go o to drugi raz
 * w oknie alertu byłoby przepisywaniem tego samego. Od migracji `152` przenoszą
 * się WSZYSTKIE wybrane sporty: wcześniej alert trzymał dokładnie jeden, więc
 * przy dwóch filtrach trzeba było zostawić „dowolny" i człowiek dostawał także
 * to, czego nie szukał.
 */
export function domyslneZFiltrow(filtry: {
  sports: string[];
  radiusKm: number | null;
  pozycja: { lat: number; lng: number } | null;
}): { sports: string[]; radiusKm: number; lat?: number; lng?: number } {
  const promien = filtry.radiusKm ?? PROMIEN_DOMYSLNY;
  return {
    sports:   [...filtry.sports],
    // Przez skalę suwaka, nie przez `clamp`: filtr mógł mieć 6 km, a to nie
    // jest żaden przystanek — alert ma wystartować z wartości, którą suwak
    // w oknie potrafi pokazać.
    radiusKm: promienZIndeksu(indeksPromienia(promien)),
    lat:      filtry.pozycja?.lat,
    lng:      filtry.pozycja?.lng,
  };
}

/**
 * PODPIS ALERTU SKŁADANY Z TREŚCI, BEZ POLA „nazwij swój alert".
 *
 * Lista wielu alertów bez nazw jest nie do przeczytania („Alert", „Alert",
 * „Alert"), ale pole tekstowe na nazwę zostałoby puste u wszystkich — nikt nie
 * nazywa rzeczy, których jeszcze nie ma. Nazwa bierze się więc z tego, co
 * alert naprawdę robi, i zmienia się razem z nim.
 */
export function nazwaAlertu(a: Pick<GameAlert, 'sports' | 'cityLabel' | 'radiusKm'>): string {
  const gdzie = a.cityLabel?.trim() || 'Moja okolica';
  return `${nazwaSportow(a.sports)} · ${gdzie} ${a.radiusKm} km`;
}

/** Sporty alertu jako jeden kawałek tekstu. Przy trzech i więcej urywa się
 *  liczbą, bo pełna lista rozpycha wiersz na liście alertów w telefonie —
 *  a od czterech przestaje cokolwiek znaczyć (sportów mamy pięć). */
export function nazwaSportow(sports: string[]): string {
  if (sports.length === 0) return 'Wszystkie sporty';
  if (sports.length <= 2) return sports.map(sportLabel).join(' i ');
  return `${sportLabel(sports[0])} i ${sports.length - 1} inne`;
}

/** Druga linijka wiersza: jak długo żyje i czym daje znać. */
export function opisAlertu(a: Pick<GameAlert, 'expiresAt' | 'kanalEmail'>): string {
  const doKiedy = a.expiresAt
    ? `do ${etykietaKiedy(`do:${dataWygasniecia(a.expiresAt)}`).replace(/^Do /, '')}`
    : 'bezterminowo';
  return `${doKiedy} · ${a.kanalEmail ? 'dzwonek i mail' : 'tylko dzwonek'}`;
}

/**
 * Czy wśród istniejących alertów stoi już praktycznie TEN SAM.
 *
 * Powód jest mierzalny, nie estetyczny: `notify-game-alert` filtruje wszystkie
 * aktywne alerty i NIE deduplikuje po użytkowniku, więc dwa bliźniacze alerty
 * to dwa maile o jednym meczu. Przy jednym slocie problem nie istniał; odkąd
 * alertów może być wiele, powstaje przy trzecim nieuważnym dotknięciu
 * „Powiadom o takich meczach".
 *
 * „Praktycznie ten sam" = ten sam ZESTAW sportów i punkt na tyle blisko, że
 * promienie i tak się pokrywają. Próg to POŁOWA mniejszego z dwóch promieni:
 * przy 25 km przesunięcie o 3 km nie tworzy nowego alertu, przy 2 km — tworzy.
 *
 * Zestaw porównujemy jako ZBIÓR, nie listę: „piłka, siatkówka" i „siatkówka,
 * piłka" to ten sam alert, a kolejność bierze się wyłącznie z tego, co człowiek
 * dotknął pierwsze.
 */
function kluczSportow(sports: string[]): string {
  return [...sports].sort().join('|');
}

export function znajdzPodobnyAlert(
  alerty: GameAlert[],
  input: Pick<AlertInput, 'sports' | 'lat' | 'lng' | 'radiusKm'>,
  pomijajId?: string,
): GameAlert | null {
  const kluczWejscia = kluczSportow(input.sports);
  for (const a of alerty) {
    if (pomijajId && a.id === pomijajId) continue;
    if (kluczSportow(a.sports) !== kluczWejscia) continue;
    const prog = Math.min(a.radiusKm, input.radiusKm) / 2;
    if (distanceKm(a.lat, a.lng, input.lat, input.lng) <= prog) return a;
  }
  return null;
}

/**
 * ZAMIAR ZAŁOŻENIA ALERTU PRZEŻYWA LOGOWANIE — 2026-09-15, zgłoszone jako błąd
 * krytyczny w przeglądzie powiadomień.
 *
 * Wylogowany klikał „Powiadom mnie o takich meczach" i lądował na
 * `/logowanie?next=%2Fwydarzenia` — po zalogowaniu wracał na GOŁĄ listę.
 * Przepadały filtry, które właśnie opisywały, czego szuka, ORAZ powód, dla
 * którego w ogóle tam kliknął. Trzeba było wszystko ustawić od nowa i jeszcze
 * samemu pamiętać, że chciało się alert.
 *
 * Dziś `next` niesie pełny adres z filtrami plus znacznik `alert=1`, a ekran po
 * powrocie otwiera okno sam (`zamiarAlertuZAdresu()`). `powod=alert` mówi z kolei
 * ekranowi logowania, po co tam ktoś trafił — inaczej wita go ogólne „wejdź na
 * swoje konto, żeby grać", czyli odpowiedź na pytanie, którego nie zadał.
 */
export function logowanieDlaAlertu(sciezkaZFiltrami: string): string {
  // Baza jest atrapą — `URL` potrzebuje absolutnego adresu, a i tak bierzemy
  // z niego wyłącznie ścieżkę i parametry.
  const u = new URL(sciezkaZFiltrami, 'https://bojo.pl');
  u.searchParams.set('alert', '1');
  return `/logowanie?powod=alert&next=${encodeURIComponent(u.pathname + u.search)}`;
}

/** Czy adres prosi o otwarcie okna alertu, i adres BEZ tego znacznika.
 *
 *  Znacznik trzeba zdjąć, bo inaczej odświeżenie strony albo powrót przyciskiem
 *  „wstecz" otwierałyby okno w kółko, długo po tym, jak ktoś je zamknął. */
export function zamiarAlertuZAdresu(sciezkaZFiltrami: string): { otworz: boolean; adres: string } {
  const u = new URL(sciezkaZFiltrami, 'https://bojo.pl');
  const otworz = u.searchParams.get('alert') === '1';
  u.searchParams.delete('alert');
  return { otworz, adres: u.pathname + (u.search || '') };
}
