import type { MetadataRoute } from 'next';
import { FOCUS_SPORT_BY_SLUG } from '@/lib/sports';
import { MIASTA } from '@/content/miasta';

const SPORT_SLUGS = [
  'pilka-nozna',
  'koszykowka',
  'siatkowka',
  'siatkowka-plazowa',
  'futsal',
  'pilka-reczna',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bojo.pl';

  // Only routes a user can actually reach from the UI. /cykliczne is deliberately
  // absent: SHOW_RECURRING hides its nav entries, so listing it here would send
  // crawlers to a feature nobody can find.
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/mapa`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/wydarzenia`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/grupy`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/jak-dziala-bojo`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/dlaczego-bojo`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/regulamin`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/prywatnosc`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  const sportPages: MetadataRoute.Sitemap = SPORT_SLUGS.map((slug) => ({
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

  // Boiska NIE są tu wypisywane — katalog ma 32 684+ wiersze, więc żyją
  // w osobnych sitemapach per województwo (sitemap-boiska/[plik]/route.ts),
  // zebranych w sitemap-index.xml razem z tym plikiem. Trzymanie ich tutaj
  // znaczyłoby jeden rosnący bez końca plik zamiast partycji.
  return [...staticPages, ...sportPages, ...grajPages];
}
