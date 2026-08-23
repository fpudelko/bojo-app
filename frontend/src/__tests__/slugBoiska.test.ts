import { describe, it, expect } from 'vitest';
import { slugBoiska, slugify } from '@/lib/utils';

// Katalog boisk pochodzi z OpenStreetMap, a obiekt bez nazwy własnej dostaje
// przy imporcie nazwę RODZAJOWĄ (`SPORT_NOUN` w scraper/import_osm_pbf.py).
// Takich jest w katalogu większość, więc adres zbudowany z samej nazwy nie
// wskazuje obiektu — wskazuje kategorię.
describe('adres strony boiska', () => {
  const a = '11111111-2222-4333-8444-555555555555';
  const b = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  it('dwa boiska o tej samej nazwie mają RÓŻNE adresy', () => {
    // To jest cały powód istnienia tej funkcji. Zgłoszone wprost: kafelek na
    // mapie pokazywał boisko na Piotrowie, a „Zobacz boisko" otwierało
    // boisko na Mokotowie — bo oba nazywają się „Boisko piłkarskie".
    expect(slugBoiska('Boisko piłkarskie', a)).not.toBe(slugBoiska('Boisko piłkarskie', b));
  });

  it('zaczyna się od czytelnej nazwy', () => {
    expect(slugBoiska('Boisko piłkarskie', a)).toMatch(/^boisko-pilkarskie-/);
  });

  it('ten sam obiekt daje zawsze ten sam adres', () => {
    expect(slugBoiska('Orlik Winogrady', a)).toBe(slugBoiska('Orlik Winogrady', a));
  });

  it('końcówka ma 12 znaków — przy dziesiątkach tysięcy obiektów 8 to za mało', () => {
    // 8 znaków (32 bity) przy 50 tys. obiektów daje ok. 25% szans na kolizję,
    // czyli „prawie na pewno jedno boisko będzie prowadzić do cudzego".
    const koncowka = slugBoiska('Boisko piłkarskie', a).replace('boisko-pilkarskie-', '');
    expect(koncowka).toHaveLength(12);
    expect(koncowka).toMatch(/^[0-9a-f]{12}$/);
  });

  it('obiekt bez nazwy nadającej się na slug zostaje przy samej końcówce', () => {
    // `slugify('///')` daje pusty łańcuch — adres nie może zaczynać się myślnikiem.
    expect(slugify('///')).toBe('');
    expect(slugBoiska('///', a)).toBe('111111112222');
  });
});
