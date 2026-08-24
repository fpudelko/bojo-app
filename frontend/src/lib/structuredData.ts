// Builders for schema.org JSON-LD. Kept out of the page components so the
// rules — above all "never emit a private event" — can be unit-tested without
// standing up Supabase.

import { defaultEventTitle } from './eventTitle';
import {
  najlepszePotwierdzenie, QUORUM_POTWIERDZEN, type PotwierdzeniaZliczone,
} from './potwierdzeniaObiektu';
import { SURFACE_LABELS } from './labels';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bojo.pl';

/** Site identity, emitted once in the root layout. */
export function siteJsonLd(base: string = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: 'Bojo',
        url: base,
        description:
          'Platforma do organizowania amatorskich meczów sportowych i baza boisk w Polsce.',
        areaServed: { '@type': 'Country', name: 'Polska', addressCountry: 'PL' },
      },
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        name: 'Bojo',
        url: base,
        inLanguage: 'pl-PL',
        publisher: { '@id': `${base}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${base}/#software`,
        name: 'Bojo',
        applicationCategory: 'SportsApplication',
        operatingSystem: 'Web',
        url: base,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
        featureList: [
          'Tworzenie meczu w trzech krokach — sport, termin, opcje',
          'Dołączanie do meczu bez zakładania konta',
          'Lista rezerwowa z widoczną kolejnością',
          'Kalkulator podziału kosztów boiska między graczy',
          'Zniżki z kart sportowych — Multisport, FitProfit, Medicover Sport',
          'Publiczne mecze widoczne dla graczy z okolicy, gdy brakuje składu',
          'Grupy i stałe ekipy z historią meczów',
        ],
        publisher: { '@id': `${base}/#organization` },
      },
    ],
  };
}

export interface EventForJsonLd {
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
  lat?: number | null;
  lng?: number | null;
}

/**
 * Structured data for a match.
 *
 * Returns null for anything that isn't public. A private match is reachable
 * only through its join code, so publishing its details as machine-readable
 * data would give away exactly what that code protects.
 */
export function eventJsonLd(
  id: string,
  ev: EventForJsonLd,
  base: string = SITE_URL,
): Record<string, unknown> | null {
  if (ev.visibility !== 'public') return null;

  const name = ev.title || defaultEventTitle(ev.sport, ev.max_players ?? 0);
  const placeName = ev.field_name || ev.custom_location_name;
  const url = `${base}/wydarzenia/${id}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name,
    url,
    sport: ev.sport,
    startDate: ev.time ? `${ev.date}T${ev.time}` : ev.date,
    ...(ev.end_time ? { endDate: `${ev.date}T${ev.end_time}` } : {}),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus:
      ev.status === 'cancelled'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    ...(placeName
      ? {
          location: {
            '@type': 'Place',
            name: placeName,
            address: {
              '@type': 'PostalAddress',
              ...(ev.custom_address ? { streetAddress: ev.custom_address } : {}),
              // Miejscowość z adresu, nie zaszyta. Mecze powstają w całej
              // Polsce, więc „Poznań" w danych strukturalnych każdego meczu
              // był po prostu nieprawdą podawaną wyszukiwarkom.
              ...(() => {
                // Dopiero DRUGI człon jest miejscowością: „ul. Kwiatowa 3"
                // bez przecinka to sama ulica, a nie miasto o tej nazwie.
                const czesci = (ev.custom_address || '').split(',').map((c) => c.trim()).filter(Boolean);
                return czesci.length > 1 ? { addressLocality: czesci[czesci.length - 1] } : {};
              })(),
              addressCountry: 'PL',
            },
            ...(ev.lat != null && ev.lng != null
              ? { geo: { '@type': 'GeoCoordinates', latitude: ev.lat, longitude: ev.lng } }
              : {}),
          },
        }
      : {}),
    ...(ev.max_players ? { maximumAttendeeCapacity: ev.max_players } : {}),
    ...(ev.cost_grosz != null
      ? {
          isAccessibleForFree: ev.cost_grosz === 0,
          offers: {
            '@type': 'Offer',
            price: (ev.cost_grosz / 100).toFixed(2),
            priceCurrency: 'PLN',
            url,
          },
        }
      : {}),
    organizer: { '@id': `${base}/#organization` },
  };
}

/**
 * Breadcrumb trail. Per Google's spec the last element (the current page)
 * carries no `item` URL — pass it with `path` omitted.
 */
export function breadcrumbsJsonLd(
  items: { name: string; path?: string }[],
  base: string = SITE_URL,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.path ? { item: `${base}${it.path}` } : {}),
    })),
  };
}

/** FAQPage schema. Only ever call this with the same list rendered as visible
 *  text on the page — schema without matching visible content is a spam
 *  signal to Google, not a ranking boost. */
export function faqJsonLd(items: ReadonlyArray<{ q: string; a: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
}

/** HowTo schema. Steps should mirror visible step-by-step text on the page —
 *  same rule as `faqJsonLd()`: schema without matching visible content is
 *  a spam signal, not a ranking boost. */
export function howToJsonLd(name: string, steps: { name: string; text: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    step: steps.map((s) => ({ '@type': 'HowToStep', name: s.name, text: s.text })),
  };
}

/** Venue list for a sport category page. */
export function venueListJsonLd(
  listName: string,
  venues: { name: string; slug: string }[],
  base: string = SITE_URL,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: venues.length,
    itemListElement: venues.map((v, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${base}/boisko/${v.slug}`,
      name: v.name,
    })),
  };
}

/**
 * `amenityFeature` z potwierdzeń graczy (migracja 123, Faza 3 SEO/GEO) —
 * dane, których nie ma żaden katalog importujący z OpenStreetMap, bo wymagają
 * ludzi, którzy na obiekcie realnie byli. Wystawiane maszynom TYLKO po
 * osiągnięciu tego samego quorum, które pokazuje je człowiekowi
 * (`AnkietyObiektu.tsx`) — schema bez pokrycia w widocznej treści jest
 * sygnałem spamu, nie przewagi (ta sama zasada co przy `faqJsonLd()`
 * i `howToJsonLd()` w tym pliku).
 *
 * Zwraca pustą tablicę, gdy żaden fakt nie osiągnął quorum — wołający
 * pomija wtedy `amenityFeature` w całości, zamiast emitować pusty klucz.
 */
export function venueAmenityFeatures(
  zliczone: readonly PotwierdzeniaZliczone[],
): Record<string, unknown>[] {
  const cechy: Record<string, unknown>[] = [];

  const oswietlenie = najlepszePotwierdzenie(zliczone, 'oswietlenie');
  if (oswietlenie && oswietlenie.liczba >= QUORUM_POTWIERDZEN) {
    cechy.push({
      '@type': 'LocationFeatureSpecification',
      name: 'Oświetlenie',
      value: oswietlenie.wartosc === 'tak',
      description: `Potwierdzone przez ${oswietlenie.liczba} graczy w Bojo`,
    });
  }

  const nawierzchnia = najlepszePotwierdzenie(zliczone, 'nawierzchnia');
  if (nawierzchnia && nawierzchnia.liczba >= QUORUM_POTWIERDZEN) {
    const etykieta = SURFACE_LABELS[nawierzchnia.wartosc] ?? nawierzchnia.wartosc;
    cechy.push({
      '@type': 'LocationFeatureSpecification',
      name: `Nawierzchnia: ${etykieta.toLowerCase()}`,
      value: true,
      description: `Potwierdzone przez ${nawierzchnia.liczba} graczy w Bojo`,
    });
  }

  return cechy;
}
