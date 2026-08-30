import { supabase } from './supabase';
import { foldText } from './searchText';
import type { Field, FieldFilters, FieldsResponse, BookingType, MapVisibility } from '@/types';

// ---------------------------------------------------------------------------
// Row mappers  (DB snake_case → TS camelCase)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toField(row: any): Field {
  const bookingType: BookingType = row.booking_type ?? 'none';
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: Number(row.lat),
    lng: Number(row.lng),
    sport: row.sport ?? [],
    // `?? true` nie jest kosmetyką: zapytanie mapy pobiera okrojony zestaw
    // kolumn i `available` go NIE zawiera. Bez wartości domyślnej każda pinezka
    // wychodziła jako niedostępna — szara, z ikoną stadionu zamiast piłki,
    // niezależnie od sportu. Kolumna pobrana wprost nadal decyduje.
    available: row.available ?? true,
    surface: row.surface ?? '',
    isIndoor: row.is_indoor,
    isBookable: bookingType === 'internal',
    bookingType,
    bookingUrl: row.booking_url ?? undefined,
    bookingEnabled: row.booking_enabled ?? false,
    managerId: row.manager_id ?? undefined,
    phone: row.contact_visible ? (row.phone ?? undefined) : undefined,
    website: row.website ?? undefined,
    email: row.contact_visible ? (row.email ?? undefined) : undefined,
    contactVisible: row.contact_visible ?? false,
    operator: row.operator ?? undefined,
    operatorType: row.operator_type ?? undefined,
    description: row.description ?? undefined,
    imageUrl: row.image_url ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    photoReference: row.photo_reference ?? undefined,
    photoSource: row.photo_source ?? undefined,
    openingHours: row.opening_hours ?? undefined,
    postcode: row.postcode ?? undefined,
    lit: row.lit ?? undefined,
    access: row.access ?? undefined,
    fee: row.fee ?? undefined,
    hasChangingRooms: row.has_changing_rooms ?? undefined,
    hasShower: row.has_shower ?? undefined,
    hasToilets: row.has_toilets ?? undefined,
    capacity: row.capacity ?? undefined,
    mapVisibility: (row.map_visibility ?? 'organizer_only') as MapVisibility,
    district: row.district ?? undefined,
    venueType: row.venue_type ?? undefined,
    dimensionsM: row.dimensions_m ?? undefined,
    accessType: row.access_type ?? undefined,
    isVerifiedVenue: row.is_verified_venue ?? undefined,
    condition: row.condition ?? undefined,
    aiTypedAt: row.ai_typed_at ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

// Lean column set + server-side filtering for the map/list explorer. Cuts
// egress hard: only venues that actually show up are transferred, and the
// heavy columns (description, contact, opening hours, amenities…) are dropped.
// Kolumny potrzebne PINEZCE i filtrom, nic więcej. Wcześniej było ich
// dziewiętnaście — łącznie z `photo_reference` (często 200+ znaków), adresami
// zdjęć, stroną i danymi rezerwacji. Pobieraliśmy pełną kartę dla każdego
// obiektu w kraju, żeby wyrenderować jedną: tę klikniętą.
//
// `name` i `address` zostają, bo po nich filtruje wyszukiwarka; `venue_type`
// i `surface`, bo po nich filtruje modal filtrów mapy. Reszta dociągana jest
// dla widocznych kart przez `getFieldsByIds()`.
const EXPLORER_COLS = 'id, name, address, lat, lng, sport, venue_type, surface';
// `wielofunkcyjne` to import z OSM (`sport=multi`) — 162 obiekty w samym
// lubelskiem odpadały tu po cichu, mimo że przeszły bramkę publikacji.
const EXPLORER_SPORTS = ['piłka nożna', 'futsal', 'siatkówka', 'siatkówka plażowa', 'koszykówka', 'piłka ręczna', 'wielofunkcyjne'];

