import type { Metadata } from 'next';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { defaultEventTitle } from '@/lib/eventTitle';

// Wydzielone z page.tsx, żeby ten sam odczyt meczu (klient anon, bez sesji —
// obie trasy renderują się po stronie serwera, bez cookies użytkownika) mógł
// współdzielić opengraph-image.tsx (edge runtime), bez importowania czegoś
// z pliku page.tsx.

export interface EventMeta {
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
  lat: number | null;
  lng: number | null;
}

export async function getEventMeta(id: string): Promise<EventMeta | null> {
  const { data } = await supabase
    .from('events')
    .select(
      'title, sport, event_date, event_time, end_time, field_name, custom_location_name, custom_address, visibility, status, max_players, cost_grosz, cover_image_url, lat, lng',
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
    lat: data.lat ?? null,
    lng: data.lng ?? null,
  };
}

/**
 * Metadane strony meczu. Czysta funkcja — bez Supabase i bez Next.js w środku —
 * żeby próg widoczności dało się przetestować tak samo jak `eventJsonLd()`
 * w lib/structuredData.ts.
 *
 * Prywatny mecz jest osiągalny WYŁĄCZNIE przez link dołączenia, więc jego nazwa,
 * termin i miejsce nie mogą wyjść w <title>, <meta name="description"> ani w og:.
 * Wcześniej wychodziły: chroniony był JSON-LD (structuredData.ts), a metadane nie,
 * więc wystarczyło, żeby link raz trafił w publiczne miejsce, i szczegóły meczu
 * mogły wjechać do wyszukiwarki. Ten sam próg obowiązuje w opengraph-image.tsx.
 */
export function metadataDlaMeczu(id: string, ev: EventMeta | null): Metadata {
  // Brak meczu i mecz niepubliczny dostają tę samą, bezcechową odpowiedź — po
  // metadanych nie da się wtedy odróżnić „nie ma takiego meczu" od „jest, ale nie
  // dla ciebie".
  if (!ev || ev.visibility !== 'public') {
    return { title: 'Mecz', robots: { index: false, follow: false } };
  }

  let whenStr = '';
  try {
    whenStr = format(parseISO(ev.date), 'EEEE d MMMM', { locale: pl });
  } catch { whenStr = ev.date; }
  const timeStr = ev.time ? ev.time.slice(0, 5) : '';
  const place = ev.field_name || ev.custom_location_name || 'Boisko';
  const name = ev.title || defaultEventTitle(ev.sport, ev.max_players ?? 0);

  return {
    // BEZ ręcznego „| Bojo" — sufiks dokłada `title.template` z layout.tsx.
    title: `${name} — ${whenStr}${timeStr ? ` ${timeStr}` : ''}`,
    description: `${ev.sport} • ${whenStr}${timeStr ? `, ${timeStr}` : ''} • ${place}. Dołącz i zbierz skład na Bojo.`,
    alternates: { canonical: `/wydarzenia/${id}` },
    openGraph: {
      title: `${name} • ${whenStr}${timeStr ? ` ${timeStr}` : ''}`,
      description: `📍 ${place}`,
      type: 'website',
    },
  };
}
