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

import { useState } from 'react';
import { X } from 'lucide-react';
import { WARSTWA } from '@/lib/warstwy';
import type { TurniejZawodnik } from '@/types';

export default function ArkuszSkladu({
  tytul, podtytul, zawodnicy, etykietaPominiecia, akcjaDodatkowa, onDopisz, onWybor, onZamknij,
}: {
  tytul: string;
  podtytul?: string;
  zawodnicy: TurniejZawodnik[];
  /** Tekst na przycisku „nie wskazuję nikogo" — zawsze dostępnym. */
  etykietaPominiecia: string;
  /** Druga droga pod listą, np. „Samobój” przy golu (2026-11-21). */
  akcjaDodatkowa?: { etykieta: string; onClick: () => void };
  /** Dopisanie zawodnika spoza składu (194): zwraca jego id, które od razu
   *  idzie do `onWybor`. Bez tej funkcji pola nie ma. */
  onDopisz?: (imie: string) => Promise<string>;
  /** `undefined` = pominięto. */
  onWybor: (zawodnikId: string | undefined) => void;
  onZamknij: () => void;
}) {
  const [noweImie, setNoweImie] = useState('');
  const [dopisuje, setDopisuje] = useState(false);
  const dopisz = async () => {
    if (!onDopisz || !noweImie.trim() || dopisuje) return;
    setDopisuje(true);
    try {
      const id = await onDopisz(noweImie.trim());
      setNoweImie('');
      onWybor(id);
    } catch {
      // Komunikat błędu pokazuje wywołujący (toast); pole zostaje z wpisanym imieniem.
    } finally {
      setDopisuje(false);
    }
  };
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
          {/* DOPISZ ZAWODNIKA (2026-11-28): strzelca często nie ma w składzie,
              bo drużynę dodał organizator bez listy. Imię, „Dopisz” i od razu
              jest strzelcem tego zdarzenia. */}
          {onDopisz && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => { e.preventDefault(); void dopisz(); }}
            >
              <input
                value={noweImie}
                onChange={(e) => setNoweImie(e.target.value)}
                maxLength={60}
                placeholder="Nie ma na liście? Wpisz imię"
                aria-label="Imię nowego zawodnika"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={!noweImie.trim() || dopisuje}
                className="min-h-[44px] shrink-0 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {dopisuje ? 'Dopisuję…' : 'Dopisz'}
              </button>
            </form>
          )}
        </div>

        {/* Pominięcie jest ZAWSZE dostępne i stoi osobno, pod listą: w turnieju
            amatorskim połowa goli pada bez ustalenia strzelca, a prowadzący
            nie ma czasu pytać. Wymuszenie wyboru zamieniłoby ten ekran
            w formularz. */}
        <div className="flex gap-2 border-t border-slate-100 dark:border-slate-700 px-5 py-4">
          <button
            onClick={() => onWybor(undefined)}
            className="min-h-[44px] flex-1 rounded-xl border border-slate-200 dark:border-slate-600 px-4 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            {etykietaPominiecia}
          </button>
          {akcjaDodatkowa && (
            <button
              onClick={akcjaDodatkowa.onClick}
              className="min-h-[44px] shrink-0 rounded-xl bg-slate-100 dark:bg-slate-700 px-4 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              {akcjaDodatkowa.etykieta}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
