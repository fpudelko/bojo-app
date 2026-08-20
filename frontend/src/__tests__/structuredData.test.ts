import { describe, it, expect } from 'vitest';
import { breadcrumbsJsonLd, eventJsonLd, siteJsonLd, venueListJsonLd, type EventForJsonLd } from '@/lib/structuredData';

const BASE = 'https://bojo.pl';

function publicEvent(overrides: Partial<EventForJsonLd> = {}): EventForJsonLd {
  return {
    sport: 'piłka nożna',
    date: '2026-09-12',
    time: '18:00',
    visibility: 'public',
    ...overrides,
  };
}

describe('eventJsonLd — widoczność', () => {
  it('nie emituje niczego dla meczu prywatnego', () => {
    expect(eventJsonLd('abc', publicEvent({ visibility: 'private' }), BASE)).toBeNull();
  });

  it('nie emituje niczego dla nieznanej wartości visibility', () => {
    expect(eventJsonLd('abc', publicEvent({ visibility: 'group' }), BASE)).toBeNull();
  });

  it('emituje SportsEvent dla meczu publicznego', () => {
    const out = eventJsonLd('abc', publicEvent(), BASE);
    expect(out).not.toBeNull();
    expect(out!['@type']).toBe('SportsEvent');
    expect(out!.url).toBe(`${BASE}/wydarzenia/abc`);
  });
});

describe('eventJsonLd — pola', () => {
  it('składa startDate z daty i godziny', () => {
    const out = eventJsonLd('abc', publicEvent(), BASE)!;
    expect(out.startDate).toBe('2026-09-12T18:00');
  });

  it('bez godziny zostawia samą datę', () => {
    const out = eventJsonLd('abc', publicEvent({ time: undefined }), BASE)!;
    expect(out.startDate).toBe('2026-09-12');
    expect(out.endDate).toBeUndefined();
  });

  it('dodaje endDate tylko gdy jest end_time', () => {
    const out = eventJsonLd('abc', publicEvent({ end_time: '20:00' }), BASE)!;
    expect(out.endDate).toBe('2026-09-12T20:00');
  });

  it('oznacza odwołany mecz jako EventCancelled', () => {
    const out = eventJsonLd('abc', publicEvent({ status: 'cancelled' }), BASE)!;
    expect(out.eventStatus).toBe('https://schema.org/EventCancelled');
  });

  it('domyślnie mecz jest EventScheduled', () => {
    const out = eventJsonLd('abc', publicEvent(), BASE)!;
    expect(out.eventStatus).toBe('https://schema.org/EventScheduled');
  });

  it('używa nazwy własnej, a w jej braku sportu z wielkiej litery', () => {
    expect(eventJsonLd('a', publicEvent({ title: 'Wtorkowa ligówka' }), BASE)!.name)
      .toBe('Wtorkowa ligówka');
    expect(eventJsonLd('a', publicEvent(), BASE)!.name).toBe('Piłka nożna');
  });

  it('przelicza grosze na złote w ofercie', () => {
    const out = eventJsonLd('abc', publicEvent({ cost_grosz: 2550 }), BASE)!;
    expect(out.offers).toMatchObject({ price: '25.50', priceCurrency: 'PLN' });
    expect(out.isAccessibleForFree).toBe(false);
  });

  it('mecz za darmo jest oznaczony jako bezpłatny', () => {
    const out = eventJsonLd('abc', publicEvent({ cost_grosz: 0 }), BASE)!;
    expect(out.isAccessibleForFree).toBe(true);
  });

  it('bez kosztu nie emituje oferty', () => {
    const out = eventJsonLd('abc', publicEvent(), BASE)!;
    expect(out.offers).toBeUndefined();
    expect(out.isAccessibleForFree).toBeUndefined();
  });

  it('bierze nazwę boiska, a w jej braku lokalizację własną', () => {
    const withField = eventJsonLd('a', publicEvent({ field_name: 'Orlik Rataje' }), BASE)!;
    expect(withField.location).toMatchObject({ name: 'Orlik Rataje' });

    const withCustom = eventJsonLd(
      'a',
      publicEvent({ custom_location_name: 'Boisko za blokiem', custom_address: 'ul. Kwiatowa 3' }),
      BASE,
    )!;
    expect(withCustom.location).toMatchObject({
      name: 'Boisko za blokiem',
      address: { streetAddress: 'ul. Kwiatowa 3' },
    });
    // Sam adres bez przecinka nie niesie miejscowości — i lepiej jej wtedy
    // NIE podawać, niż zgadywać. Wcześniej wstawiany był tu na sztywno Poznań,
    // co przy meczu pod Lublinem trafiało do wyszukiwarek jako fakt.
    expect(withCustom.location as { address?: Record<string, unknown> })
      .not.toHaveProperty('address.addressLocality');

    const zMiastem = eventJsonLd(
      'a',
      publicEvent({ custom_location_name: 'Orlik', custom_address: 'ul. Kwiatowa 3, Świdnik' }),
      BASE,
    )!;
    expect(zMiastem.location).toMatchObject({
      address: { addressLocality: 'Świdnik' },
    });
  });

  it('bez miejsca nie emituje location', () => {
    expect(eventJsonLd('a', publicEvent(), BASE)!.location).toBeUndefined();
  });

  it('dodaje geo do location, gdy zna współrzędne', () => {
    const out = eventJsonLd(
      'a',
      publicEvent({ field_name: 'Orlik Rataje', lat: 52.4064, lng: 16.9252 }),
      BASE,
    )!;
    expect(out.location).toMatchObject({
      geo: { '@type': 'GeoCoordinates', latitude: 52.4064, longitude: 16.9252 },
    });
  });

  it('bez współrzędnych nie emituje geo', () => {
    const out = eventJsonLd('a', publicEvent({ field_name: 'Orlik Rataje' }), BASE)!;
    expect(out.location as { geo?: unknown }).not.toHaveProperty('geo');
  });
});

