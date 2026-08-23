'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Zwijana sekcja strony meczu — następca zakładek.
 *
 * DWIE BARIERY, bez których automatyczne rozwijanie zamienia się w walkę
 * z użytkownikiem:
 *
 *  1. NIGDY NIE ZWIJAMY TEGO, CO CZŁOWIEK SAM OTWORZYŁ. `domyslnieOtwarta`
 *     ustala wyłącznie stan STARTOWY; późniejsza zmiana reguły (bo minęła
 *     doba, bo ktoś zapłacił) nie zamyka sekcji pod palcem.
 *  2. DECYZJA CZŁOWIEKA WYGRYWA PRZY NASTĘPNYM WEJŚCIU. Zwinięcie i rozwinięcie
 *     zapamiętujemy per mecz i per sekcja w `localStorage`. Bez tego reguła
 *     rozwijałaby „Kasa" przy każdym wejściu komuś, kto właśnie ją zamknął,
 *     bo woli zapłacić na miejscu.
 *
 * `podsumowanie` jest obowiązkowe i to nie jest ozdoba: zwinięta sekcja musi
 * mówić, co w sobie ma („12 osób, 2 na rezerwie"), inaczej jest tylko napisem,
 * po który trzeba kliknąć, żeby się dowiedzieć, czy warto było klikać.
 */
export default function SekcjaMeczu({
  id, eventId, tytul, podsumowanie, ikona, domyslnieOtwarta = false,
  plakietka, children,
}: {
  id: string;
  eventId: string;
  tytul: string;
  /** Jedno zdanie widoczne, gdy sekcja jest zwinięta. */
  podsumowanie: string;
  ikona?: React.ReactNode;
  domyslnieOtwarta?: boolean;
  /** Liczba/kropka przy tytule — np. ile propozycji czeka. */
  plakietka?: React.ReactNode;
  children: React.ReactNode;
}) {
  const klucz = `bojo:sekcja:${eventId}:${id}`;
  const [otwarta, setOtwarta] = useState(domyslnieOtwarta);

  // Zapamiętany wybór czytamy PO montażu, nie w inicjalizatorze `useState`:
  // serwer nie ma `localStorage`, a różnica między pierwszym renderem
  // serwerowym a klienckim to błąd hydratacji.
  useEffect(() => {
    try {
      const zapisane = window.localStorage.getItem(klucz);
      if (zapisane === '1') setOtwarta(true);
      else if (zapisane === '0') setOtwarta(false);
    } catch { /* prywatne okno — zostaje stan domyślny */ }
  }, [klucz]);

  const przelacz = () => {
    setOtwarta((v) => {
      try { window.localStorage.setItem(klucz, v ? '0' : '1'); } catch { /* jw. */ }
      return !v;
    });
  };

  return (
    <section id={id} className="px-4">
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800">
        <button
          type="button"
          onClick={przelacz}
          aria-expanded={otwarta}
          aria-controls={`${id}-tresc`}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
        >
          {ikona && <span className="shrink-0 text-slate-400">{ikona}</span>}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-ink">{tytul}</span>
              {plakietka}
            </span>
            {/* Podsumowanie zostaje widoczne TAKŻE po rozwinięciu — znika tylko
                wtedy, gdy powtarzałoby to, co widać niżej. Tutaj nie powtarza:
                to jest liczba, a niżej są ludzie. */}
            {!otwarta && (
              <span className="mt-0.5 block truncate text-[13px] text-slate-500 dark:text-slate-400">
                {podsumowanie}
              </span>
            )}
          </span>
          <ChevronDown
            className={clsx('h-4 w-4 shrink-0 text-slate-400 transition-transform', otwarta && 'rotate-180')}
            aria-hidden="true"
          />
        </button>

        {otwarta && (
          <div id={`${id}-tresc`} className="border-t border-slate-100 px-4 py-4 dark:border-slate-700">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
