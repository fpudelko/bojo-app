// Zapytania listujące obiekty na hubach katalogu `/boiska/[sport]` i
// `/boiska/woj/[wojewodztwo]` — wydzielone z page.tsx wyłącznie po to, żeby dało
// się przetestować filtr `seo_tier` bez renderowania JSX (Vitest nie transformuje
// `.tsx` w tym repo — `tsconfig.json` ma `jsx: "preserve"`, poprawne dla Next.js,
// niekompatybilne z domyślnym esbuildem Vite).
//
// `.in('seo_tier', [1, 2])` jest tu obowiązkowe: bez niego oba huby listowały
// też obiekty Tier 3, którym `boisko/[id]/page.tsx` daje `robots: {index:
// false}` — własny hub wydawał budżet skanowania na strony, których broni
// tiering z migracji 112 (docs/seo-geo-strategia.md, dług D11). Ten sam filtr
// ma już `miastaPowyzejProguDlaSportu()` w `hubMiasta.ts` i
// `sitemap-boiska/[plik]/route.ts`.

import { supabase } from './supabase';

const TIER_INDEKSOWALNY = [1, 2] as const;

export async function obiektyHubuSportu(dbSport: string, od: number, doIdx: number) {
  return supabase
    .from('fields')
    .select('id, name, address, lat, lng, sport, surface, is_indoor, district', { count: 'exact' })
    .contains('sport', [dbSport])
    .eq('map_visibility', 'public')
    .in('seo_tier', TIER_INDEKSOWALNY)
    .order('name', { ascending: true })
    .range(od, doIdx);
}

export async function obiektyHubuWojewodztwa(voivodeshipSlug: string, od: number, doIdx: number) {
  return supabase
    .from('fields')
    .select('id, name, address, lat, lng, sport, surface, is_indoor, district, city', { count: 'exact' })
    .eq('voivodeship', voivodeshipSlug)
    .eq('map_visibility', 'public')
    .in('seo_tier', TIER_INDEKSOWALNY)
    .order('name', { ascending: true })
    .range(od, doIdx);
}

/** Metadane paginacji dla hubów katalogu (`/boiska/[sport]`,
 *  `/boiska/woj/[x]`) — wydzielone, żeby dało się przetestować bez
 *  renderowania JSX. Strona 1 niesie całą wagę huba; strony 2+ to ten sam
 *  zbiór pocięty na kawałki, bez samodzielnej treści wartej osobnego miejsca
 *  w indeksie — stąd `noindex, follow` (dług D15, docs/seo-geo-strategia.md).
 *  Canonical zostaje self-referencing (nie do strony 1): każda strona ma
 *  własny zestaw obiektów, więc wskazanie na stronę 1 pogubiłoby resztę. */
export function metadanePaginacjiHuba(
  sciezkaBazowa: string,
  strona: number,
): { canonical: string; robots?: { index: boolean; follow: boolean } } {
  return {
    canonical: strona > 1 ? `${sciezkaBazowa}?strona=${strona}` : sciezkaBazowa,
    robots: strona > 1 ? { index: false, follow: true } : undefined,
  };
}
