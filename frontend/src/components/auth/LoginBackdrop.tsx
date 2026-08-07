'use client';

import { useEffect, useRef } from 'react';
import EventsListView from '@/app/wydarzenia/EventsListView';

/**
 * Tło ekranu logowania: prawdziwa lista publicznych meczów.
 *
 * Zamiast pustego płótna pokazujemy to, co użytkownik dostanie po zalogowaniu.
 * To dekoracja, nie interfejs — musi być całkowicie bierna:
 *
 * - `pointer-events-none` odcina klikanie,
 * - `overflow-hidden` nie pozwala jej się przewijać,
 * - `aria-hidden` chowa ją przed czytnikiem ekranu,
 * - `inert` wyjmuje ją z kolejności Tab.
 *
 * Samo `aria-hidden` nad kontenerem pełnym odnośników byłoby błędem
 * dostępności: czytnik ich nie widzi, ale Tab dalej w nie wchodzi. React 18
 * nie zna propa `inert` (doszedł w 19), więc ustawiamy atrybut przez ref.
 */
export default function LoginBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.setAttribute('inert', '');
  }, []);

  return (
    // `top-16` = wysokość paska dla wylogowanego (h-16). Bez tego nagłówek
    // listy chowa się pod paskiem i tło zaczyna się od połowy pola szukania.
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 top-16 overflow-hidden"
    >
      <EventsListView />
    </div>
  );
}
