// Pobliskie obiekty tego samego sportu — jedyny fakt UNIKALNY dla konkretnej
// strony obiektu, który nie wymaga ani jednego rozegranego meczu.
//
// PO CO TO ISTNIEJE (docs/seo-geo-strategia.md, rozdz. 8, runda 4). Fosa F1, F3
// i F4 jest zbudowana w całości, ale każda z nich renderuje treść dopiero po
// pierwszym meczu na obiekcie — a to ~40 obiektów na 36 268. Na pozostałych
// 99,9% stron jedyne zdanie własne Bojo (`content/opisObiektu.ts`, „Szukasz
// graczy? Stwórz otwarty mecz…") jest BAJTOWO IDENTYCZNE; reszta strony to
// import z OpenStreetMap. Pomiar w Search Console (2026-09-01) pokazał
// 32 400 adresów wykrytych z mapy witryny i nadal 2 zaindeksowane — czyli
// dokładnie ten kształt, którego dotyczy ryzyko R1 („cienkie strony podkopują
// zaufanie do domeny").
//
// Ta lista daje każdej stronie treść, której nie ma żadna inna strona w serwisie,
// wyprowadzoną z danych, które już są (współrzędne całego katalogu). Przy okazji
// jest warstwą linkowania wewnętrznego — to, co rozdz. 4b nazywa najtańszą rzeczą
// o największym wpływie: dziś ze strony obiektu wychodzą trzy linki, wszystkie
// do hubów, żaden do innego obiektu.
//
// Wydzielone z `boisko/[id]/page.tsx` tym samym wzorcem co `lib/hubKatalogu.ts`
// i z tego samego powodu: żeby filtr `seo_tier` i reguła doboru dały się
// przetestować bez renderowania JSX (Vitest nie transformuje `.tsx` w tym repo).

import { supabase } from './supabase';
import { kadrWokol } from './api';
import { distanceKm } from './geo';

/** Ten sam próg indeksowalności co huby katalogu i mapa witryny (migracja 112).
 *  Bez niego strona obiektu linkowałaby do Tier 3, któremu sama daje `noindex` —
 *  ta sama wewnętrzna sprzeczność, którą dług D11 wytknął hubom. */
const TIER_INDEKSOWALNY = [1, 2] as const;

/**
 * Promień doboru. 8 km to zasięg „pojadę tam zagrać" w mieście, nie „jest
 * w tym samym województwie" — lista ma odpowiadać na pytanie człowieka, który
 * właśnie ogląda konkretne boisko, a nie budować sztuczny graf linków.
 *
 * UWAGA NA NAZEWNICTWO: `kadrWokol()` zwraca KWADRAT, nie koło (baza nie ma
 * PostGIS, patrz nagłówek migracji 112), więc w rogach wpadają obiekty nieco
 * dalsze. `wybierzPobliskie()` przycina je po realnej odległości, ale i tak
 * mówimy w treści „w okolicy", nigdy „w promieniu 8 km" — to nie jest ta sama
 * liczba i nie wolno jej tak nazwać (ta sama zasada co przy
 * `policzBoiskaWOkolicy()` w `lib/api.ts`).
 */
export const PROMIEN_POBLISKICH_KM = 8;

/** Ile pozycji pokazujemy. Sześć mieści się na telefonie bez zwijania i nie
 *  zamienia strony obiektu w kolejny hub katalogu. */
export const MAKS_POBLISKICH = 6;

/** Ilu kandydatów pobieramy przed przycięciem po odległości. Kadr jest
 *  kwadratem, a wynik ma być posortowany po realnej odległości, więc pula musi
 *  być większa niż `MAKS_POBLISKICH` — inaczej limit bazy uciąłby po nazwie
 *  i najbliższy obiekt mógłby wypaść przed sortowaniem. */
const PULA_KANDYDATOW = 60;

