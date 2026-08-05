import type { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/utils';

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
    const { data } = await supabase.from('fields').select('name, id').eq('map_visibility', 'public');
    fieldPages = (data ?? []).map((field) => ({
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
