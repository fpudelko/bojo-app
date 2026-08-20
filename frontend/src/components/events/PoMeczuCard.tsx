'use client';

import { Banknote, Trophy, UserPlus, UserX, Copy, Check, ChevronRight } from 'lucide-react';
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
  onClick?: () => void;
  akcjaLabel: string;
  ikona: typeof Banknote;
}

/** Rząd przycisków "Kto nie przyszedł" / "Wszyscy oddali" / "Powtórz mecz" —
 *  trzy naraz na 360 px, więc ciaśniej niż domyślny rozmiar przycisku w apce
 *  (mniejsza czcionka, węższy padding, mniejsza ikona). Wspólna stała, bo rząd
 *  renderuje się w dwóch gałęziach niżej (pusta lista zadań / pełna lista). */
const PRZYCISK_CLS = 'flex flex-1 min-w-0 items-center justify-center gap-1 rounded-xl border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300';

export default function PoMeczuCard({
  maPlatnosc,
  liczbaNieoplaconych,
  liczbaWSkladzie,
  onWyslijRozliczenie,
  onWszyscyOddali,
  busy = false,
  trackResults,
  wynikWpisany,
  onWpiszWynik,
  liczbaGosciDoZaproszenia,
  onZaprosGoscia,
  onOznaczNieobecnych,
  onPowtorzMecz,
}: {
  /** `event.costGrosze > 0` — bez tego panel kosztów w ogóle nie istnieje. */
  maPlatnosc: boolean;
  liczbaNieoplaconych: number;
  /** `regulars.length` — bez tego `liczbaNieoplaconych === 0` nie odróżnia
   *  "wszyscy już oddali" od "skład jest pusty", a przycisk "Wszyscy oddali"
   *  nie ma się wtedy do czego odnosić. */
  liczbaWSkladzie: number;
  onWyslijRozliczenie: () => void;
  /** Ta sama akcja co przycisk "Wszyscy oddali"/"Cofnij" w zakładce
   *  Rozliczenia (`handleWszyscyOddali` w `EventDetailClient.tsx`) — etykieta
   *  przełącza się tu tak samo, sterowana `liczbaNieoplaconych`. */
  onWszyscyOddali: () => void;
  /** Blokuje przycisk "Wszyscy oddali" na czas zapisu, żeby drugi klik nie
   *  wysłał drugiego żądania na to samo. */
  busy?: boolean;
  trackResults: boolean;
  wynikWpisany: boolean;
  /** Przełącza na zakładkę Wynik — formularz wyniku żyje tam, nie na tej samej
   *  zakładce co ta karta, więc zwykły `href="#kotwica"` już nie wystarczy. */
  onWpiszWynik: () => void;
  liczbaGosciDoZaproszenia: number;
  onZaprosGoscia: () => void;
  /** `undefined` = widz bez uprawnień do składu (np. delegat wyłącznie od
   *  płatności) — przycisk "Kto nie przyszedł" wtedy się nie renderuje. */
  onOznaczNieobecnych?: () => void;
  onPowtorzMecz: () => void;
}) {
  const pokazWszyscyOddali = maPlatnosc && liczbaWSkladzie > 0;
  const wszyscyJuzOddali = liczbaNieoplaconych === 0;
  const przyciskWszyscyOddali = pokazWszyscyOddali && (
    <button
      type="button"
      onClick={onWszyscyOddali}
      disabled={busy}
      className={PRZYCISK_CLS}
    >
      <Banknote className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
      <span className="truncate">{wszyscyJuzOddali ? 'Cofnij' : 'Wszyscy oddali'}</span>
    </button>
  );

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
      onClick: wynikWpisany ? undefined : onWpiszWynik,
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
      onClick: onZaprosGoscia,
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
      <div className="mx-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {zadania.length > 0 ? 'Wszystko rozliczone. ' : ''}Powtórzyć mecz za tydzień?
        </p>
        <div className="mt-3 flex gap-1.5">
          {onOznaczNieobecnych && (
            <button
              type="button"
              onClick={onOznaczNieobecnych}
              className={PRZYCISK_CLS}
            >
              <UserX className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              <span className="truncate">Kto nie przyszedł</span>
            </button>
          )}
          {przyciskWszyscyOddali}
          <button
            type="button"
            onClick={onPowtorzMecz}
            className={PRZYCISK_CLS}
          >
            <Copy className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            <span className="truncate">Powtórz mecz</span>
          </button>
        </div>
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
      <div className="mt-3.5 flex gap-1.5">
        {onOznaczNieobecnych && (
          <button
            type="button"
            onClick={onOznaczNieobecnych}
            className={PRZYCISK_CLS}
          >
            <UserX className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            <span className="truncate">Kto nie przyszedł</span>
          </button>
        )}
        {przyciskWszyscyOddali}
        <button
          type="button"
          onClick={onPowtorzMecz}
          className={PRZYCISK_CLS}
        >
          <Copy className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
          <span className="truncate">Powtórz mecz</span>
        </button>
      </div>
    </div>
  );
}
