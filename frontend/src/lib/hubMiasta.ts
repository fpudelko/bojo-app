// Huby katalogu `/boiska/[sport]/[miasto]` (roadmapa SEO/GEO, pozycja 20) —
// warstwa między hubem krajowym (`/boiska/[sport]`) a wojewódzkim
// (`/boiska/woj/[x]`). Lista miast jest ograniczona tabelą `miasta_priorytetowe`
// (migracja 112, ~100 miast) — nie generujemy strony dla każdej miejscowości,
// jaka wpadła z importu OpenStreetMap.
//
// Próg jakości: DECYZJA WŁAŚCICIELA 2026-08-25, minimum 3 obiekty. Nie jest to
// próg z odrzuconej pozycji 19 (docs/seo-geo-strategia.md, 4c) — 4c proponował
// zawężenie CAŁEGO indeksu katalogu i zostało odrzucone. Tu chodzi wyłącznie
// o to, czy warto tworzyć NOWĄ stronę listingową dla pary sport+miasto: pusta
// albo prawie pusta strona szkodzi bardziej, niż pomaga (ta sama zasada co
// w content/miasta.ts). Bazą liczenia zostaje dzisiejsza definicja
// indeksowalności obiektu — `seo_tier IN (1, 2)`, ta sama, której używa
// `sitemap-boiska/[plik]/route.ts`.

import { supabase } from './supabase';
import { slugify } from './utils';
import { pobierzWszystkie } from './zapytania';
import { KATALOG_SPORT_MAP } from './sports';

export const PROG_OBIEKTOW_HUB_MIASTA = 3;

/** Nazwy z `miasta_priorytetowe`, w formie mianownikowej z bazy (np. "Warszawa").
 *  Błąd zapytania degraduje do pustej listy, nie wyjątku — wzorem
 *  `resolveField()` w `boisko/[id]/page.tsx`: strona ma wtedy 404 (para
 *  nierozpoznana), nie 500, tak samo jak przy nieistniejącym mieście. */
export async function miastaPriorytetowe(): Promise<string[]> {
  const { data } = await supabase
    .from('miasta_priorytetowe')
    .select('nazwa')
    .order('nazwa');
  return (data ?? []).map((r) => r.nazwa);
}

/** Nazwa miasta priorytetowego pasująca do sluga z adresu, albo `null`. Lista
 *  jest krótka (~100 pozycji) — pobranie jej w całości i porównanie slugów jest
 *  tańsze niż próba odtworzenia oryginalnej nazwy z samego sluga. */
export async function znajdzMiastoPrioryteotowe(slugMiasta: string): Promise<string | null> {
  const miasta = await miastaPriorytetowe();
  return miasta.find((nazwa) => slugify(nazwa) === slugMiasta) ?? null;
}

/** Ile obiektów danego sportu w danym mieście spełnia dzisiejszy próg
 *  indeksowalności. `head: true` — liczba, nie wiersze, więc nie ma tu
 *  pułapki obciętej strony (`pobierzWszystkie`), a sam limit PostgREST-a na
 *  odpowiedź jej nie dotyczy. */
export async function liczObiektowWMiescie(dbSport: string, miasto: string): Promise<number> {
  const { count } = await supabase
    .from('fields')
    .select('id', { count: 'exact', head: true })
    .contains('sport', [dbSport])
    .eq('city', miasto)
    .eq('map_visibility', 'public')
    .in('seo_tier', [1, 2]);
  return count ?? 0;
}

/**
 * Miasta priorytetowe, w których dany sport przekracza próg — do linkowania
 * poziomego z `/boiska/[sport]` (4b) i do budowy sitemapa. Jedno zapytanie na
 * sport (nie jedno na parę sport×miasto — przy ~100 miastach × 7 sportach to
 * byłoby 700 zapytań na każde zbudowanie sitemapa), zawężone do miast z listy
 * priorytetowej, więc wynik jest ograniczony niezależnie od wielkości całego
 * katalogu. `pobierzWszystkie`, bo duże miasto potrafi mieć więcej obiektów
 * jednego sportu niż limit odpowiedzi PostgREST-a — dokładnie ta sama pułapka
 * co przy indeksie slugów w `boisko/[id]/page.tsx`.
 */
export async function miastaPowyzejProguDlaSportu(
  dbSport: string,
): Promise<{ nazwa: string; slug: string }[]> {
  const priorytetowe = await miastaPriorytetowe();
  if (priorytetowe.length === 0) return [];

  const wiersze = await pobierzWszystkie<{ city: string | null }>((od, doIdx) =>
    supabase
      .from('fields')
      .select('city')
      .contains('sport', [dbSport])
      .eq('map_visibility', 'public')
      .in('seo_tier', [1, 2])
      .in('city', priorytetowe)
      .range(od, doIdx));

  const liczniki = new Map<string, number>();
  for (const { city } of wiersze) {
    if (!city) continue;
    liczniki.set(city, (liczniki.get(city) ?? 0) + 1);
  }

  return Array.from(liczniki.entries())
    .filter(([, liczba]) => liczba >= PROG_OBIEKTOW_HUB_MIASTA)
    .map(([nazwa]) => ({ nazwa, slug: slugify(nazwa) }))
    .sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'));
}

/** Wszystkie pary sport×miasto powyżej progu — do `sitemap.ts`. Jeden przebieg
 *  `miastaPowyzejProguDlaSportu()` na sport z `KATALOG_SPORT_MAP` (siedem
 *  zapytań), nie osobna funkcja: dwa niezależne źródła tej samej listy
 *  rozjechałyby się przy pierwszej zmianie progu. */
export async function paryHubowMiastSportu(): Promise<{ sportSlug: string; miastoSlug: string }[]> {
  const wpisy = Object.entries(KATALOG_SPORT_MAP);
  const wyniki = await Promise.all(
    wpisy.map(async ([sportSlug, { db }]) => {
      const miasta = await miastaPowyzejProguDlaSportu(db);
      return miasta.map((m) => ({ sportSlug, miastoSlug: m.slug }));
    }),
  );
  return wyniki.flat();
}
