import { useRef } from 'react';

/** Wykrywa poziomy swipe (touchstart→touchend). Woła `onLeft`/`onRight`
 *  dopiero gdy przesunięcie przekracza próg i jest wyraźnie bardziej poziome
 *  niż pionowe — inaczej kolidowałoby z pionowym przewijaniem strony. */
export function useSwipe(onLeft: () => void, onRight: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      start.current = null;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) onLeft(); else onRight();
    },
  };
}
