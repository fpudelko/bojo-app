'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { track } from '@/lib/analytics';

/**
 * Kopiowanie gotowego tekstu do schowka, z potwierdzeniem w samym przycisku.
 *
 * Świadomie BEZ toasta: ten komponent renderuje się na stronach treści
 * (`/dlaczego-bojo`), które nie mają nad sobą `ToastProvider` w każdym
 * przypadku — a zmiana etykiety w miejscu dotknięcia jest i tak czytelniejsza,
 * bo dzieje się dokładnie tam, gdzie spojrzenie już jest.
 */
export default function PrzyciskKopiuj({ tekst, wariant }: { tekst: string; wariant: string }) {
  const [stan, setStan] = useState<'gotowy' | 'skopiowano' | 'blad'>('gotowy');

  const kopiuj = async () => {
    try {
      await navigator.clipboard.writeText(tekst);
      setStan('skopiowano');
      track('argument_skopiowany', { wariant });
      setTimeout(() => setStan('gotowy'), 2000);
    } catch {
      setStan('blad');
    }
  };

  return (
    <button
      type="button"
      onClick={kopiuj}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {stan === 'skopiowano' ? (
        <><Check className="h-3.5 w-3.5" aria-hidden="true" /> Skopiowane</>
      ) : stan === 'blad' ? (
        'Nie udało się, zaznacz i skopiuj'
      ) : (
        <><Copy className="h-3.5 w-3.5" aria-hidden="true" /> Kopiuj</>
      )}
    </button>
  );
}
