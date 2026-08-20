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
 * "Powtórz" pojawia się tu i w panelu „Zarządzaj wydarzeniem" (tam jako
 * "Powtórz mecz (skopiuj)") — to jest jednak TA SAMA akcja pod tą samą ikoną
 * (`handleOpenRepeat`), tylko krócej podpisana, bo tutaj dzieli miejsce
 * z dwoma innymi przyciskami w jednej linii; nie dwie różne rzeczy pod
 * wspólną nazwą jak w `O-20` (`docs/przeplyw-organizatora.md`), więc
 * dublowanie tu jest świadome.
 */

interface WierszZadania {
  key: string;
  etykieta: string;
  zrobione: boolean;
  onClick?: () => void;
  akcjaLabel: string;
  ikona: typeof Banknote;
}

/** Rząd przycisków "Nieobecni" / "Zapłacili" / "Powtórz" — trzy naraz na
 *  360 px. Same skrócone etykiety nie wystarczały same z siebie (nawet
 *  "Kto nie przyszedł" przy najmniejszej sensownej czcionce nie mieści się
 *  w ~95 px na przycisk, zgłoszone wprost ze zrzutem: tekst ucinał się do
 *  "Kto nie p..."), więc oba naraz: krótsze słowa I mniejsza czcionka niż
 *  domyślny przycisk apki (10 px, węższy padding, ta sama ikona). Wspólna
 *  stała, bo rząd renderuje się w dwóch gałęziach niżej (pusta lista zadań /
 *  pełna lista). */
const PRZYCISK_CLS = 'flex flex-1 min-w-0 items-center justify-center gap-1 rounded-xl border border-slate-300 px-1.5 py-2 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300';

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
   *  "wszyscy już oddali" od "skład jest pusty", a przycisk "Zapłacili"
   *  nie ma się wtedy do czego odnosić. */
  liczbaWSkladzie: number;
  onWyslijRozliczenie: () => void;
  /** Ta sama akcja co przycisk "Wszyscy oddali"/"Cofnij" w zakładce
   *  Rozliczenia (`handleWszyscyOddali` w `EventDetailClient.tsx`) — tu pod
   *  krótszą etykietą "Zapłacili"/"Cofnij" (patrz `PRZYCISK_CLS`), ale
   *  przełącza się tak samo, sterowana `liczbaNieoplaconych`. */
  onWszyscyOddali: () => void;
  /** Blokuje przycisk "Zapłacili" na czas zapisu, żeby drugi klik nie
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
   *  płatności) — przycisk "Nieobecni" (otwiera modal "Kto nie przyszedł")
   *  wtedy się nie renderuje. */
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
      {/* "Zapłacili", nie "Wszyscy oddali" — pełna etykieta nie mieści się
          obok dwóch innych przycisków w jednej linii nawet przy najmniejszej
          czytelnej czcionce (zgłoszone wprost, ze zrzutem: ucinało się do
          "Wszyscy..."). Panel „Podział kosztów" ma miejsce na pełną wersję. */}
      <span className="truncate">{wszyscyJuzOddali ? 'Cofnij' : 'Zapłacili'}</span>
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
              {/* Skrócone z "Kto nie przyszedł" — modal, który się otwiera,
                  ma pełną nazwę w nagłówku, ten przycisk musi się zmieścić
                  obok dwóch innych w jednej linii. */}
              <span className="truncate">Nieobecni</span>
            </button>
          )}
          {przyciskWszyscyOddali}
          <button
            type="button"
            onClick={onPowtorzMecz}
            className={PRZYCISK_CLS}
          >
            <Copy className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            <span className="truncate">Powtórz</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="font-semibold text-ink">Po meczu</p>
      <ul className="mt-2.5 space-y-2">
        {zadania.map((z) => {
          const Ikona = z.ikona;
          // Sama strzałka po prawej, bez powtarzania `akcjaLabel` na
          // widoku — cały wiersz jest już jednym przyciskiem, a pełna
          // etykieta akcji obok statusu ("4 osoby jeszcze nie oddały" +
          // "Wyślij rozliczenie") zabierała tyle miejsca, że status zawijał
          // się do dwóch linii mimo sporego luzu wokół (zgłoszone wprost).
          // `aria-label` na przycisku niesie oba fragmenty dla czytników
          // ekranu, mimo że na ekranie widać tylko jeden.
          const tresc = (
            <>
              <span className={[
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                z.zrobione ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700',
              ].join(' ')}>
                {z.zrobione ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Ikona className="h-3.5 w-3.5" strokeWidth={2.25} />}
              </span>
              <span className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300">{z.etykieta}</span>
              {!z.zrobione && <ChevronRight className="h-4 w-4 shrink-0 text-primary-700" strokeWidth={2.5} />}
            </>
          );
          if (z.zrobione) {
            return <li key={z.key} className="flex items-center gap-2.5">{tresc}</li>;
          }
          return (
            <li key={z.key}>
              <button
                type="button"
                onClick={z.onClick}
                aria-label={`${z.etykieta}. ${z.akcjaLabel}`}
                className="flex w-full items-center gap-2.5 rounded-lg -mx-1 px-1 py-1 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                {tresc}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-1.5">
        {onOznaczNieobecnych && (
          <button
            type="button"
            onClick={onOznaczNieobecnych}
            className={PRZYCISK_CLS}
          >
            <UserX className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            <span className="truncate">Nieobecni</span>
          </button>
        )}
        {przyciskWszyscyOddali}
        <button
          type="button"
          onClick={onPowtorzMecz}
          className={PRZYCISK_CLS}
        >
          <Copy className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
          <span className="truncate">Powtórz</span>
        </button>
      </div>
    </div>
  );
}
