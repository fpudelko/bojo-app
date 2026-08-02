import type { Metadata } from 'next';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { eventJsonLd } from '@/lib/structuredData';
import EventDetailClient from './EventDetailClient';

// Server wrapper: provides per-event link-preview metadata (Open Graph), then
// renders the interactive client component. Without this, shared links showed
// the generic site title instead of the actual match details.

interface EventMeta {
  title?: string;
  sport: string;
  date: string;
  time?: string;
  end_time?: string;
  field_name?: string;
  custom_location_name?: string;
  custom_address?: string;
  visibility: string;
  status?: string;
  max_players?: number;
  cost_grosz?: number;
  cover?: string;
}

async function getEventMeta(id: string): Promise<EventMeta | null> {
  const { data } = await supabase
    .from('events')
    .select(
      'title, sport, event_date, event_time, end_time, field_name, custom_location_name, custom_address, visibility, status, max_players, cost_grosz, cover_image_url',
    )
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  return {
    title: data.title ?? undefined,
    sport: data.sport,
    date: data.event_date,
    time: data.event_time ?? undefined,
    end_time: data.end_time ?? undefined,
    field_name: data.field_name ?? undefined,
    custom_location_name: data.custom_location_name ?? undefined,
    custom_address: data.custom_address ?? undefined,
    visibility: data.visibility,
    status: data.status ?? undefined,
    max_players: data.max_players ?? undefined,
    cost_grosz: data.cost_grosz ?? undefined,
    cover: data.cover_image_url ?? undefined,
  };
}


export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const ev = await getEventMeta(params.id);
  if (!ev) return { title: 'Mecz nie znaleziony | Bojo' };

  let whenStr = '';
  try {
    const d = parseISO(ev.date);
    whenStr = format(d, 'EEEE d MMMM', { locale: pl });
  } catch { whenStr = ev.date; }
  const timeStr = ev.time ? ev.time.slice(0, 5) : '';
  const place = ev.field_name || ev.custom_location_name || 'Poznań';

  const name = ev.title || `${ev.sport.charAt(0).toUpperCase()}${ev.sport.slice(1)}`;
  const title = `${name} — ${whenStr}${timeStr ? ` ${timeStr}` : ''} | Bojo`;
  const description = `${ev.sport} • ${whenStr}${timeStr ? `, ${timeStr}` : ''} • ${place}. Dołącz i zbierz skład na Bojo.`;

  return {
    title,
    description,
    openGraph: {
      title: `${name} • ${whenStr}${timeStr ? ` ${timeStr}` : ''}`,
      description: `📍 ${place}`,
      type: 'website',
      // Event cover if set; otherwise inherit the site default from the root layout.
      ...(ev.cover ? { images: [{ url: ev.cover }] } : {}),
    },
    ...(ev.cover ? { twitter: { card: 'summary_large_image', images: [ev.cover] } } : {}),
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