/** Prostokąt widoku mapy. */
export interface Kadr {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

/**
 * Kwadrat o boku ~2 × `promienKm` wokół punktu — do zapytań „co jest blisko".
 *
 * Stopień szerokości to ~111 km wszędzie; stopień DŁUGOŚCI kurczy się wraz
 * z cosinusem szerokości, więc bez tej poprawki kadr nad Polską byłby o jakąś
 * trzecią za wąski w poziomie. Ta sama matematyka siedziała dotąd wpisana
 * w `policzBoiskaWOkolicy()` — teraz jest jedna i przetestowana.
 *
 * To KWADRAT, nie koło: baza nie ma PostGIS (patrz nagłówek migracji `112`),
 * więc filtrujemy po `lat`/`lng` z indeksów, a odległość liczy się dopiero
 * po stronie klienta (`distanceKm`). W rogach kwadratu wpadają więc obiekty
 * nieco dalsze niż promień — wywołujący, który tego nie chce, sortuje albo
 * przycina po `distanceKm`.
 */
export function kadrWokol(lat: number, lng: number, promienKm: number): Kadr {
  const dLat = promienKm / 111;
  const dLng = promienKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    latMin: lat - dLat, latMax: lat + dLat,
    lngMin: lng - dLng, lngMax: lng + dLng,
  };
}

/**
 * Kadr powiększony na wszystkie strony — zapytanie o obiekty pyta o WIĘCEJ,
 * niż faktycznie widać.
 *
 * PO CO. Przy dużym przybliżeniu (z16+) kadr bywa węższy niż niepewność
 * położenia punktu: `fields.lat/lng` to środek obiektu z importu OSM, a jego
 * realna granica (boisko szkolne bywa 40-80 m w poprzek) i ewentualny błąd
 * geokodowania potrafią wypchnąć punkt tuż poza ciasny prostokąt, mimo że na
 * satelitarnej podkładce obiekt jest widoczny w kadrze. Zgłoszone wprost
 * z sesji QA: „w kadrze widać boisko szkolne, a mapa jest pusta" — przy tym
 * samym środku z11 dawało 45 pinezek, z16 już 0. Współczynnik 1,6× (30%
 * marginesu z każdej strony) zostaje bezpieczny dla renderowania: markercluster
 * i tak nie pokaże niczego poza swoimi WŁASNYMI, wyliczonymi granicami
 * widoczności (`removeOutsideVisibleBounds`), więc szersze zapytanie tylko
 * ŁAPIE więcej kandydatów, nie WYSTAWIA pinezek poza ekran.
 */
export function poszerzKadr(k: Kadr, wspolczynnik = 1.6): Kadr {
  const latSrodek = (k.latMin + k.latMax) / 2;
  const lngSrodek = (k.lngMin + k.lngMax) / 2;
  const polLat = ((k.latMax - k.latMin) / 2) * wspolczynnik;
  const polLng = ((k.lngMax - k.lngMin) / 2) * wspolczynnik;
  return {
    latMin: latSrodek - polLat, latMax: latSrodek + polLat,
    lngMin: lngSrodek - polLng, lngMax: lngSrodek + polLng,
  };
}

/** Skupisko obiektów w komórce siatki — dla oddalonych widoków. */
export interface Skupisko {
  lat: number;
  lng: number;
  ile: number;
  sporty: string[];
}

/**
 * Liczby obiektów w siatce zamiast samych obiektów (migracja `069`).
 *
 * Przy widoku całego kraju pobranie kilkudziesięciu tysięcy wierszy tylko po
 * to, żeby przeglądarka zwinęła je w kilkanaście kółek, jest pracą wykonaną
 * dwa razy — raz w sieci, raz w Leaflecie. Baza grupuje po komórce i oddaje
 * gotowe liczby.
 */
