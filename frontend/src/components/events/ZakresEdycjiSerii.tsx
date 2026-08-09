'use client';

import { useState } from 'react';
import { Repeat, X } from 'lucide-react';
import { ETYKIETY_ZAKRESU, type ZakresEdycji } from '@/lib/series';

/**
 * „Której daty dotyczy ta zmiana?" — pytanie zadawane przy zapisie edycji meczu
 * należącego do stałej gierki (serii).
 *
 * Pokazywany WYŁĄCZNIE gdy seria ma więcej niż jeden termin — przy jednym
 * terminie wszystkie trzy odpowiedzi znaczą to samo, więc pytanie byłoby
 * kliknięciem bez treści.
 *
 * Układ jak `WybierzGrupeDialog`: bottom sheet od najmniejszych ekranów,
 * wyśrodkowana karta od `sm:`.
 */
export default function ZakresEdycjiSerii({
  liczbaTerminow,
  liczbaPrzyszlych,
  onWybierz,
  onClose,
  busy = false,
}: {
  /** Ile terminów liczy cała seria — pokazywane przy „Cała seria". */
  liczbaTerminow: number;
  /** Ile terminów obejmie „To i przyszłe" (łącznie z edytowanym). */
  liczbaPrzyszlych: number;
  onWybierz: (zakres: ZakresEdycji) => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const [wybrany, setWybrany] = useState<ZakresEdycji>('ten');

  // Liczba obok etykiety odpowiada na „ile meczów tym ruszę?" — bez niej
  // „cała seria" to skok w ciemno, zwłaszcza przy gierce trwającej od miesięcy.
  const licznik: Record<ZakresEdycji, number> = {
    'ten': 1,
    'ten-i-przyszle': liczbaPrzyszlych,
    'cala-seria': liczbaTerminow,
  };

  const opcje: ZakresEdycji[] = ['ten', 'ten-i-przyszle', 'cala-seria'];

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4 sm:pb-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Repeat className="h-4 w-4 text-slate-400" />
          <h2 className="font-semibold text-ink">To mecz stałej gierki</h2>
          <button
            onClick={onClose}
            className="ml-auto text-slate-400 hover:text-slate-600"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-3 text-sm text-slate-500">Których terminów dotyczy ta zmiana?</p>

          <div className="space-y-2">
            {opcje.map((opcja) => {
              const aktywna = wybrany === opcja;
              return (
                <button
                  key={opcja}
                  type="button"
                  onClick={() => setWybrany(opcja)}
                  className={[
                    'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                    aktywna
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-slate-200 hover:border-slate-300',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      aktywna ? 'border-primary-600' : 'border-slate-300',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {aktywna && <span className="h-2 w-2 rounded-full bg-primary-600" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-ink">
                        {ETYKIETY_ZAKRESU[opcja].tytul}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400 tabular-nums">
                        {licznik[opcja] === 1 ? '1 mecz' : `${licznik[opcja]} meczów`}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {ETYKIETY_ZAKRESU[opcja].opis}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bez tego zdania „to i przyszłe" wygląda, jakby przestawiało datę
              wszystkich meczów na jeden dzień. */}
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Data tego meczu zmienia się zawsze tylko tutaj. Żeby przesunąć całą gierkę na inny
            dzień tygodnia, zmień ustawienia serii.
          </p>
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={() => onWybierz(wybrany)}
            disabled={busy}
            className="w-full rounded-xl bg-primary-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-800 disabled:opacity-50"
          >
            Zapisz zmiany
          </button>
        </div>
      </div>
    </div>
  );
}
