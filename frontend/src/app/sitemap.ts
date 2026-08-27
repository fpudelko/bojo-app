import type { MetadataRoute } from 'next';
import { FOCUS_SPORT_BY_SLUG, HUBY_KATALOGU_SPORTOWYCH } from '@/lib/sports';
import { MIASTA } from '@/content/miasta';
import { WOJEWODZTWA } from '@/lib/wojewodztwa';
import { paryHubowMiastSportu } from '@/lib/hubMiasta';

// Sitemap generuje się co najwyżej raz na dobę, nie na każde żądanie — jedyne
// zapytania do bazy w tym pliku to `paryHubowMiastSportu()` (siedem zapytań,
// po jednym na sport z KATALOG_SPORT_MAP), a bez cache'u leciałyby przy
// każdym pobraniu sitemap.xml przez robota.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bojo.pl';

  // Only routes a user can actually reach from the UI. /cykliczne is deliberately
  // absent: SHOW_RECURRING hides its nav entries, so listing it here would send
  // crawlers to a feature nobody can find.
  // /mapa, /wydarzenia i /grupy mają priorytet NIŻSZY niż strony treści poniżej,
  // mimo że dla człowieka są ważniejsze — bo dla robota nie są tym samym.
  // Wszystkie trzy dociągają listę po zamontowaniu (komentarze w ich page.tsx:
  // „Sama lista dociąga dane po zamontowaniu... figuruje w mapie strony z
  // wysokim priorytetem i nie prowadzi donikąd"), a /mapa nie ma nawet tyle —
  // to czysty klient (Leaflet, ssr:false). Priorytet w sitemap.xml to
  // deklaracja WAŻNOŚCI dla robota, a robot dostaje na tych trzech trasach
  // najmniej treści z całego serwisu (dług D10, docs/seo-geo-strategia.md).
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/mapa`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.3 },
    { url: `${base}/wydarzenia`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.5 },
    { url: `${base}/grupy`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.4 },
    { url: `${base}/jak-dziala-bojo`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/dlaczego-bojo`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/kalkulator-kosztow-boiska`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/regulamin`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/prywatnosc`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  const sportPages: MetadataRoute.Sitemap = HUBY_KATALOGU_SPORTOWYCH.map(({ slug }) => ({
    url: `${base}/boiska/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  // Iloczyn sportów i miast — dokładnie to, co generuje generateStaticParams
  // w /[sport]/[miasto]. Oba czytają z tych samych, bounded list, więc sitemap
  // nie ma jak obiecać adresu, którego trasa nie zbuduje.
  const grajPages: MetadataRoute.Sitemap = Object.keys(FOCUS_SPORT_BY_SLUG).flatMap((slug) =>
    MIASTA.map((miasto) => ({
      url: `${base}/${slug}/${miasto.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
  );

  // Faza 2b: 16 hubów wojewódzkich — bounded lista jak sportPages, w
  // przeciwieństwie do samych boisk pod spodem (patrz niżej).
  const wojewodztwoPages: MetadataRoute.Sitemap = WOJEWODZTWA.map((slug) => ({
    url: `${base}/boiska/woj/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }));

  // Roadmapa SEO/GEO, poz. 20: huby miejskie `/boiska/[sport]/[miasto]`, tylko
  // pary powyżej progu jakości (lib/hubMiasta.ts) — sitemap nie ma obiecywać
  // adresu, który sama trasa i tak odrzuci jako 404. Bounded jak sportPages
  // i wojewodztwoPages: miasta_priorytetowe ma z założenia stałą wielkość rzędu
  // stu wierszy, niezależnie od tego, ile urośnie cały katalog boisk.
  //
  // Zdegraduj do pustej listy zamiast wywalać CAŁY sitemap przy niedostępnej
  // bazie (tak samo jak sitemap-boiska/[plik]/route.ts) — to jedyne miejsce
  // w tym pliku, które dotyka bazy, i build produkcyjny na atrapach kluczy
  // (AGENTS.md) inaczej wywalałby prerender /sitemap.xml za każdym razem.
  let hubyMiastPary: Awaited<ReturnType<typeof paryHubowMiastSportu>> = [];
  try {
    hubyMiastPary = await paryHubowMiastSportu();
  } catch {
    // Puste — reszta sitemapa (statyczne i bounded listy) zostaje poprawna.
  }
  const hubyMiastPages: MetadataRoute.Sitemap = hubyMiastPary.map(
    ({ sportSlug, miastoSlug }) => ({
      url: `${base}/boiska/${sportSlug}/${miastoSlug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.55,
    }),
  );

  // Boiska NIE są tu wypisywane — katalog ma ponad 30 000 wierszy (ta sama
  // liczba co w content/dlaczego.ts — jedno źródło, nie osobny snapshot), więc żyją
  // w osobnych sitemapach per województwo (sitemap-boiska/[plik]/route.ts),
  // zebranych w sitemap-index.xml razem z tym plikiem. Trzymanie ich tutaj
  // znaczyłoby jeden rosnący bez końca plik zamiast partycji.
  return [...staticPages, ...sportPages, ...grajPages, ...wojewodztwoPages, ...hubyMiastPages];
}
