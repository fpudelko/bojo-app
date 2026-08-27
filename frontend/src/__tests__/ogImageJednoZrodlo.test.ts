import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// D17 (docs/seo-geo-strategia.md, rozdział 0): layout.tsx ustawiał statyczny
// obrazek w `openGraph.images`/`twitter.images`, ale konwencja plikowa
// `app/opengraph-image.tsx` ma pierwszeństwo na tym samym segmencie — obrazek
// z layout.tsx nigdy nie trafiał do żadnej strony. Test czyta ŹRÓDŁO jako
// tekst (wzorem `ikonyPwa.test.ts`, `tresciStron.test.ts`), nie importuje
// pliku — `layout.tsx` renderuje JSX, którego Vitest w tym repo nie
// transformuje (`tsconfig.json` ma `jsx: "preserve"`, wymagane przez Next.js).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const layout = readFileSync(join(ROOT, 'src/app/layout.tsx'), 'utf8');

describe('jedno źródło obrazka OG', () => {
  it('layout.tsx nie ustawia martwego statycznego obrazka OG', () => {
    expect(layout).not.toMatch(/poznan-satellite/);
    expect(layout).not.toMatch(/openGraph:\s*{[^}]*images:/);
    expect(layout).not.toMatch(/twitter:\s*{[^}]*images:/);
  });

  it('jedyny generator obrazka OG (konwencja plikowa) istnieje', () => {
    expect(existsSync(join(ROOT, 'src/app/opengraph-image.tsx'))).toBe(true);
  });

  it('usunięty plik statyczny nie wrócił po cichu', () => {
    expect(existsSync(join(ROOT, 'public/poznan-satellite.jpg'))).toBe(false);
  });
});
