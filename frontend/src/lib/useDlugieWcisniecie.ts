import { useRef } from 'react';

const CZAS_MS = 500;
const TOLERANCJA_PX = 10;   // drgnięcie palca to wciąż przytrzymanie

/** Wykrywa przytrzymanie dotykiem (touchstart trwający ≥`CZAS_MS` bez
 *  przesunięcia palca ponad `TOLERANCJA_PX`). Zwykłe tapnięcie i przeciąganie
 *  (np. swipe) mają zostać nietknięte — stąd anulowanie na `onTouchMove` przy
 *  najmniejszym ruchu i połknięcie klika, który przeglądarka i tak wyśle po
 *  długim dotyku, WYŁĄCZNIE gdy gest naprawdę zadziałał. */
export function useDlugieWcisniecie(akcja: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const zadzialalo = useRef(false);

  const przerwij = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      zadzialalo.current = false;
      timer.current = setTimeout(() => {
        zadzialalo.current = true;
        // Opcjonalne — bez wibracji (np. iOS) gest po prostu nie potwierdza
        // się dotykiem, ale nadal działa.
        navigator.vibrate?.(10);
        akcja();
      }, CZAS_MS);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (!start.current) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - start.current.x) > TOLERANCJA_PX
        || Math.abs(t.clientY - start.current.y) > TOLERANCJA_PX) przerwij();
    },
    onTouchEnd: przerwij,
    onTouchCancel: przerwij,
    // Przytrzymanie na <a> otwiera systemowe menu „Otwórz w nowej karcie" —
    // zasłoniłoby panel, który właśnie się pokazał.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    // Po przytrzymaniu przeglądarka i tak wyśle klik. Bez tego panel otwiera
    // się i natychmiast ginie pod nawigacją, do której prowadzi link.
    onClickCapture: (e: React.MouseEvent) => {
      if (!zadzialalo.current) return;
      zadzialalo.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
