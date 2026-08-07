// Normalizacja tekstu pod wyszukiwanie.
//
// Powód istnienia: filtrowanie na /wydarzenia robiło `includes` na surowym
// stringu, więc wpisanie "pilka" nie znajdowało "piłka nożna", a "zlota"
// nie znajdowało "Złota". Na telefonie z klawiaturą bez polskich znaków
// (albo po prostu w pośpiechu) to znaczyło "brak wyników" na pełnej liście.

/**
 * Składa tekst do postaci porównywalnej: małe litery, bez polskich ogonków,
 * ze spacjami zachowanymi.
 *
 *   foldText('Piłka Nożna')  → 'pilka nozna'
 *   foldText('Żółć')         → 'zolc'
 *
 * Ta sama technika co `slugify()` w lib/utils.ts (`ł` trzeba podmienić ręcznie,
 * bo w przeciwieństwie do ą/ę/ó nie rozkłada się przez NFD na literę + znak
 * diakrytyczny), ale bez zamiany spacji na myślniki — tu porównujemy frazy,
 * nie budujemy adresu URL.
 */
export function foldText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Czy `haystack` zawiera `needle`, ignorując wielkość liter i ogonki. */
export function foldedIncludes(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false;
  return foldText(haystack).includes(needle);
}
