import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, MapPin, Target, Circle, Trophy, Sun, Zap, Dumbbell, Activity } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { slugify, isUuid } from '@/lib/utils';
import type { Field } from '@/types';
import VenueDetailClient from './VenueDetailClient';

// ---------------------------------------------------------------------------
// Sport icons (lucide-react, no emoji)
// ---------------------------------------------------------------------------
const SPORT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'piłka nożna': Target,
  koszykówka: Circle,
  siatkówka: Trophy,
  'siatkówka plażowa': Sun,
  futsal: Zap,
  'piłka ręczna': Dumbbell,
  inne: Activity,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toField(row: any): Field {
  const bookingType = row.booking_type ?? 'none';
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: Number(row.lat),
    lng: Number(row.lng),
    sport: row.sport ?? [],
    available: row.available,
    surface: row.surface ?? '',
    isIndoor: row.is_indoor,
    isBookable: bookingType === 'internal',
    bookingType,
    bookingUrl: row.booking_url ?? undefined,
    bookingEnabled: row.booking_enabled ?? false,
    managerId: row.manager_id ?? undefined,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    mapVisibility: row.map_visibility ?? 'organizer_only',
  };
}

async function resolveField(idOrSlug: string): Promise<Field | null> {
  if (isUuid(idOrSlug)) {
    const { data } = await supabase.from('fields').select('*').eq('id', idOrSlug).maybeSingle();
    return data ? toField(data) : null;
  }
  const { data } = await supabase.from('fields').select('*');
  const match = (data ?? []).find((row) => slugify(row.name) === idOrSlug);
  return match ? toField(match) : null;
}

// ---------------------------------------------------------------------------
// Static params (pre-render all slug-based URLs)
// ---------------------------------------------------------------------------
export async function generateStaticParams() {
  try {
      const { data } = await supabase.from('fields').select('id, name');
    return (data ?? []).map((f) => ({ id: slugify(f.name) }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const field = await resolveField(params.id);
  if (!field) return { title: 'Boisko nie znalezione | Bojo' };

  const sportsStr = field.sport.join(', ');
  return {
    title: `${field.name} — ${sportsStr} w Poznaniu | Bojo`,
    description: `${field.name}, ${field.address}. Sporty: ${sportsStr}. Znajdź nadchodzące mecze i zarezerwuj termin na Bojo.`,
    openGraph: {
      title: `${field.name} | Bojo`,
      description: `Boisko w Poznaniu: ${field.address}. ${sportsStr}.`,
      type: 'website',
    },
  };
}

// ---------------------------------------------------------------------------
// Upcoming events for this field (server-fetched)
// ---------------------------------------------------------------------------
interface UpcomingEvent {
  id: string;
  sport: string;
  date: string;
  time: string;
  maxPlayers: number;
  currentCount: number;
}

async function getUpcomingEvents(fieldId: string): Promise<UpcomingEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('events')
    .select('id, sport, event_date, event_time, max_players')
    .eq('field_id', fieldId)
    .eq('visibility', 'public')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(5);

  if (!data) return [];

  const eventIds = data.map((e) => e.id);
  const { data: counts } = await supabase
    .from('event_participants')
    .select('event_id')
    .in('event_id', eventIds)
    .eq('is_reserve', false);

  const countMap: Record<string, number> = {};
  for (const c of counts ?? []) {
    countMap[c.event_id] = (countMap[c.event_id] ?? 0) + 1;
  }

  return data.map((e) => ({
    id: e.id,
    sport: e.sport,
    date: e.event_date,
    time: e.event_time?.slice(0, 5) ?? '',
    maxPlayers: e.max_players,
    currentCount: countMap[e.id] ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default async function VenuePage({ params }: { params: { id: string } }) {
  const field = await resolveField(params.id);
  if (!field) notFound();

  const upcomingEvents = await getUpcomingEvents(field.id);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bojo.app';
  const slug = slugify(field.name);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: field.name,
    description: `Boisko sportowe w Poznaniu. Sporty: ${field.sport.join(', ')}.`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: field.address,
      addressLocality: 'Poznań',
      addressCountry: 'PL',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: field.lat,
      longitude: field.lng,
    },
    url: `${base}/boisko/${slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Upcoming events section — server-rendered for SEO */}
      {upcomingEvents.length > 0 && (
        <div className="hidden">
          {/* Structured data hint for crawlers */}
          <span itemProp="name">{field.name}</span>
          <span itemProp="address">{field.address}</span>
          {field.sport.map((s) => <span key={s} itemProp="sport">{s}</span>)}
        </div>
      )}

      <VenueDetailClient fieldId={field.id} upcomingEvents={upcomingEvents} />
    </>
  );
}
