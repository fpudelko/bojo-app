import type { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/utils';
import { pobierzWszystkie } from '@/lib/zapytania';

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

  let fieldPages: MetadataRoute.Sitemap = [];
  try {
    // Stronicowanie przez `pobierzWszystkie()`: PostgREST obcina zbyt długą
    // odpowiedź BEZ błędu, więc jedno zapytanie po katalogu liczącym tysiące
    // obiektów po cichu gubiło ogon. Pętla mieszkała tu we własnej kopii —
    // druga stała w indeksie slugów, co znaczyło dwa miejsca do poprawienia
    // przy każdej zmianie i dwa miejsca do zapomnienia.
    const wiersze = await pobierzWszystkie<{ id: string; name: string }>((od, doIdx) =>
      supabase
        .from('fields')
        .select('name, id')
        .eq('map_visibility', 'public')
        .order('id')
        .range(od, doIdx));
    fieldPages = wiersze
      .filter((field) => field.name)
      .map((field) => ({
        url: `${base}/boisko/${slugify(field.name)}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }));
  } catch {
    // sitemap degrades gracefully if DB unavailable
  }

  return [...staticPages, ...sportPages, ...fieldPages];
}
