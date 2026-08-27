// Priorytet w sitemapie boisk, zależny od seo_tier (migracja 112) zamiast
// dawnej stałej 0.7 dla każdego boiska. Osobny plik od route.ts, który go
// używa — Next.js dopuszcza w Route Handlerach wyłącznie eksporty czasownikÓw
// HTTP (GET, POST…) i kilka nazwanych opcji konfiguracyjnych, więc dowolna
// inna funkcja eksportowana wprost z route.ts wywala build.
//
// Tier 3 nie ma tu w ogóle wpisu — te obiekty mają `noindex` w
// generateMetadata (boisko/[id]/page.tsx) i są pomijane w zapytaniu sitemapa,
// zanim priorytet w ogóle wchodzi w grę (patrz sitemap-boiska/[plik]/route.ts).
//
// Sygnatura celowo `1 | 2`, nie `number | null`: `fields.seo_tier` jest
// `SMALLINT NOT NULL DEFAULT 3` z `CHECK (seo_tier IN (1, 2, 3))` (migracja
// 112) — NULL jest niemożliwy na poziomie bazy, nie tylko przefiltrowany tu.
// `route.ts` zawęża zapytanie do `.in('seo_tier', [1, 2])`, więc każda
// wartość, jaka tu trafia, jest jedną z tych dwóch — TypeScript to teraz
// wymusza, zamiast obsługiwać przypadek, który nigdy nie zachodzi.
export function priorytetDlaTier(tier: 1 | 2): number {
  return tier === 1 ? 0.7 : 0.5;
}
