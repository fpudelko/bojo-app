'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { obliczRozliczenie } from '@/lib/kalkulatorKosztow';
import { KALKULATOR_HINT_KARTA, KALKULATOR_HINT_BEZ_ZNIZKI } from '@/content/kalkulator';

const inputCls =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

function zl(grosze: number): string {
  return `${(grosze / 100).toFixed(2)} zł`;
}

/**
 * Kalkulator kosztów boiska — jedyna strona SEO/GEO, która nie potrzebuje ani
 * jednego użytkownika, żeby być użyteczna (docs/seo-geo-strategia.md, N1).
 * Liczy WYŁĄCZNIE dwiema funkcjami z lib/payments.ts, dokładnie tymi, których
 * używa mecz w aplikacji (EventDetailClient.tsx) — żaden nowy wzór.
 */
export default function KalkulatorKosztow() {
  const [kosztPln, setKosztPln] = useState('280');
  const [graczy, setGraczy] = useState('14');
  const [zKarta, setZKarta] = useState('0');
  const [znizkaPln, setZnizkaPln] = useState('');

  const wynik = useMemo(
    () => obliczRozliczenie({ kosztPln, graczy, zKarta, znizkaPln }),
    [kosztPln, graczy, zKarta, znizkaPln],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="koszt" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Koszt wynajmu obiektu (zł)
          </label>
          <input
            id="koszt"
            type="number"
            min={0}
            step={1}
            inputMode="decimal"
            value={kosztPln}
            onChange={(e) => setKosztPln(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="graczy" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Liczba graczy (miejsc)
          </label>
          <input
            id="graczy"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={graczy}
            onChange={(e) => setGraczy(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="zKarta" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Ilu graczy ma kartę sportową
          </label>
          <input
            id="zKarta"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={zKarta}
            onChange={(e) => setZKarta(e.target.value)}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-slate-400">{KALKULATOR_HINT_KARTA}</p>
        </div>
        <div>
          <label htmlFor="znizka" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Zniżka dla posiadacza karty (zł, opcjonalnie)
          </label>
          <input
            id="znizka"
            type="number"
            min={0}
            step={1}
            inputMode="decimal"
            placeholder="np. 20"
            value={znizkaPln}
            onChange={(e) => setZnizkaPln(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-slate-600 dark:text-slate-400">
            Cena od osoby {wynik.liczbaZKarta > 0 ? '(bez karty)' : ''}
          </span>
          <span className="font-semibold text-ink">{zl(wynik.cenaBezKarty)}</span>
        </div>

        {wynik.liczbaZKarta > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">Cena od osoby (z kartą)</span>
            <span className="font-semibold text-ink">
              {wynik.znizkaNieustalona ? 'ustalcie kwotę zniżki' : zl(wynik.cenaZKarta)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Suma do zebrania ({wynik.liczbaGraczy} {wynik.liczbaGraczy === 1 ? 'gracz' : 'graczy'})
          </span>
          <span className="font-display text-lg font-bold text-ink">{zl(wynik.suma)}</span>
        </div>

        {wynik.liczbaZKarta > 0 && wynik.znizkaNieustalona && (
          <p className="text-xs text-slate-400">{KALKULATOR_HINT_BEZ_ZNIZKI}</p>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/wydarzenia/nowe"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-700 px-5 text-sm font-bold text-white transition hover:bg-primary-800 active:scale-95"
        >
          Zorganizuj mecz z tym rozliczeniem
        </Link>
        <Link
          href="/jak-dziala-bojo#pieniadze"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-slate-600 dark:text-slate-300"
        >
          Jak to działa na stronie meczu
        </Link>
      </div>
    </div>
  );
}