export async function getExplorerClusters(
  kadr: Kadr,
  krok: number,
  sporty?: string[],
  typy?: string[],
): Promise<Skupisko[]> {
  const { data, error } = await supabase.rpc('mapa_skupiska', {
    p_lat_min: kadr.latMin,
    p_lat_max: kadr.latMax,
    p_lng_min: kadr.lngMin,
    p_lng_max: kadr.lngMax,
    p_krok: krok,
    p_sporty: sporty?.length ? sporty : null,
    p_typy: typy?.length ? typy : null,
  });
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    lat: Number(r.lat),
    lng: Number(r.lng),
    ile: Number(r.ile),
    sporty: r.sporty ?? [],
  }));
}

/**
 * Obiekty w zadanym wycinku mapy.
 *
 * `kadr` jest WYMAGANY i to jest zabezpieczenie zamiast dawnego limitu 5000
 * wierszy. Limit liczbowy był arbitralny — przy katalogu poznańskim za wysoki,
 * żeby cokolwiek chronić, a przy ogólnopolskim za niski, żeby pokazać miasto.
 * Prostokąt widoku ogranicza zapytanie tym, co użytkownik faktycznie ogląda,
 * więc rozmiar odpowiedzi zależy od gęstości okolicy, a nie od wielkości bazy.
 */
export async function getExplorerFields(kadr: Kadr): Promise<Field[]> {
  let zapytanie = supabase
    .from('fields')
    .select(EXPLORER_COLS)
    // Jedna reguła zamiast dwóch zachodzących na siebie. Wcześniej mapa brała
    // wszystko poza `hidden`, a potem odsiewała to filtrem „ma telefon albo
    // stronę albo opis" — proxy jakości z czasów, gdy `map_visibility` ustawiała
    // analiza satelitarna i nie dało się jej ufać. Import z OSM ustawia je
    // świadomie (bramka publikacji), więc kolumna wystarcza za całe kryterium.
    // Bez tej zmiany świeżo zaimportowane boisko nigdy nie trafiłoby na mapę:
    // z OSM nie przychodzi ani telefon, ani strona, ani opis.
    .eq('map_visibility', 'public')
    .overlaps('sport', EXPLORER_SPORTS);

  zapytanie = zapytanie
    .gte('lat', kadr.latMin).lte('lat', kadr.latMax)
    .gte('lng', kadr.lngMin).lte('lng', kadr.lngMax);

  const { data, error } = await zapytanie;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toField);
}

/**
 * Wyszukiwanie obiektu po nazwie lub adresie — po stronie bazy.
 *
 * Pickery lokalizacji filtrowały wcześniej listę pobraną w całości, co działało
 * dopóki „w całości" znaczyło Poznań. Przy katalogu ogólnopolskim wpisanie
 * nazwy musi być zapytaniem, a nie przeszukiwaniem tablicy w przeglądarce.
 */
export async function searchExplorerFields(term: string, limit = 30): Promise<Field[]> {
  const szukane = term.trim();
  if (szukane.length < 2) return [];

  const podstawa = () => supabase
    .from('fields')
    .select(EXPLORER_COLS)
    .eq('map_visibility', 'public')
    .overlaps('sport', EXPLORER_SPORTS)
    .limit(limit);

  // OGONKI. `ilike '%poznan%'` na `name`/`address` NIE jest zgodne z „Poznań" —
  // Postgres porównuje znak po znaku. Nikt nie pisze ogonków w szukajce na
  // telefonie, więc wpisanie miasta zwracało zero wyników przy 38 tysiącach
  // obiektów w katalogu. Migracja 126 dokłada kolumnę `szukaj_norm` (nazwa
  // + adres, małymi literami, bez ogonków) — składaną tak samo jak `foldText()`
  // po tej stronie. Obie strony MUSZĄ składać tekst identycznie, bo filtr
  // lokalny w `VenueExplorer` przepuszcza dalej to, co znajdzie serwer.
  const { data, error } = await podstawa()
    .ilike('szukaj_norm', `%${foldText(szukane)}%`);
  if (!error) return (data ?? []).map(toField);

  // Migracje puszcza się w Bojo RĘCZNIE, więc kolumny może jeszcze nie być.
  // Wtedy lepiej szukać po staremu (bez ogonków nie znajdzie miasta, ale
  // nazwę wpisaną dokładnie już tak) niż wywalić szukajkę na czerwono.
  if (!brakKolumny(error)) throw new Error(error.message);
  const zapasowe = await podstawa()
    .or(`name.ilike.%${szukane}%,address.ilike.%${szukane}%`);
  if (zapasowe.error) throw new Error(zapasowe.error.message);
  return (zapasowe.data ?? []).map(toField);
}

