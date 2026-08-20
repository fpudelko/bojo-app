import { supabase } from '@/lib/supabase';

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
