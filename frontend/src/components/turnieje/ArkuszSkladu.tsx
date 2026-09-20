'use client';

/**
 * Arkusz od dołu ekranu z kaflami składu — „kto strzelił?".
 *
 * DLACZEGO NIE `<select>`. Konsola prowadzącego jest używana na stojąco,
 * w słońcu, jedną ręką, przez sześć godzin. Natywna lista rozwijana na
 * telefonie zasłania cały ekran, wymaga precyzyjnego trafienia w wiersz
 * i kończy się drugim dotknięciem w „Gotowe" — a wybór strzelca i asysty
 * dawał dwa takie menu pod rząd, zanim w ogóle padł gol. Plan modułu
 * (docs/turnieje-plan-duze-klocki.md §10) mówił o arkuszu ze składem
 * i jednym dotknięciu od początku.
 *
 * Kafel ma minimum 64 px wysokości i niesie numer oraz imię — numer, bo na
 * boisku prowadzący widzi właśnie jego, imię, bo w turnieju amatorskim
 * połowa drużyn gra bez numerów.
 */

import { X } from 'lucide-react';
import { WARSTWA } from '@/lib/warstwy';
import type { TurniejZawodnik } from '@/types';

export default function ArkuszSkladu({
  tytul, podtytul, zawodnicy, etykietaPominiecia, onWybor, onZamknij,
}: {
  tytul: string;
  podtytul?: string;
  zawodnicy: TurniejZawodnik[];
  /** Tekst na przycisku „nie wskazuję nikogo" — zawsze dostępnym. */
  etykietaPominiecia: string;
  /** `undefined` = pominięto. */
  onWybor: (zawodnikId: string | undefined) => void;
  onZamknij: () => void;
}) {
  return (
    <div
      className={`fixed inset-0 ${WARSTWA.modal} flex items-end justify-center bg-black/40 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4`}
      onClick={onZamknij}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-white dark:bg-slate-800 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold text-ink">{tytul}</h2>
            {podtytul && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{podtytul}</p>}
          </div>
          <button onClick={onZamknij} aria-label="Zamknij" className="shrink-0 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {zawodnicy.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Ta drużyna nie ma jeszcze wpisanego składu.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {zawodnicy.map((z) => (
                <button
                  key={z.id}
                  onClick={() => onWybor(z.id)}
                  className="flex min-h-[64px] flex-col justify-center rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-left active:bg-primary-50 dark:active:bg-primary-950"
                >
                  {z.numer !== undefined && (
                    <span className="font-mono text-xs text-slate-400">{z.numer}</span>
                  )}
                  <span className="line-clamp-2 text-sm font-medium text-ink">{z.imie}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pominięcie jest ZAWSZE dostępne i stoi osobno, pod listą: w turnieju
            amatorskim połowa goli pada bez ustalenia strzelca, a prowadzący
            nie ma czasu pytać. Wymuszenie wyboru zamieniłoby ten ekran
            w formularz. */}
        <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-4">
          <button
            onClick={() => onWybor(undefined)}
            className="min-h-[44px] w-full rounded-xl border border-slate-200 dark:border-slate-600 px-4 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            {etykietaPominiecia}
          </button>
        </div>
      </div>
    </div>
  );
}
