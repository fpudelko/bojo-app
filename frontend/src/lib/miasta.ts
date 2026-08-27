/**
 * Miasta pokazywane jako pierwszy krok w pustym stanie listy obiektów.
 *
 * PO CO ISTNIEJE OSOBNA STAŁA, skoro w bazie jest tabela `miasta_priorytetowe`
 * (migracja `112`). Tamta tabela ma JEDNĄ kolumnę — `nazwa` — i służy do
 * tierowania indeksacji w wyszukiwarkach. Nie ma w niej ani kolejności (SQL
 * nie gwarantuje kolejności bez `ORDER BY`, a nie ma po czym sortować), ani
 * współrzędnych, a jest w niej ponad sto pozycji. Do wyboru palcem potrzeba
 * czegoś odwrotnego: kilkunastu największych, w ustalonej kolejności.
 *
 * Nazwy MUSZĄ być pisane tak samo jak w `miasta_priorytetowe` i w
 * `fields.city` — jedno i drugie wypełnia `scraper/backfill_lokalizacja.py`
 * (`nearest_place()`), więc rozjazd w zapisie znaczy zero wyników dla miasta,
 * które w bazie ma setki obiektów.
 *
 * DLACZEGO NIE ROZWIJANA LISTA WSZYSTKICH MIAST: sto pozycji w `<select>` na
 * telefonie jest gorsze od mapy, którą ta lista ma zastąpić. Kilkanaście
 * kafelków odpowiada na „gdzie w ogóle coś jest", a po resztę idzie się do
 * pola szukania — ono przeszukuje CAŁY katalog, nie tylko kadr.
 */
export const NAJWIEKSZE_MIASTA = [
  'Warszawa', 'Kraków', 'Wrocław', 'Łódź',
  'Poznań', 'Gdańsk', 'Szczecin', 'Bydgoszcz',
  'Lublin', 'Białystok', 'Katowice', 'Gdynia',
] as const;

/**
 * Miasta z liczbami, posortowane malejąco; miasta bez ani jednego obiektu
 * wypadają.
 *
 * Zero nie jest tu informacją, tylko szumem: kafelek „Radom 0" nie mówi
 * „w Radomiu nie ma boisk", tylko „backfill tam nie dotarł" — a to jest nasz
 * problem, nie użytkownika. Pusty wynik dla WSZYSTKICH miast znaczy, że
 * `fields.city` nie jest wypełnione w tej bazie; wywołujący chowa wtedy całą
 * sekcję (patrz `policzBoiskaWMiastach()`).
 */
export function miastaDoPokazania(
  liczby: Record<string, number>,
): Array<{ nazwa: string; ile: number }> {
  return NAJWIEKSZE_MIASTA
    .map((nazwa) => ({ nazwa, ile: liczby[nazwa] ?? 0 }))
    .filter((m) => m.ile > 0)
    .sort((a, b) => b.ile - a.ile);
}

/**
 * Porównywalna postać nazwy: bez znaków diakrytycznych, małymi literami.
 *
 * `normalize('NFD')` rozkłada „ó" na „o" + znak diakrytyczny, który potem
 * wycinamy — ale NIE rozkłada „ł", bo to osobna litera w Unicode, a nie „l"
 * z ogonkiem. Bez tej podmiany „wroclaw" nie znajdowałby Wrocławia, czyli
 * dokładnie tego, po co ta funkcja powstała: ludzie piszą w szukajce bez
 * ogonków („poznan", „gdansk").
 */
export function bezOgonkow(tekst: string): string {
  return tekst
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .trim();
}

/**
 * Podpowiedzi miast do szukajki — pasujące do wpisanego tekstu, z liczbami.
 *
 * OD POCZĄTKU NAZWY, nie w środku: „gda" ma podpowiadać Gdańsk i Gdynię,
 * ale „ork" nie ma powodu podpowiadać Bydgoszczy przez „org". Dopasowanie
 * w środku daje przy krótkich wpisach listę, która wygląda na przypadkową.
 *
 * Miasta bez ani jednego obiektu wypadają — z tego samego powodu co w
 * `miastaDoPokazania()`: zero znaczy „backfill tam nie dotarł", nie „nie ma
 * tam boisk".
 */
export function podpowiedziMiast(
  wpisane: string,
  liczby: Record<string, number>,
  limit = 5,
): Array<{ nazwa: string; ile: number }> {
  const szukane = bezOgonkow(wpisane);
  // Jedna litera podpowiada pół alfabetu — od dwóch lista zaczyna coś znaczyć.
  if (szukane.length < 2) return [];
  return NAJWIEKSZE_MIASTA
    .filter((nazwa) => bezOgonkow(nazwa).startsWith(szukane))
    .map((nazwa) => ({ nazwa, ile: liczby[nazwa] ?? 0 }))
    .filter((m) => m.ile > 0)
    .sort((a, b) => b.ile - a.ile)
    .slice(0, limit);
}
