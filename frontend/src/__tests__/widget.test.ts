import { describe, it, expect } from 'vitest';
import { jestSciezkaWidgetu, kodOsadzeniaWidgetu } from '@/lib/widget';

// F5 SEO/GEO (roadmapa poz. 24) — widget osadzalny dla zarządców obiektów.
// `jestSciezkaWidgetu` jest wydzielona z `useJestWidget()` (który woła
// `usePathname()`) właśnie po to, żeby test nie musiał mockować
// `next/navigation` dla samej logiki prefiksu.

describe('jestSciezkaWidgetu', () => {
  it('rozpoznaje trasę widgetu', () => {
    expect(jestSciezkaWidgetu('/widget/boisko/abc-123')).toBe(true);
  });

  it('nie łapie zwykłej strony obiektu', () => {
    expect(jestSciezkaWidgetu('/boisko/abc-123')).toBe(false);
  });

  it('nie łapie ścieżki zawierającej "widget" gdzie indziej niż na początku', () => {
    expect(jestSciezkaWidgetu('/boisko/moj-widget-obiekt')).toBe(false);
  });

  it('null (brak ścieżki) nie jest widgetem', () => {
    expect(jestSciezkaWidgetu(null)).toBe(false);
  });
});

describe('kodOsadzeniaWidgetu', () => {
  it('generuje iframe z poprawnym adresem obiektu', () => {
    const kod = kodOsadzeniaWidgetu('abc-123', 'https://bojo.pl');
    expect(kod).toContain('<iframe');
    expect(kod).toContain('src="https://bojo.pl/widget/boisko/abc-123"');
    expect(kod).toContain('</iframe>');
  });

  it('ma stałą wysokość, nie zależną od liczby meczów', () => {
    const kod = kodOsadzeniaWidgetu('abc-123', 'https://bojo.pl');
    expect(kod).toContain('height="420"');
  });
});
