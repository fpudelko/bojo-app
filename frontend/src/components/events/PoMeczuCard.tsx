'use client';

import { Banknote, Trophy, UserPlus, Copy, Check, ChevronRight } from 'lucide-react';
import { withCount } from '@/lib/plural';

/**
 * Karta „Po meczu" dla organizatora — zbiera w jednym miejscu to, co strona
 * meczu dotąd rozrzucała po jednej bursztynowej linijce ("wpisz wynik") i
 * ciszy wszędzie indziej. Dane produkcyjne: 122 rozegrane mecze, 6 zapisanych
 * wyników, 45 nierozliczonych, zero przejętych wpisów gości — Bojo umie te
 * rzeczy, tylko nic o nie nie prosiło we właściwym momencie.
 *
 * Czysto prezentacyjna: `EventDetailClient.tsx` liczy wszystkie wartości
 * z danych, które i tak już ma wczytane (`regulars`, `matchResult`,
 * `niePrzejeciGoscie`) — zero nowego zapytania do bazy.
 *
 * "Powtórz mecz" pojawia się tu i w panelu „Zarządzaj wydarzeniem" — to jest
 * jednak TA SAMA akcja pod tą samą etykietą i ikoną (`handleOpenRepeat`),
 * nie dwie różne rzeczy pod wspólną nazwą jak w `O-20`
 * (`docs/przeplyw-organizatora.md`), więc dublowanie tu jest świadome.
 */

interface WierszZadania {
  key: string;
  etykieta: string;
  zrobione: boolean;
  href?: string;
  onClick?: () => void;
  akcjaLabel: string;
  ikona: typeof Banknote;
}

export default function PoMeczuCard({
  maPlatnosc,
  liczbaNieoplaconych,
  onWyslijRozliczenie,
  trackResults,
  wynikWpisany,
  liczbaGosciDoZaproszenia,
  onPowtorzMecz,
}: {
  /** `event.costGrosze > 0` — bez tego panel kosztów w ogóle nie istnieje. */
  maPlatnosc: boolean;
  liczbaNieoplaconych: number;
  onWyslijRozliczenie: () => void;
  trackResults: boolean;
  wynikWpisany: boolean;
  liczbaGosciDoZaproszenia: number;
  onPowtorzMecz: () => void;
}) {
  const zadania: WierszZadania[] = [];

  if (maPlatnosc) {
    const zrobione = liczbaNieoplaconych === 0;
    zadania.push({
      key: 'rozliczenie',
      etykieta: zrobione
        ? 'Rozliczono'
        : withCount(liczbaNieoplaconych, 'osoba jeszcze nie oddała', 'osoby jeszcze nie oddały', 'osób jeszcze nie oddało'),
      zrobione,
      onClick: zrobione ? undefined : onWyslijRozliczenie,
      akcjaLabel: 'Wyślij rozliczenie',
      ikona: Banknote,
    });
  }

  if (trackResults) {
    zadania.push({
      key: 'wynik',
      etykieta: wynikWpisany ? 'Wynik wpisany' : 'Wynik nie jest jeszcze wpisany',
      zrobione: wynikWpisany,
      href: wynikWpisany ? undefined : '#wynik-meczu',
      akcjaLabel: 'Wpisz wynik',
      ikona: Trophy,
    });
  }

  if (liczbaGosciDoZaproszenia > 0) {
    zadania.push({
      key: 'goscie',
      etykieta: withCount(
        liczbaGosciDoZaproszenia,
        'gość bez konta w składzie', 'goście bez konta w składzie', 'gości bez konta w składzie',
      ),
      zrobione: false,
      href: '#sklad',
      akcjaLabel: 'Zaproś do Bojo',
      ikona: UserPlus,
    });
  }

  const doZrobienia = zadania.filter((z) => !z.zrobione);

  // Nic do przypomnienia (albo mecz nie śledzi żadnej z tych rzeczy) —
  // karta nie znika całkiem, bo oferta powtórki jest zawsze na miejscu, ale
  // ustępuje jednej linii zamiast zajmować pełną kartę zadań.
  if (doZrobienia.length === 0) {
    return (
      <div className="mx-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {zadania.length > 0 ? 'Wszystko rozliczone. ' : ''}Powtórzyć mecz za tydzień?
        </p>
        <button
          type="button"
          onClick={onPowtorzMecz}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 dark:border-slate-600 dark:text-slate-300"
        >
          <Copy className="h-4 w-4" strokeWidth={2.25} /> Powtórz mecz
        </button>
      </div>
    );
  }

  return (
    <div className="mx-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="font-semibold text-ink">Po meczu</p>
      <ul className="mt-3 space-y-2.5">
        {zadania.map((z) => {
          const Ikona = z.ikona;
          const tresc = (
            <>
              <span className={[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                z.zrobione ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700',
              ].join(' ')}>
                {z.zrobione ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Ikona className="h-4 w-4" strokeWidth={2.25} />}
              </span>
              <span className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300">{z.etykieta}</span>
              {!z.zrobione && (
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-700">
                  {z.akcjaLabel} <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              )}
            </>
          );
          if (z.zrobione) {
            return <li key={z.key} className="flex items-center gap-3">{tresc}</li>;
          }
          if (z.href) {
            return (
              <li key={z.key}>
                <a href={z.href} className="flex items-center gap-3 rounded-lg -mx-1 px-1 py-1 transition hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  {tresc}
                </a>
              </li>
            );
          }
          return (
            <li key={z.key}>
              <button
                type="button"
                onClick={z.onClick}
                className="flex w-full items-center gap-3 rounded-lg -mx-1 px-1 py-1 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                {tresc}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onPowtorzMecz}
        className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 dark:border-slate-600 dark:text-slate-300 sm:w-auto"
      >
        <Copy className="h-4 w-4" strokeWidth={2.25} /> Powtórz mecz
      </button>
    </div>
  );
}