describe('siteJsonLd', () => {
  it('wiąże WebSite z Organization przez @id', () => {
    const graph = siteJsonLd(BASE)['@graph'] as Record<string, unknown>[];
    const org = graph.find((n) => n['@type'] === 'Organization')!;
    const site = graph.find((n) => n['@type'] === 'WebSite')!;
    expect(site.publisher).toEqual({ '@id': org['@id'] });
  });
});

describe('breadcrumbsJsonLd', () => {
  it('numeruje pozycje od 1 i buduje absolutne adresy', () => {
    const out = breadcrumbsJsonLd([
      { name: 'Strona główna', path: '/' },
      { name: 'Boiska: Piłka nożna', path: '/boiska/pilka-nozna' },
      { name: 'Orlik Rataje' },
    ], BASE);
    expect(out['@type']).toBe('BreadcrumbList');
    expect(out.itemListElement[0]).toMatchObject({ position: 1, item: `${BASE}/` });
    expect(out.itemListElement[1]).toMatchObject({ position: 2, item: `${BASE}/boiska/pilka-nozna` });
  });

  it('ostatni element (bieżąca strona) nie ma item — zgodnie ze spec Google', () => {
    const out = breadcrumbsJsonLd([{ name: 'A', path: '/' }, { name: 'Bieżąca' }], BASE);
    const last = out.itemListElement[1] as Record<string, unknown>;
    expect(last.name).toBe('Bieżąca');
    expect(last.item).toBeUndefined();
  });

  it('pusta lista nie wywraca budowania', () => {
    expect(breadcrumbsJsonLd([], BASE).itemListElement).toEqual([]);
  });
});

describe('venueListJsonLd', () => {
  it('numeruje pozycje od 1 i buduje pełne adresy', () => {
    const out = venueListJsonLd('Boiska', [
      { name: 'Orlik A', slug: 'orlik-a' },
      { name: 'Orlik B', slug: 'orlik-b' },
    ], BASE);
    expect(out.numberOfItems).toBe(2);
    expect(out.itemListElement[0]).toMatchObject({ position: 1, url: `${BASE}/boisko/orlik-a` });
    expect(out.itemListElement[1]).toMatchObject({ position: 2, url: `${BASE}/boisko/orlik-b` });
  });

  it('pusta lista nie wywraca budowania', () => {
    const out = venueListJsonLd('Boiska', [], BASE);
    expect(out.numberOfItems).toBe(0);
    expect(out.itemListElement).toEqual([]);
  });
});