/** Czy błąd znaczy „takiej kolumny tu nie ma" — czyli „migracja jeszcze nie
 *  poszła". PostgREST oddaje `42703` z Postgresa albo własne `PGRST204`,
 *  gdy kolumny nie ma w jego pamięci podręcznej schematu. */
function brakKolumny(error: { code?: string; message?: string }): boolean {
  return error.code === '42703' || error.code === 'PGRST204'
    || (error.message ?? '').includes('szukaj_norm');
}

export async function getFields(filters?: FieldFilters): Promise<FieldsResponse> {
  let query = supabase.from('fields').select('*', { count: 'exact' });

  if (filters?.sport) {
    query = query.contains('sport', [filters.sport]);
  }
  if (filters?.available) {
    query = query.eq('available', true);
  }
  if (filters?.managerId) {
    query = query.eq('manager_id', filters.managerId);
  }
  if (filters?.bookable !== undefined) {
    query = query.eq('is_bookable', filters.bookable);
  }
  if (filters?.bookingType !== undefined) {
    query = query.eq('booking_type', filters.bookingType);
  }
  if (filters?.mapVisibility !== undefined) {
    query = query.eq('map_visibility', filters.mapVisibility);
  }
  if (filters?.search?.trim()) {
    // Match by venue name or address (case-insensitive).
    const term = filters.search.trim();
    query = query.or(`name.ilike.%${term}%,address.ilike.%${term}%`);
  }
  if (filters?.limit !== undefined) {
    const from = filters.offset ?? 0;
    query = query.range(from, from + filters.limit - 1);
  } else {
    query = query.limit(10000);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return { fields: (data ?? []).map(toField), total: count ?? 0 };
}

export async function createManagedField(
  data: Pick<Field, 'name' | 'address' | 'lat' | 'lng' | 'sport' | 'surface' | 'isIndoor' | 'bookingType' | 'bookingUrl' | 'available' | 'phone' | 'website'>,
  managerId: string,
): Promise<string> {
  const bookingType = data.bookingType ?? 'internal';
  const { data: row, error } = await supabase
    .from('fields')
    .insert({
      name: data.name,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      sport: data.sport,
      surface: data.surface,
      is_indoor: data.isIndoor,
      is_bookable: bookingType === 'internal',
      booking_type: bookingType,
      booking_url: data.bookingUrl ?? null,
      available: data.available ?? true,
      manager_id: managerId,
      phone: data.phone ?? null,
      website: data.website ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return row.id as string;
}

export async function updateFieldBookingSettings(
  fieldId: string,
  bookingType: BookingType,
  bookingUrl?: string,
  bookingEnabled?: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('fields')
    .update({
      booking_type: bookingType,
      booking_url: bookingUrl ?? null,
      is_bookable: bookingType === 'internal',
      ...(bookingEnabled !== undefined ? { booking_enabled: bookingEnabled } : {}),
    })
    .eq('id', fieldId);
  if (error) throw new Error(error.message);
}

/**
 * Pełne dane kilku obiektów naraz — dla kart, które właśnie są na ekranie.
 *
 * Mapa pobiera pinezki w okrojonej postaci (`EXPLORER_COLS`), więc karta
 * potrzebuje reszty: zdjęcia, nawierzchni, strony. Zapytanie idzie partiami
 * po `id`, bo widoczna jest zawsze garstka kart — jedna na telefonie, jedna
 * strona listy na komputerze.
 */
export async function getFieldsByIds(ids: string[]): Promise<Field[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('fields')
    .select('*')
    .in('id', ids);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toField);
}

export async function getField(fieldId: string): Promise<Field> {
  const { data, error } = await supabase
    .from('fields')
    .select('*')
    .eq('id', fieldId)
    .single();

  if (error) throw new Error(error.message);
  return toField(data);
}

/** True when the user manages at least one venue — drives "Moje obiekty" in
 *  the header (desktop) and on /profil (mobile). Was a Supabase query inline
 *  in Header.tsx, in violation of "components don't bypass lib/". */
export async function hasManagedVenue(userId: string): Promise<boolean> {
  const { count } = await supabase
    .from('fields')
    .select('id', { count: 'exact', head: true })
    .eq('manager_id', userId);
  return (count ?? 0) > 0;
}

// Były tu `getFieldBySlug()` i `getAllFieldSlugs()` — obie bez ani jednego
// wywołania w całym repo. Pierwsza robiła `select('*')` na CAŁEJ tabeli
// `fields` i wyszukiwała jeden wiersz w JavaScripcie; po migracji `068`
// dochodzą do tego tagi OSM w jsonb, więc byłby to najcięższy możliwy sposób
// rozwiązania jednego sluga. Druga ciągnęła całą tabelę bez stronicowania,
// czyli po cichu gubiłaby ogon (PostgREST obcina długą odpowiedź BEZ błędu).
//
// Rozwiązywaniem slug → id zajmuje się `idForSlug()` w `app/boisko/[id]/page.tsx`:
// stronicowany indeks trzymany w pamięci procesu. Martwy kod tej klasy zostaje
// usunięty, a nie „poprawiony", bo jedyne, co robił, to czekał, aż ktoś go
// zawoła i wyśle katalog przez sieć.

export async function updateField(
  fieldId: string,
  data: Pick<Field, 'name' | 'address' | 'sport' | 'available' | 'surface' | 'isIndoor' | 'phone' | 'website'> & { contactVisible?: boolean },
): Promise<void> {
  const { error } = await supabase
    .from('fields')
    .update({
      name: data.name,
      address: data.address,
      sport: data.sport,
      available: data.available,
      surface: data.surface,
      is_indoor: data.isIndoor,
      phone: data.phone ?? null,
      website: data.website ?? null,
      ...(data.contactVisible !== undefined ? { contact_visible: data.contactVisible } : {}),
    })
    .eq('id', fieldId);
  if (error) throw new Error(error.message);
}

/**
 * Liczba publicznych obiektów w kadrze wokół punktu — dla landingów lokalnych
 * /[sport]/[miasto].
 *
 * Kadr jest PROSTOKĄTEM, nie kołem: PostgREST nie policzy odległości haversine,
 * a RPC do tego nie ma. Stąd treść na stronie mówi "w okolicy", nie "w promieniu
 * N km" — to nie jest ta sama liczba i nie wolno jej tak nazwać.
 *
 * Zwraca 0 przy błędzie, a strona pomija wtedy całą sekcję: brak liczby jest
 * uczciwszy niż zero udające pustą okolicę.
 */
export async function policzBoiskaWOkolicy(
  lat: number,
  lng: number,
  promienKm: number,
): Promise<number> {
  const kadr = kadrWokol(lat, lng, promienKm);

  const { count, error } = await supabase
    .from('fields')
    .select('id', { count: 'exact', head: true })
    .eq('map_visibility', 'public')
    .gte('lat', kadr.latMin)
    .lte('lat', kadr.latMax)
    .gte('lng', kadr.lngMin)
    .lte('lng', kadr.lngMax);

  if (error) return 0;
  return count ?? 0;
}
