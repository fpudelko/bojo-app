'use client';

import { useEffect } from 'react';
import { zglosAwarie } from '@/lib/bledy';

/**
 * Globalne pułapki na awarie.
 *
 * Łapią dwie rzeczy, których nie widzi żaden `try/catch` w kodzie aplikacji
 * ani `app/error.tsx`:
 *
 *  - `error` — wyjątek, który doleciał do okna (np. z handlera zdarzenia
 *    albo z `setTimeout`, gdzie granica błędu Reacta nie sięga),
 *  - `unhandledrejection` — odrzucona obietnica, której nikt nie złapał.
 *    To jest najczęstszy sposób, w jaki psuje się aplikacja rozmawiająca
 *    z bazą: `await` bez `catch`, zapytanie pada, ekran zostaje pusty.
 *
 * Bez tego oba kończyły się wpisem w konsoli przeglądarki, której nikt nie
 * ogląda. Filtrowanie, grupowanie i limity siedzą w `lib/bledy.ts`.
 */
export default function PrzechwytywanieBledow() {
  useEffect(() => {
    const naBlad = (zdarzenie: ErrorEvent) => {
      // Błędy z cudzych skryptów (wtyczki przeglądarki, blokery) przychodzą
      // bez treści i bez stosu — nie ma z nich żadnego pożytku, a zaśmiecają
      // panel.
      if (!zdarzenie.error && zdarzenie.message === 'Script error.') return;
      zglosAwarie(zdarzenie.error ?? zdarzenie.message);
    };

    const naOdrzucenie = (zdarzenie: PromiseRejectionEvent) => {
      zglosAwarie(zdarzenie.reason, 'nieobsłużona obietnica');
    };

    window.addEventListener('error', naBlad);
    window.addEventListener('unhandledrejection', naOdrzucenie);
    return () => {
      window.removeEventListener('error', naBlad);
      window.removeEventListener('unhandledrejection', naOdrzucenie);
    };
  }, []);

  return null;
}