export interface PobliskiObiekt {
  id: string;
  name: string;
  sport: string[];
  lat: number;
  lng: number;
  /** Odległość w linii prostej od obiektu, którego dotyczy strona. */
  odlegloscKm: number;
}

interface WierszKandydata {
  id: string;
  name: string | null;
  sport: string[] | null;
  lat: number | null;
  lng: number | null;
}

/**
 * Reguła doboru — czysta funkcja, żeby dała się sprawdzić bez bazy.
 *
 * Odrzuca: obiekt bieżący (kadr zawiera go zawsze), wiersze bez współrzędnych
 * albo bez nazwy (import z OSM bywa niekompletny), oraz obiekty poza realnym
 * promieniem, które wpadły przez rogi kwadratu. Sortuje po odległości rosnąco
 * — najbliższy jest najbardziej użyteczny dla człowieka i najlepiej uzasadnia
 * link dla robota.
 */
export function wybierzPobliskie(
  kandydaci: readonly WierszKandydata[],
  obiekt: { id: string; lat: number; lng: number },
  limit = MAKS_POBLISKICH,
  promienKm = PROMIEN_POBLISKICH_KM,
): PobliskiObiekt[] {
  return kandydaci
    .filter((k) => k.id !== obiekt.id && k.name && k.lat != null && k.lng != null)
    .map((k) => ({
      id: k.id,
      name: k.name as string,
      sport: k.sport ?? [],
      lat: k.lat as number,
      lng: k.lng as number,
      odlegloscKm: distanceKm(obiekt.lat, obiekt.lng, k.lat as number, k.lng as number),
    }))
    .filter((k) => k.odlegloscKm <= promienKm)
    .sort((a, b) => a.odlegloscKm - b.odlegloscKm)
    .slice(0, limit);
}

/**
 * Obiekty tego samego sportu w okolicy danego obiektu.
 *
 * Zwraca pustą listę przy błędzie bazy i przy braku współrzędnych — strona
 * pomija wtedy całą sekcję. Brak listy jest uczciwszy niż lista pusta udająca,
 * że w okolicy nic nie ma (ta sama zasada co w `policzBoiskaWOkolicy()`).
 *
 * Jedno zapytanie na render, przy `revalidate = 86400` na trasie obiektu —
 * czyli najwyżej raz na dobę na adres, nic liniowego przy buildzie
 * (AGENTS.md, twarde ograniczenie po tym, jak `generateStaticParams()` dla
 * całego katalogu raz już wywróciło build).
 */
export async function pobliskieObiekty(obiekt: {
  id: string;
  lat: number | null;
  lng: number | null;
  sport: readonly string[];
}): Promise<PobliskiObiekt[]> {
  if (obiekt.lat == null || obiekt.lng == null) return [];
  const sportWiodacy = obiekt.sport[0];
  if (!sportWiodacy) return [];

  const kadr = kadrWokol(obiekt.lat, obiekt.lng, PROMIEN_POBLISKICH_KM);

  const { data, error } = await supabase
    .from('fields')
    .select('id, name, sport, lat, lng')
    .contains('sport', [sportWiodacy])
    .eq('map_visibility', 'public')
    .in('seo_tier', TIER_INDEKSOWALNY)
    .gte('lat', kadr.latMin)
    .lte('lat', kadr.latMax)
    .gte('lng', kadr.lngMin)
    .lte('lng', kadr.lngMax)
    .limit(PULA_KANDYDATOW);

  if (error || !data) return [];
  return wybierzPobliskie(data as WierszKandydata[], {
    id: obiekt.id, lat: obiekt.lat, lng: obiekt.lng,
  });
}

/**
 * Etykieta odległości. Poniżej kilometra metry są uczciwsze niż „0,4 km",
 * a powyżej — jedno miejsce po przecinku wystarczy; druga cyfra sugerowałaby
 * precyzję, której `fields.lat/lng` (środek obiektu z OSM) nie ma.
 */
export function etykietaOdleglosci(km: number): string {
  if (km < 1) return `${Math.round(km * 100) * 10} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}
