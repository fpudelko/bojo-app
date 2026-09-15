// Filtry listy meczów W ADRESIE STRONY.
//
// DLACZEGO POWSTAŁO (przegląd z 15.09.2026, dwa zgłoszenia naraz):
//
//   * „Kliknięcie «Powiadom mnie» gubi wszystko" — wylogowany trafiał na
//     `/logowanie?next=%2Fwydarzenia`, a po zalogowaniu wracał na GOŁĄ listę.
//     Filtry, które właśnie opisywały, czego szuka, przepadały razem z powodem,
//     dla którego w ogóle tam kliknął.
//   * „Filtry nie przeżywają odświeżenia ani powrotu" — nie dało się wysłać
//     komuś linku do „piłka, dzisiaj, do 5 km", a każdy powrót to ustawianie
//     od zera.
//
// Oba to ten sam brak: stan filtrów żył wyłącznie w pamięci komponentu.
// `/mapa` trzymało swój w adresie od dawna (`sport`, `km`, `m`/`mlat`/`mlng`),
// więc nazwy parametrów są tu CELOWO te same — jeden adres ma znaczyć to samo
// na obu ekranach.
//
// ZAPISUJEMY TYLKO ODCHYLENIA OD DOMYŚLNYCH. Adres z kompletem parametrów przy
// nietkniętych filtrach byłby nie do wysłania komukolwiek, a przy okazji
// utrwalałby wartości domyślne — czyli zamrażał je w linkach na zawsze, choć
// mają prawo się zmieniać.
//
// ŚMIEĆ W PARAMETRZE WRACA DO WARTOŚCI DOMYŚLNEJ, nigdy do pustej listy.
// Adres trafia do ludzi i do wyszukiwarek; obcięty link nie ma prawa pokazać
// „brak meczów" zamiast listy.

import type { DateFilter, SortBy } from './eventFilters';

export interface FiltryListy {
  sports: string[];
  dateFilter: DateFilter;
  /** `null` = bez ograniczenia odległości. */
  radiusKm: number | null;
  minFreeSpots: number;
  sortBy: SortBy;
  query: string;
}

export const MIEJSCA_DOMYSLNIE = 1;
export const SORT_DOMYSLNY: SortBy = 'termin';

export const FILTRY_DOMYSLNE: FiltryListy = {
  sports: [],
  dateFilter: 'wszystkie',
  radiusKm: null,
  minFreeSpots: MIEJSCA_DOMYSLNIE,
  sortBy: SORT_DOMYSLNY,
  query: '',
};

const SORTY: SortBy[] = ['termin', 'odleglosc', 'miejsca'];
const KIEDY_NAZWANE: DateFilter[] = ['wszystkie', 'dzisiaj', 'trzy-dni', 'tydzien'];

/** `do:YYYY-MM-DD` albo jedna z nazwanych wartości; cokolwiek innego odpada. */
function czytajKiedy(v: string | null): DateFilter {
  if (!v) return 'wszystkie';
  if ((KIEDY_NAZWANE as string[]).includes(v)) return v as DateFilter;
  if (/^do:\d{4}-\d{2}-\d{2}$/.test(v)) return v as DateFilter;
  return 'wszystkie';
}

function czytajLiczbe(v: string | null, min: number, max: number): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.trunc(n) : null;
}

export function filtryZAdresu(search: string): FiltryListy {
  const p = new URLSearchParams(search);
  const km = czytajLiczbe(p.get('km'), 1, 100);
  const miejsca = czytajLiczbe(p.get('miejsca'), 0, 99);
  const sort = p.get('sort');
  return {
    sports: p.getAll('sport').filter(Boolean),
    dateFilter: czytajKiedy(p.get('kiedy')),
    radiusKm: km,
    minFreeSpots: miejsca ?? MIEJSCA_DOMYSLNIE,
    sortBy: (SORTY as string[]).includes(sort ?? '') ? (sort as SortBy) : SORT_DOMYSLNY,
    query: p.get('q') ?? '',
  };
}

/** `?sport=…&kiedy=…` albo pusty string, gdy nic nie odbiega od domyślnych. */
export function filtryDoAdresu(f: FiltryListy): string {
  const p = new URLSearchParams();
  f.sports.forEach((s) => p.append('sport', s));
  if (f.dateFilter !== FILTRY_DOMYSLNE.dateFilter) p.set('kiedy', f.dateFilter);
  if (f.radiusKm != null) p.set('km', String(f.radiusKm));
  if (f.minFreeSpots !== MIEJSCA_DOMYSLNIE) p.set('miejsca', String(f.minFreeSpots));
  if (f.sortBy !== SORT_DOMYSLNY) p.set('sort', f.sortBy);
  const q = f.query.trim();
  if (q) p.set('q', q);
  const s = p.toString();
  return s ? `?${s}` : '';
}
