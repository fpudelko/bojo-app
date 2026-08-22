import { describe, it, expect } from 'vitest';
import { MIASTA, PROMIEN_KM, znajdzMiasto } from '@/content/miasta';
import { FOCUS_SPORT_BY_SLUG } from '@/lib/sports';

// Każde miasto dokłada tyle stron, ile jest sportów, i każda z nich obiecuje
// wyszukiwarce nazwę miejscowości w tytule. Błąd w odmianie albo we
// współrzędnych nie wywala buildu — po prostu wystawia stronę, która kłamie.
describe('content/miasta', () => {
  it('slug jest kebab-case, bez ogonków i bez duplikatów', () => {
    const slugi = MIASTA.map((m) => m.slug);
    expect(new Set(slugi).size).toBe(slugi.length);
    for (const slug of slugi) expect(slug).toMatch(/^[a-z][a-z-]*$/);
  });

  it('miejscownik niesie przyimek, bo "we Wrocławiu" łamie regułę "w " + forma', () => {
    for (const m of MIASTA) {
      expect(m.miejscownik, m.slug).toMatch(/^we? /);
      expect(m.mianownik.length, m.slug).toBeGreaterThan(2);
    }
  });

  it('współrzędne mieszczą się w granicach Polski', () => {
    for (const m of MIASTA) {
      expect(m.lat, m.slug).toBeGreaterThan(49);
      expect(m.lat, m.slug).toBeLessThan(55);
      expect(m.lng, m.slug).toBeGreaterThan(14);
      expect(m.lng, m.slug).toBeLessThan(24.2);
    }
  });

  it('znajdzMiasto zwraca undefined dla nieznanego slugu', () => {
    expect(znajdzMiasto('poznan')?.mianownik).toBe('Poznań');
    expect(znajdzMiasto('gotham')).toBeUndefined();
  });

  it('iloczyn sportów i miast daje tyle stron, ile wystawia sitemap', () => {
    const kombinacje = Object.keys(FOCUS_SPORT_BY_SLUG).length * MIASTA.length;
    expect(kombinacje).toBe(12);
  });

  it('promień jest jeden dla wszystkich miast', () => {
    expect(PROMIEN_KM).toBe(15);
  });
});
