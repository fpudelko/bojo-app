// The structured-data checker must flag exactly what Search Console flagged
// on 2026-09-23, and must not cry wolf over things Google accepts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sprawdzStrone, sprawdzWezel, wyciagnijBloki } from '../sprawdz-jsonld.mjs';
import { wagaPola, regulyDla } from '../reguly-google.mjs';

// eventJsonLd() output as it was BEFORE PR #424: the five fields from the e-mail are missing.
const STARY_MECZ = {
  '@context': 'https://schema.org', '@type': 'SportsEvent', name: 'Piłka nożna 7v7',
  url: 'https://bojo.pl/wydarzenia/f1e98fe0', startDate: '2027-01-07T18:00:00', endDate: '2027-01-07T19:30:00',
  eventStatus: 'https://schema.org/EventScheduled',
  location: { '@type': 'Place', name: 'Orlik', address: { '@type': 'PostalAddress', addressCountry: 'PL' } },
  offers: { '@type': 'Offer', price: '0.00', priceCurrency: 'PLN', url: 'https://bojo.pl/wydarzenia/f1e98fe0' },
  organizer: { '@id': 'https://bojo.pl/#organization' },
};

test('odtwarza pięć ostrzeżeń z maila Search Console z 2026-09-23', () => {
  const w = sprawdzWezel(STARY_MECZ);
  assert.equal(w.krytyczne.length, 0);
  const brakujace = w.ostrzezenia.map((o) => o.match(/„(.+)”/)?.[1]).sort();
  assert.deepEqual(brakujace, ['description', 'image', 'offers.availability', 'offers.validFrom', 'performer']);
});

test('po poprawce (PR #424) mecz jest czysty', () => {
  const nowy = {
    ...STARY_MECZ, description: 'Amatorski mecz', image: ['https://bojo.pl/wydarzenia/f1e98fe0/opengraph-image'],
    performer: { '@type': 'PerformingGroup', name: 'Skład meczu: Piłka nożna 7v7' },
    offers: { ...STARY_MECZ.offers, availability: 'https://schema.org/InStock', validFrom: '2026-09-04T08:18:47+00:00' },
  };
  const html = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Organization', '@id': 'https://bojo.pl/#organization', name: 'Bojo', url: 'https://bojo.pl' }] })}</script>
<script type="application/ld+json">${JSON.stringify(nowy)}</script>`;
  const mecz = sprawdzStrone(html).find((x) => x.reguly === 'Event');
  assert.deepEqual(mecz.krytyczne, []);
  assert.deepEqual(mecz.ostrzezenia, [], 'organizer.name rozwiązany przez @id z bloku layoutu');
});

test('błędy krytyczne: brak location, zła data', () => {
  const w = sprawdzWezel({ '@type': 'SportsEvent', name: 'X', startDate: '07.01.2027' });
  assert.ok(w.krytyczne.some((k) => k.includes('location')));
  assert.ok(w.krytyczne.some((k) => k.includes('startDate')));
});

test('Google przyjmuje krótką formę wyliczeń („InStock”)', () => {
  const w = sprawdzWezel({ ...STARY_MECZ, offers: { ...STARY_MECZ.offers, availability: 'InStock' }, eventStatus: 'http://schema.org/EventScheduled' });
  assert.ok(!w.ostrzezenia.some((o) => o.includes('spoza dozwolonych')));
});

test('okruszki: numeracja od 1, item wymagany poza ostatnim', () => {
  const zly = sprawdzWezel({ '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'A' },
    { '@type': 'ListItem', position: 3, name: 'B' },
  ] });
  assert.ok(zly.krytyczne.some((k) => k.includes('brak item')));
  assert.ok(zly.krytyczne.some((k) => k.includes('oczekiwano 2')));
  const dobry = sprawdzWezel({ '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Strona główna', item: 'https://bojo.pl/' },
    { '@type': 'ListItem', position: 2, name: 'Orlik' },
  ] });
  assert.deepEqual(dobry.krytyczne, []);
});

test('FAQ i HowTo: Google ich nie ocenia, więc nic nie świeci na czerwono', () => {
  const w = sprawdzWezel({ '@type': 'FAQPage' });
  assert.deepEqual(w.krytyczne, []);
  assert.ok(w.uwagi.some((u) => u.includes('Google tego nie ocenia')));
});

test('podtypy i waga pól', () => {
  assert.equal(regulyDla('SportsEvent').nazwa, 'Event');
  assert.equal(regulyDla('SportsActivityLocation').nazwa, 'LocalBusiness');
  assert.equal(wagaPola('Event', 'offers.availability'), 'zalecane');
  assert.equal(wagaPola('Event', 'location'), 'wymagane');
});

test('zepsuty JSON w bloku to błąd krytyczny, nie wyjątek', () => {
  const [b] = wyciagnijBloki('<script type="application/ld+json">{ "a": </script>');
  assert.match(b.blad, /nieprawidłowy JSON/);
});
