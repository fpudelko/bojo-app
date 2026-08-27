import { describe, it, expect } from 'vitest';
import robots from '@/app/robots';

// Kontrakt na to, co wolno skanować. Bez tego pliku dodanie trasy za flagą albo
// kolejnego kreatora cicho wpuszcza go do wyszukiwarek — dokładnie tak wjechały
// tam /auth/, /turniej, /cykliczne, /obiekt i profile graczy.

const WYKLUCZONE = [
  '/admin', '/api', '/profil', '/moje-gry', '/d/', '/g/',
  '/auth/', '/logowanie', '/zglos-blad',
  '/wydarzenia/nowe', '/wydarzenia/*/edytuj', '/grupy/nowe', '/grupy/*/edytuj',
  '/turniej', '/cykliczne', '/obiekt', '/rezerwacje', '/gracz/',
];

/** Trasy publiczne, które MUSZĄ zostać skanowalne — regresja w drugą stronę. */
const DOZWOLONE = ['/wydarzenia', '/boisko', '/boiska', '/mapa', '/grupy', '/faq', '/jak-dziala-bojo', '/dlaczego-bojo'];

describe('robots.txt', () => {
  const reguly = robots().rules as { userAgent: string; disallow?: string[] }[];

  it('ma regułę dla wszystkich botów i osobne dla crawlerów AI', () => {
    expect(reguly.map((r) => r.userAgent)).toContain('*');
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot']) {
      expect(reguly.map((r) => r.userAgent)).toContain(bot);
    }
  });

  it('każdy bot dostaje tę samą listę wykluczeń', () => {
    for (const r of reguly) {
      expect(r.disallow).toEqual(WYKLUCZONE);
    }
  });

  it('nie blokuje tras, na których stoi cała widoczność', () => {
    for (const r of reguly) {
      for (const trasa of DOZWOLONE) {
        expect(r.disallow).not.toContain(trasa);
      }
    }
  });

  it('wskazuje indeks sitemap, nie pojedynczy plik', () => {
    expect(robots().sitemap).toMatch(/sitemap-index\.xml$/);
  });
});
