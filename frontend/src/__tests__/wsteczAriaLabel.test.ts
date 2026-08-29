import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Znalezione przez pomiar Core Web Vitals (docs/seo-geo-strategia.md, 7a.1):
// PageSpeed Insights, kategoria "Przeglądanie agentowe", audyt "Links must have
// discernible text" na przycisku "wstecz" strony obiektu — link owinięty
// wyłącznie wokół ikony <ArrowLeft>, bez tekstu dostępnego dla czytnika ekranu
// ani agenta AI. Ten sam wzorzec powtarzał się w dziewięciu miejscach, podczas
// gdy trzy inne (WybierzGrupeDialog.tsx, GroupDetailClient.tsx,
// EventDetailClient.tsx) już miały `aria-label="Wróć"`.
//
// Test czyta ŹRÓDŁO jako tekst (wzorem `ogImageJednoZrodlo.test.ts`), bo te
// strony renderują dane po stronie serwera i Vitest w tym repo nie
// transformuje JSX (`tsconfig.json` ma `jsx: "preserve"`).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const PLIKI_Z_PRZYCISKIEM_WSTECZ = [
  'src/app/boisko/[id]/VenueDetailClient.tsx',
  'src/app/admin/boisko/[id]/page.tsx',
  'src/app/wydarzenia/[id]/edytuj/page.tsx',
  'src/app/admin/[fieldId]/page.tsx',
  'src/app/obiekt/nowe/page.tsx',
  'src/app/obiekt/[id]/rezerwacje/page.tsx',
  'src/app/obiekt/[id]/harmonogram/page.tsx',
  'src/app/obiekt/[id]/page.tsx',
  'src/app/obiekt/[id]/cennik/page.tsx',
];

describe('przycisk "wstecz" (samo <ArrowLeft>) ma aria-label', () => {
  for (const plik of PLIKI_Z_PRZYCISKIEM_WSTECZ) {
    it(`${plik}`, () => {
      const zrodlo = readFileSync(join(ROOT, plik), 'utf8');
      expect(zrodlo).toContain('<ArrowLeft');
      expect(zrodlo).toContain('aria-label="Wróć"');
    });
  }
});
