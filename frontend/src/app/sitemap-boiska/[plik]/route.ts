import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/utils';
import { pobierzWszystkie } from '@/lib/zapytania';
import { WOJEWODZTWA } from '@/lib/wojewodztwa';
import { priorytetDlaTier } from '@/lib/sitemapTier';

// Sitemap boisk, partycjonowany po województwie zamiast jednego pliku na
// cały katalog (32 684 wiersze, rosnący). Adres to /sitemap-boiska/<slug>.xml
// — segment routingu to cały "<slug>.xml", bo Next.js nie ma osobnej notacji
// na rozszerzenie w dynamicznym segmencie folderu.
//
// Tier 3 (patrz migracja 112) jest tu pomijany celowo: te obiekty mają
// `noindex` w generateMetadata (boisko/[id]/page.tsx), więc wpis w sitemapie
// byłby sprzeczną instrukcją dla Googlebota — sitemap ma zawierać wyłącznie
// adresy, które NAPRAWDĘ mają być indeksowane.

export async function GET(
  _req: Request,
  { params }: { params: { plik: string } },
) {
  const slug = params.plik.replace(/\.xml$/, '');
  if (!WOJEWODZTWA.includes(slug as (typeof WOJEWODZTWA)[number])) {
    return new NextResponse('Nieznane województwo', { status: 404 });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bojo.pl';

  let wiersze: { id: string; name: string; seo_tier: number | null }[] = [];
  try {
    wiersze = await pobierzWszystkie<{ id: string; name: string; seo_tier: number | null }>(
      (od, doIdx) =>
        supabase
          .from('fields')
          .select('name, id, seo_tier')
          .eq('map_visibility', 'public')
          .eq('voivodeship', slug)
          .neq('seo_tier', 3)
          .order('id')
          .range(od, doIdx),
    );
  } catch {
    // Zdegraduj do pustego sitemapa zamiast wywalać cały request — tak samo
    // jak dziś robi to sitemap.ts przy niedostępnej bazie.
  }

  const urls = wiersze
    .filter((f) => f.name)
    .map((f) => {
      const loc = `${base}/boisko/${slugify(f.name)}`;
      const priority = priorytetDlaTier(f.seo_tier);
      return `<url><loc>${loc}</loc><changefreq>monthly</changefreq><priority>${priority}</priority></url>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
