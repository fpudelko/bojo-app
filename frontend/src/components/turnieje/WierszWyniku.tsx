'use client';
// Rozegrany mecz turnieju w JEDNYM wierszu (decyzja właściciela z 2026-11-21):
// znacznik grupy albo fazy, drużyny, wynik. Na liście trzydziestu wyników
// pełna karta z datą, godziną i boiskiem powtarzała to samo trzydzieści razy.
// Dotknięcie rozwija wiersz: strzelcy, termin, boisko i wejście w szczegóły.
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Clock, MapPin } from 'lucide-react';
import { strzelcyMeczu, terminMeczuNaKarcie, znacznikFazy } from '@/lib/turniejEtykiety';
import { stronaZwyciezcy } from '@/lib/turniejWynik';
import type { TurniejGrupa, TurniejMecz, TurniejZdarzenie } from '@/types';

export default function WierszWyniku({
  mecz, druzynyPoId, arenyPoId, grupyPoId, zdarzenia, zawodnicyPoId, szczegolyHref,
}: {
  mecz: TurniejMecz;
  druzynyPoId: ReadonlyMap<string, string>;
  arenyPoId: ReadonlyMap<string, string>;
  grupyPoId?: ReadonlyMap<string, TurniejGrupa>;
  zdarzenia: readonly TurniejZdarzenie[];
  zawodnicyPoId: ReadonlyMap<string, string>;
  szczegolyHref: string;
}) {
  const [rozwiniety, setRozwiniety] = useState(false);
  const nazwaA = (mecz.druzynaAId && druzynyPoId.get(mecz.druzynaAId)) || '-';
  const nazwaB = (mecz.druzynaBId && druzynyPoId.get(mecz.druzynaBId)) || '-';
  const zwyciezca = stronaZwyciezcy(mecz);
  const ton = (strona: 'a' | 'b') =>
    zwyciezca === strona ? 'font-semibold text-ink' : zwyciezca ? 'text-slate-500 dark:text-slate-400' : 'text-ink';
  const karne = mecz.karneA !== undefined && mecz.karneB !== undefined ? `k. ${mecz.karneA}:${mecz.karneB}` : null;
  const strzelcy = rozwiniety ? strzelcyMeczu(mecz, zdarzenia, zawodnicyPoId) : null;
  const termin = mecz.zaplanowanyAt ? terminMeczuNaKarcie(mecz.zaplanowanyAt) : null;
  const arena = mecz.arenaId ? arenyPoId.get(mecz.arenaId) : undefined;

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
      <button
        type="button"
        onClick={() => setRozwiniety((v) => !v)}
        aria-expanded={rozwiniety}
        className="flex min-h-[48px] w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-md bg-slate-100 px-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {znacznikFazy(mecz, grupyPoId)}
        </span>
        <span className={`min-w-0 flex-1 truncate text-right text-sm ${ton('a')}`}>{nazwaA}</span>
        <span className="shrink-0 text-center">
          <span className="block font-mono text-base font-bold text-ink">{mecz.wynikA}:{mecz.wynikB}</span>
          {karne && <span className="block font-mono text-[10px] leading-tight text-slate-500">{karne}</span>}
        </span>
        <span className={`min-w-0 flex-1 truncate text-sm ${ton('b')}`}>{nazwaB}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${rozwiniety ? 'rotate-180' : ''}`} />
      </button>

      {rozwiniety && strzelcy && (
        <div className="space-y-2.5 border-t border-slate-100 px-3 py-3 text-sm dark:border-slate-700">
          {/* Pełne nazwy tutaj: w wierszu bywają ucięte. */}
          <div className="grid grid-cols-2 gap-3">
            {(['a', 'b'] as const).map((strona) => (
              <div key={strona} className={strona === 'b' ? 'text-right' : ''}>
                <p className="break-words text-xs font-semibold text-slate-500 dark:text-slate-300">{strona === 'a' ? nazwaA : nazwaB}</p>
                {strzelcy[strona].length === 0 ? (
                  <p className="text-xs text-slate-400">bez goli</p>
                ) : (
                  strzelcy[strona].map((s, i) => <p key={i} className="text-sm text-ink">⚽ {s}</p>)
                )}
              </div>
            ))}
          </div>
          {(termin || arena) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-300">
              {termin && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {termin.dzien}, {termin.godzina}</span>}
              {arena && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {arena}</span>}
            </div>
          )}
          <Link href={szczegolyHref} className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary-600">
            Szczegóły meczu <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
