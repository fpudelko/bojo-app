// Nagłówki odpowiedzi dla sitemapów (`app/sitemap-index.xml`,
// `app/sitemap-boiska/[plik]`).
//
// PO CO: oba są route handlerami, a te bez jawnego `Cache-Control` wykonują
// się od nowa na KAŻDE pobranie. Sitemap boisk przewija przy tym cały katalog
// województwa (`pobierzWszystkie()` stronicuje po tysiącach wierszy) i skleja
// XML od zera. Robot pobiera szesnaście takich plików regularnie, więc to
// leciało prosto w limit czasu procesora funkcji na Vercelu (plan darmowy:
// 4 godziny „Fluid Active CPU" miesięcznie — w sierpniu 2026 wyczerpane
// w całości). Z nagłówkiem odpowiedź oddaje CDN, a funkcja startuje
// najwyżej raz na dobę.
//
// Dobór wartości:
//   s-maxage=86400            — doba świeżości na krawędzi. Sitemap nie musi
//                               znać boiska zaimportowanego godzinę temu;
//                               `sitemap.ts` stoi na tej samej wartości.
//   stale-while-revalidate    — tydzień. Po wygaśnięciu robot dostaje starą
//                               kopię OD RAZU, a odświeżenie leci w tle:
//                               nigdy nie czeka na przemiał katalogu.
//   max-age=0                 — przeglądarka nie trzyma nic. Sitemap ogląda
//                               człowiek wyłącznie wtedy, gdy sprawdza, czy
//                               jest aktualny, i ma wtedy zobaczyć prawdę.
export const NAGLOWKI_SITEMAP = {
  'Content-Type': 'application/xml',
  'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
} as const;

/** Ile sekund CDN trzyma sitemap bez pytania funkcji. Ta sama wartość, co
 *  `s-maxage` wyżej — `export const revalidate` w route handlerach czyta
 *  stąd, żeby oba mechanizmy nie rozjechały się po cichu. */
export const SEKUND_CACHE_SITEMAP = 86400;
