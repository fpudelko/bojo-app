'use client';

import { useEffect } from 'react';
import { useJestWidget } from '@/lib/widget';

/**
 * Rejestruje service workera (`public/sw.js`).
 *
 * Po co osobny komponent zamiast wywołania w layoucie: layout jest serwerowy,
 * a `navigator.serviceWorker` istnieje wyłącznie w przeglądarce.
 *
 * Rejestracja po `load`, nie od razu: worker konkurowałby o pasmo z pierwszym
 * renderem strony, a nie jest do niczego potrzebny w tej sekundzie.
 *
 * Sam worker nic nie cache'uje (patrz komentarz w `public/sw.js`) — jest tu
 * po to, żeby przeglądarka uznała Bojo za instalowalne i żeby miał co odebrać
 * powiadomienia push, gdy te dojdą.
 */
export default function RejestracjaSW() {
  const jestWidget = useJestWidget();

  useEffect(() => {
    if (jestWidget) return;
    if (!('serviceWorker' in navigator)) return;

    const zarejestruj = () => {
      navigator.serviceWorker.register('/sw.js').catch((blad) => {
        // Świadomie tylko log: brak workera oznacza brak instalacji i pusha,
        // ale cała reszta aplikacji działa normalnie. Nie ma czym straszyć
        // użytkownika.
        console.error('[sw] rejestracja nie powiodła się:', blad);
      });
    };

    if (document.readyState === 'complete') zarejestruj();
    else {
      window.addEventListener('load', zarejestruj);
      return () => window.removeEventListener('load', zarejestruj);
    }
  }, [jestWidget]);

  return null;
}
