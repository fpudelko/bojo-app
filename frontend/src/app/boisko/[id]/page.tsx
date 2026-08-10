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
// Godzina, nie pięć minut. Indeks to pełny przemiał kolumn `(id, name)` po
// całym katalogu, a pamięć podręczna żyje w PROCESIE — każda instancja funkcji
// serverless buduje własną. Przy pięciu minutach ten sam katalog jechał przez
// sieć kilkanaście razy na godzinę na każdą żywą instancję, wyłącznie po to,
// żeby rozwiązać slug na identyfikator.
//
// Wydłużenie jest bezpieczne, bo pudło i tak wymusza odświeżenie (patrz
// `idForSlug()` niżej): świeżo zaimportowany obiekt nie czeka na wygaśnięcie
// wpisu, tylko przebudowuje indeks przy pierwszym wejściu na swoją stronę.
const SLUG_INDEX_TTL_MS = 60 * 60 * 1000;
let slugIndexCache: { at: number; index: Promise<Map<string, string>> } | null = null;

// Strona po strony, nie jednym zapytaniem. PostgREST ma serwerowy limit
// wierszy na odpowiedź (w Supabase to ustawienie „Max rows"), a przekroczenie
// go NIE jest błędem — po prostu przychodzi obcięta lista. Przy katalogu, który
// właśnie przekroczył 4 tysiące obiektów, indeks budowany jednym zapytaniem
// milcząco gubił ogon: świeżo zaimportowane boisko nie miało swojego sluga,
// a jego strona zwracała „Nie znaleziono strony".
const STRONA = 1000;

async function fetchSlugIndex(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let od = 0; ; od += STRONA) {
    const { data, error } = await supabase
      .from('fields')
      .select('id, name')
      .order('id')
      .range(od, od + STRONA - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) {
      if (!row.name) continue;
      const slug = slugify(row.name);
      // Nazwy się powtarzają (169 duplikatów w katalogu). Pierwszy wygrywa —
      // tak samo jak wcześniejsze `.find()`.
      if (!map.has(slug)) map.set(slug, row.id);
    }
    if (rows.length < STRONA) return map;
  }
}

async function idForSlug(slug: string): Promise<string | null> {
  const swiezy = async () => {
    const index = fetchSlugIndex();
    // Obietnica zapamiętana DOPIERO po sukcesie. Zapamiętana od razu oznaczała,
    // że jedna nieudana odpowiedź z bazy psuje każdą stronę boiska przez cały
    // czas życia wpisu w pamięci podręcznej.
    const gotowy = await index;
    slugIndexCache = { at: Date.now(), index: Promise.resolve(gotowy) };
    return gotowy;
  };

  const now = Date.now();
  let index: Map<string, string>;
  if (!slugIndexCache || now - slugIndexCache.at > SLUG_INDEX_TTL_MS) {
    index = await swiezy();
  } else {
    index = await slugIndexCache.index;
  }

  const hit = index.get(slug);
  if (hit) return hit;

  // Pudło może znaczyć „obiekt dodany albo przemianowany po zbudowaniu
  // indeksu". Jedno odświeżenie, żeby nowa nazwa nie zwracała 404 do końca
  // życia procesu.
  return (await swiezy()).get(slug) ?? null;
}

/**
 * Miejscowość z adresu — ostatni człon po przecinku, tak jak układa go import
 * z OSM („ul. Szkolna 4, Włodawa").
 *
 * Używana i w tytule strony, i w danych strukturalnych. Wcześniej jedno i drugie
 * miało zaszyty Poznań, więc boisko w Lublinie przedstawiało się wyszukiwarkom
 * jako poznańskie — a to nie jest kwestia stylu, tylko nieprawdziwy adres
 * w `schema.org`.
 */
function miejscowoscZAdresu(address?: string): string | undefined {
  const czesci = (address || '').split(',').map((c) => c.trim()).filter(Boolean);
  if (czesci.length === 0) return undefined;
  if (czesci.length > 1) return czesci[czesci.length - 1];
  // Jeden człon bywa jednym albo drugim: import z OSM zapisuje samą
  // miejscowość, gdy boisko nie ma ulicy („Kozanów"), ale bywa też sam adres
  // („ul. Szkolna 4"). Rozróżnia je przedrostek.
  return /^(ul\.|al\.|pl\.|os\.)/i.test(czesci[0]) ? undefined : czesci[0];
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
  // Miejscowość z adresu zamiast zaszytego „w Poznaniu". Katalog obejmuje dziś
  // całą Polskę, więc tytuł boiska w Lublinie mówiący „w Poznaniu" był po
  // prostu nieprawdziwy — i tak samo trafiał do wyszukiwarek.
  const miejscowosc = miejscowoscZAdresu(field.address);
  const gdzie = miejscowosc ? ` w ${miejscowosc}` : '';
  return {
    title: `${field.name} — ${sportsStr}${gdzie} | Bojo`,
    description: `${field.name}, ${field.address}. Sporty: ${sportsStr}. Znajdź nadchodzące mecze i zarezerwuj termin na Bojo.`,
    // Canonical points at the slug URL — the page also resolves by raw id,
    // and both must collapse into one address for crawlers.
    alternates: { canonical: `/boisko/${slugify(field.name)}` },
    openGraph: {
      title: `${field.name} | Bojo`,
      description: `Boisko${gdzie}: ${field.address}. ${sportsStr}.`,
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

  const miasto = miejscowoscZAdresu(field.address);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: field.name,
    description: `Boisko sportowe${miasto ? ` w ${miasto}` : ''}. Sporty: ${field.sport.join(', ')}.`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: field.address,
      // Miejscowość z adresu obiektu, nie zaszyta. Katalog obejmuje całą Polskę.
      ...(miasto ? { addressLocality: miasto } : {}),
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
