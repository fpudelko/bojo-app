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
