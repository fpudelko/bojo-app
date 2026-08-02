// Builders for schema.org JSON-LD. Kept out of the page components so the
// rules — above all "never emit a private event" — can be unit-tested without
// standing up Supabase.

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
          'Platforma do organizowania amatorskich meczów sportowych i baza boisk w Poznaniu.',
        areaServed: { '@type': 'City', name: 'Poznań', addressCountry: 'PL' },
      },
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        name: 'Bojo',
        url: base,
        inLanguage: 'pl-PL',
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

  const name = ev.title || `${ev.sport.charAt(0).toUpperCase()}${ev.sport.slice(1)}`;
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
              addressLocality: 'Poznań',
              addressCountry: 'PL',
            },
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
