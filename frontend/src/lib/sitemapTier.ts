// Priorytet w sitemapie boisk, zależny od seo_tier (migracja 112) zamiast
// dawnej stałej 0.7 dla każdego boiska. Osobny plik od route.ts, który go
// używa — Next.js dopuszcza w Route Handlerach wyłącznie eksporty czasownikÓw
// HTTP (GET, POST…) i kilka nazwanych opcji konfiguracyjnych, więc dowolna
// inna funkcja eksportowana wprost z route.ts wywala build.
//
// Tier 3 nie ma tu w ogóle wpisu — te obiekty mają `noindex` w
// generateMetadata (boisko/[id]/page.tsx) i są pomijane w zapytaniu sitemapa,
// zanim priorytet w ogóle wchodzi w grę (patrz sitemap-boiska/[plik]/route.ts).
export function priorytetDlaTier(tier: number | null): number {
  if (tier === 1) return 0.7;
  if (tier === 2) return 0.5;
  return 0.3; // tier nieznany (NULL, przed backfillem) — ostrożnie, nie 0.7 jak dotąd
}
