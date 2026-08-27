import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIASTA } from '@/content/miasta';
import { FOCUS_SPORT_BY_SLUG } from '@/lib/sports';

// D8 (docs/seo-geo-strategia.md, rozdział 0): hub sportu linkował do landingu
// `/[sport]/[miasto]` zawsze na Poznań, więc osiem z dwunastu tych stron nie
// miało ani jednego wejścia z serwisu. Tego nie widać w żadnym innym narzędziu
// w repo — strona renderuje się poprawnie, po prostu prowadzi w jedno miejsce.
//
// Test czyta ŹRÓDŁO jako tekst (wzorem `ogImageJednoZrodlo.test.ts` i
// `ikonyPwa.test.ts`): `page.tsx` to asynchroniczny komponent serwerowy
// z zapytaniami do Supabase, a Vitest w tym repo nie transformuje JSX
// (`tsconfig.json` ma `jsx: "preserve"`, wymagane przez Next.js).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const hubSportu = readFileSync(join(ROOT, 'src/app/boiska/[sport]/page.tsx'), 'utf8');
const landing = readFileSync(join(ROOT, 'src/app/[sport]/[miasto]/page.tsx'), 'utf8');

describe('hub sportu → landingi sport+miasto', () => {
  it('nie zaszywa żadnego miasta na sztywno w adresie landingu', () => {
    for (const m of MIASTA) {
      expect(hubSportu).not.toContain(`/\${params.sport}/${m.slug}`);
    }
  });

  it('buduje listę miast z MIASTA, więc nowe miasto dostaje wejście samo', () => {
    expect(hubSportu).toContain("from '@/content/miasta'");
    expect(hubSportu).toMatch(/MIASTA\.map/);
  });

  // Druga strona tej samej umowy: link ma prowadzić do strony, która ISTNIEJE.
  // Landing ma `dynamicParams = false`, więc zbiór stron to dokładnie
  // generateStaticParams() — MIASTA × sporty wiodące. Gdyby tamta trasa zaczęła
  // budować strony z innego źródła, linkowanie z hubu wskazywałoby 404.
  it('landing generuje strony dokładnie dla MIASTA i sportów wiodących', () => {
    expect(landing).toMatch(/dynamicParams\s*=\s*false/);
    expect(landing).toMatch(/Object\.keys\(FOCUS_SPORT_BY_SLUG\)/);
    expect(landing).toMatch(/MIASTA\.map/);
    // Sanity: obie stałe są niepuste, więc test wyżej nie przechodzi „na sucho".
    expect(MIASTA.length).toBeGreaterThan(0);
    expect(Object.keys(FOCUS_SPORT_BY_SLUG).length).toBeGreaterThan(0);
  });
});
