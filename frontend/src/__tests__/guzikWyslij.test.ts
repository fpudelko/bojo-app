import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { bezZabieraniaSkupienia } from '@/lib/czat';

// Guzik „Wyślij" NIE MOŻE zabierać skupienia polu tekstowemu.
//
// SKĄD TEN PLIK. Dotknięcie zwykłego `<button>` blurowało pole: klawiatura się
// chowała, ekran czatu natychmiast rósł do pełnej wysokości i guzik uciekał
// spod palca, ZANIM zdążył dojść `click`. Z zewnątrz wyglądało to tak, że
// pierwsze dotknięcie tylko chowa klawiaturę, a wysłać da się dopiero za
// drugim razem (zgłoszone wprost). Objawu nie widzi żadna bramka w repo —
// Playwright nie ma klawiatury ekranowej, więc nie ma też przestawienia
// layoutu, które psuje trafienie.
const COMPOSERY = [
  'components/groups/RozmowaGrupy.tsx',
  'components/events/RozmowaWydarzenia.tsx',
  'app/rozmowy/[id]/DmRozmowaClient.tsx',
];

describe('bezZabieraniaSkupienia', () => {
  it('blokuje domyślną akcję mousedown, czyli przeniesienie skupienia', () => {
    let zablokowane = false;
    bezZabieraniaSkupienia.onMouseDown({ preventDefault: () => { zablokowane = true; } });
    expect(zablokowane).toBe(true);
  });
});

describe('guziki wysyłania w rozmowach', () => {
  it.each(COMPOSERY)('%s używa bezZabieraniaSkupienia', (plik) => {
    const zrodlo = readFileSync(path.join(process.cwd(), 'src', plik), 'utf8');
    expect(zrodlo).toMatch(/\{\.\.\.bezZabieraniaSkupienia\}/);
  });
});
