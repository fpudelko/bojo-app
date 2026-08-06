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
import { sportLabel } from '@/lib/sports';
import { breadcrumbsJsonLd } from '@/lib/structuredData';
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
    district: row.district ?? undefined,
  };
}

// Slug nie istnieje w bazie jako kolumna, więc nie da się po nim filtrować
// w SQL — trzeba pobrać nazwy i policzyć slugi po stronie serwera. Wcześniej
// robił to `select('*')` na całej tabeli, wykonywany raz na KAŻDE renderowanie
// strony boiska (a `generateMetadata` i sam komponent to dwa osobne). Przy
// poznańskim katalogu (~1500 obiektów) to bolało; po imporcie z OSM (~4600)
// czas builda wystrzelił w dziesiątki minut. Teraz: dwie kolumny zamiast
// wszystkich i jeden wspólny indeks na proces.
const SLUG_INDEX_TTL_MS = 5 * 60 * 1000;
let slugIndexCache: { at: number; index: Promise<Map<string, string>> } | null = null;

async function fetchSlugIndex(): Promise<Map<string, string>> {
  const { data } = await supabase.from('fields').select('id, name');
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const slug = slugify(row.name);
    // Nazwy się powtarzają (169 duplikatów w katalogu). Pierwszy wygrywa —
    // tak samo jak wcześniejsze `.find()`.
    if (!map.has(slug)) map.set(slug, row.id);
  }
  return map;
}

async function idForSlug(slug: string): Promise<string | null> {
  const now = Date.now();
  if (!slugIndexCache || now - slugIndexCache.at > SLUG_INDEX_TTL_MS) {
    slugIndexCache = { at: now, index: fetchSlugIndex() };
  }
  const hit = (await slugIndexCache.index).get(slug);
  if (hit) return hit;
  // Pudło może znaczyć „obiekt dodany albo przemianowany po zbudowaniu
  // indeksu". Jedno odświeżenie, żeby nowa nazwa nie zwracała 404 do końca
  // życia procesu.
  slugIndexCache = { at: now, index: fetchSlugIndex() };
  return (await slugIndexCache.index).get(slug) ?? null;
}

async function resolveField(idOrSlug: string): Promise<Field | null> {
  const id = isUuid(idOrSlug) ? idOrSlug : await idForSlug(idOrSlug);
  if (!id) return null;
  const { data } = await supabase.from('fields').select('*').eq('id', id).maybeSingle();
  return data ? toField(data) : null;
}

// ---------------------------------------------------------------------------
// Renderowanie na żądanie zamiast prerenderu całego katalogu
// ---------------------------------------------------------------------------
// Do niedawna `generateStaticParams()` zwracało slug KAŻDEGO obiektu, więc
// build generował tyle stron, ile boisk jest w bazie. Przy Poznaniu (~1500)
// dawało się to znieść. Po imporcie z OpenStreetMap katalog urósł do ~4600
// i build przestał się kończyć w rozsądnym czasie — a docelowo mówimy
// o dziesiątkach tysięcy obiektów z całej Polski. Prerender całości nie
// skaluje się z założenia.
//
// Pusta lista + domyślne `dynamicParams` znaczy: strona boiska powstaje przy
// pierwszym wejściu i zostaje w cache'u na dobę. Czas builda przestaje zależeć
// od wielkości katalogu. Adresy i mapa strony (`sitemap.ts`) się nie zmieniają,
// więc dla wyszukiwarek nic nie znika — pierwsze wejście robota jest tylko
// odrobinę wolniejsze.
//
// Efekt uboczny: znika pułapka `useSearchParams()` w prerenderze — ta trasa
// nie jest już generowana przy buildzie.
export const revalidate = 86400;

export async function generateStaticParams() {
  return [];
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
    // Canonical points at the slug URL — the page also resolves by raw id,
    // and both must collapse into one address for crawlers.
    alternates: { canonical: `/boisko/${slugify(field.name)}` },
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
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bojo.pl';
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

  // Middle crumb only for sports that actually have a /boiska/[sport] page
  // (mirror of SPORT_MAP keys in app/boiska/[sport]/page.tsx) — legacy sports
  // like "gokarty" would otherwise link to a 404.
  const SPORT_PAGE_SLUGS = ['pilka-nozna', 'koszykowka', 'siatkowka', 'siatkowka-plazowa', 'futsal', 'pilka-reczna', 'inne'];
  const sportSlug = field.sport.length ? slugify(field.sport[0]) : null;
  const breadcrumbs = breadcrumbsJsonLd([
    { name: 'Strona główna', path: '/' },
    ...(sportSlug && SPORT_PAGE_SLUGS.includes(sportSlug)
      ? [{ name: `Boiska: ${sportLabel(field.sport[0])}`, path: `/boiska/${sportSlug}` }]
      : []),
    { name: field.name },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
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
