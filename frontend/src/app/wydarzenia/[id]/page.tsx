import type { Metadata } from 'next';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { eventJsonLd } from '@/lib/structuredData';
import { defaultEventTitle } from '@/lib/eventTitle';
import { getEventMeta } from './eventMeta';
import EventDetailClient from './EventDetailClient';

// Server wrapper: provides per-event link-preview metadata (Open Graph), then
// renders the interactive client component. Without this, shared links showed
// the generic site title instead of the actual match details.
//
// `openGraph.images`/`twitter` NIE są tu ustawiane — obrazek podglądu
// dostarcza plik konwencji `opengraph-image.tsx` w tym samym katalogu
// (generowany per mecz: sport, termin, miejsce, wolne miejsca), łącznie
// z obsługą `cover_image_url`, gdyby kiedyś powstało UI do jego ustawiania.
// Next.js łączy oba źródła metadanych automatycznie.

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const ev = await getEventMeta(params.id);
  if (!ev) return { title: 'Mecz nie znaleziony | Bojo' };

  let whenStr = '';
  try {
    const d = parseISO(ev.date);
    whenStr = format(d, 'EEEE d MMMM', { locale: pl });
  } catch { whenStr = ev.date; }
  const timeStr = ev.time ? ev.time.slice(0, 5) : '';
  const place = ev.field_name || ev.custom_location_name || 'Boisko';

  const name = ev.title || defaultEventTitle(ev.sport, ev.max_players ?? 0);
  const title = `${name} — ${whenStr}${timeStr ? ` ${timeStr}` : ''} | Bojo`;
  const description = `${ev.sport} • ${whenStr}${timeStr ? `, ${timeStr}` : ''} • ${place}. Dołącz i zbierz skład na Bojo.`;

  return {
    title,
    description,
    // Canonical only for public matches — a private one is reachable solely
    // through its join link and must not advertise an indexable address.
    ...(ev.visibility === 'public'
      ? { alternates: { canonical: `/wydarzenia/${params.id}` } }
      : {}),
    openGraph: {
      title: `${name} • ${whenStr}${timeStr ? ` ${timeStr}` : ''}`,
      description: `📍 ${place}`,
      type: 'website',
    },
  };
}

export default async function EventPage({ params }: { params: { id: string } }) {
  const ev = await getEventMeta(params.id);
  const jsonLd = ev ? eventJsonLd(params.id, ev) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <EventDetailClient />
    </>
  );
}
