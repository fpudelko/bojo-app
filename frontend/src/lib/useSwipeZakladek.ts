import { useRef } from 'react';

const PROG_PX = 60;        // wyżej niż 50 w `useSwipe`: tu pomyłka kosztuje zmianę ekranu
const MAKS_MS = 800;       // powolne przeciąganie to nie gest, tylko przewijanie
const DOMINACJA = 1.6;     // ile razy bardziej poziomo niż pionowo

/** Zakładka, na którą przechodzi ten gest — albo `null`. Czysta funkcja: cała
 *  reguła gestu daje się przetestować bez DOM-u. Bez zawijania: swipe w prawo
 *  na pierwszej i w lewo na ostatniej nie robi nic. */
export function nastepnaZakladka<T>(
  zakladki: readonly T[],
  aktywna: T,
  dx: number,
  dy: number,
  czasMs: number,
): T | null {
  if (czasMs > MAKS_MS) return null;
  if (Math.abs(dx) < PROG_PX || Math.abs(dx) < DOMINACJA * Math.abs(dy)) return null;
  const i = zakladki.indexOf(aktywna);
  if (i === -1) return null;
  const nastepny = dx < 0 ? i + 1 : i - 1;    // palec w lewo = następna zakładka
  if (nastepny < 0 || nastepny >= zakladki.length) return null;
  return zakladki[nastepny];
}

/** Czy gest zaczął się w strefie, która ma obsłużyć go sama. `[data-bez-swipe]`
 *  wyklucza jawnie oznaczone strefy (własny swipe, drag&drop, pole tekstowe);
 *  element przewijany w poziomie (pasek zakładek, karuzela) wyklucza się sam —
 *  przełączanie zakładek zabrałoby mu przewijanie. */
function wStrefieBezSwipe(cel: EventTarget | null): boolean {
  if (!(cel instanceof Element)) return false;
  if (cel.closest('[data-bez-swipe]')) return true;
  for (let el: Element | null = cel; el; el = el.parentElement) {
    if (el.scrollWidth - el.clientWidth > 4
      && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}

/** Swipe poziomy przełącza zakładki — tylko dotyk, bez zawijania na krańcach.
 *  Mysz na desktopie bez zmian: przeciąganie kolidowałoby z zaznaczaniem
 *  tekstu i z `@dnd-kit` w podziale na drużyny. */
export function useSwipeZakladek<T>(
  zakladki: readonly T[],
  aktywna: T,
  idz: (t: T) => void,
) {
  const start = useRef<{ x: number; y: number; czas: number } | null>(null);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length !== 1 || wStrefieBezSwipe(e.target)) { start.current = null; return; }
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY, czas: Date.now() };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      const czasMs = Date.now() - start.current.czas;
      start.current = null;
      const cel = nastepnaZakladka(zakladki, aktywna, dx, dy, czasMs);
      if (cel !== null) idz(cel);
    },
  };
}
