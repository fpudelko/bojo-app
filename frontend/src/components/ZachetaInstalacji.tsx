'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CalendarClock, MessageCircle, Plus, Share, UserPlus, X } from 'lucide-react';
import { LogoIcon } from '@/components/Logo';
import { WARSTWA } from '@/lib/warstwy';
import {
  czyJuzOdrzucil,
  czyPokazacZachete,
  czytajStanPrzegladarki,
  korzysciInstalacji,
  powodInstalacji,
  zapamietajOdrzucenie,
  type Korzysc,
  type StanPrzegladarki,
} from '@/lib/instalacja';

/** Zdarzenie, którym reszta aplikacji prosi o pokazanie zachęty. */
export const ZDARZENIE_ZACHETY = 'bojo:zaproponuj-instalacje';

/**
 * Prosi o pokazanie zachęty do instalacji.
 *
 * Wołane z miejsc, w których użytkownikowi WŁAŚNIE coś się udało — dziś po
 * zapisaniu się na mecz. Sama funkcja niczego nie rozstrzyga; komponent i tak
 * sprawdzi, czy jest kogo i po co pytać (`lib/instalacja.ts`).
 */
export function zaproponujInstalacje() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ZDARZENIE_ZACHETY));
}

/** Zdarzenie `beforeinstallprompt` nie jest w typach DOM — Safari go nie ma. */
interface ZdarzenieInstalacji extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Ikona dla korzyści — klucz z `lib/instalacja.ts`, symbol tutaj. */
const IKONY: Record<Korzysc['ikona'], typeof Bell> = {
  miejsce: UserPlus,
  przypomnienie: CalendarClock,
  rozmowa: MessageCircle,
};

/**
 * Arkusz zachęcający do dodania Bojo do ekranu głównego.
 *
 * DLACZEGO W OGÓLE: bez tego Bojo czekało, aż ktoś sam wpadnie na pomysł
 * instalacji. Prawie nikt nie wpada — a na iPhonie instalacja jest warunkiem
 * powiadomień, więc jej brak wycina cały kanał.
 *
 * Kiedy się pokazuje i komu — patrz `lib/instalacja.ts`; tutaj jest wyłącznie
 * widok i przechwycenie systemowego zdarzenia.
 */
export default function ZachetaInstalacji() {
  const [widoczna, setWidoczna] = useState(false);
  const [stan, setStan] = useState<StanPrzegladarki | null>(null);
  // Chrome na Androidzie daje to zdarzenie RAZ i tylko wtedy, gdy uzna stronę
  // za instalowalną. Chowamy je do kieszeni, żeby pokazać własny przycisk
  // w wybranym przez nas momencie, zamiast zdawać się na moment przeglądarki.
  const systemowe = useRef<ZdarzenieInstalacji | null>(null);

  useEffect(() => {
    setStan(czytajStanPrzegladarki());

    const zlap = (zdarzenie: Event) => {
      // Bez tego Chrome pokazałby własny pasek, konkurencyjny do naszego.
      zdarzenie.preventDefault();
      systemowe.current = zdarzenie as ZdarzenieInstalacji;
    };
    window.addEventListener('beforeinstallprompt', zlap);
    return () => window.removeEventListener('beforeinstallprompt', zlap);
  }, []);

  useEffect(() => {
    const pokaz = () => {
      const biezacy = czytajStanPrzegladarki();
      setStan(biezacy);
      if (czyPokazacZachete(biezacy, czyJuzOdrzucil(), systemowe.current !== null)) {
        setWidoczna(true);
      }
    };
    window.addEventListener(ZDARZENIE_ZACHETY, pokaz);
    return () => window.removeEventListener(ZDARZENIE_ZACHETY, pokaz);
  }, []);

  const zamknij = useCallback(() => {
    setWidoczna(false);
    zapamietajOdrzucenie();
  }, []);

  const zainstaluj = useCallback(async () => {
    const zdarzenie = systemowe.current;
    if (!zdarzenie) return;
    await zdarzenie.prompt();
    await zdarzenie.userChoice;
    // Systemowe okno da się pokazać tylko raz — po odpowiedzi zdarzenie jest
    // zużyte, niezależnie od tego, co użytkownik wybrał.
    systemowe.current = null;
    setWidoczna(false);
    zapamietajOdrzucenie();
  }, []);

  if (!widoczna || !stan) return null;

  const naIos = stan.system === 'ios';
  const korzysci = korzysciInstalacji();

  return (
    <>
      {/* PRZYCIEMNIENIE TŁA. Poprzednia wersja była wąskim paskiem u dołu —
        * czytała się jak stopka strony, czyli jak coś, co tam po prostu jest.
        * Arkusz z przyciemnionym tłem mówi „to jest teraz", a przy okazji daje
        * drugi, naturalny sposób zamknięcia: stuknięcie obok. */}
      <div
        onClick={zamknij}
        aria-hidden
        className={`fixed inset-0 ${WARSTWA.zachetaInstalacji} animate-fade-in bg-slate-900/45 backdrop-blur-[2px]`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Dodaj Bojo do ekranu głównego"
        className={`fixed inset-x-0 bottom-0 ${WARSTWA.zachetaInstalacji} animate-slide-up rounded-t-3xl bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.28)] dark:bg-slate-800`}
        // Arkusz leży NAD dolną nawigacją (wyższa warstwa), więc nie musi się
        // o nią odsuwać jak `CookieBanner` — wystarczy pasek bezpieczny iPhone'a
        // pod ostatnim przyciskiem.
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
      >
        {/* Uchwyt jak w każdym arkuszu systemowym — sam kształt mówi „to się
          * zamyka w dół", zanim ktokolwiek poszuka krzyżyka. */}
        <div className="flex justify-center pt-2.5">
          <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        <button
          type="button"
          onClick={zamknij}
          aria-label="Nie teraz"
          className="absolute right-3 top-3 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>

        <div className="mx-auto max-w-lg px-5 pb-5 pt-4">
          {/* Logo duże i wyśrodkowane: to ma wyglądać jak ikona, która za chwilę
            * stanie na ekranie głównym — pokazujemy rezultat, nie czynność. */}
          <div className="flex flex-col items-center text-center">
            <LogoIcon
              size={72}
              className="rounded-2xl shadow-[0_10px_30px_-10px_rgba(21,128,61,0.55)] ring-1 ring-black/5"
            />
            <h2 className="mt-3.5 text-xl font-extrabold leading-tight text-ink dark:text-slate-100">
              Miej Bojo na ekranie głównym
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {powodInstalacji(stan.system)}
            </p>
          </div>

          {/* KORZYŚCI, nie funkcje. Trzy zdania o tym, czego nie chce się
            * przegapić — treść siedzi w `lib/instalacja.ts`, żeby dała się
            * sprawdzić testem bez renderowania. */}
          <ul className="mt-4 space-y-2.5 rounded-2xl bg-primary-50/70 p-3.5 dark:bg-primary-950/25">
            {korzysci.map((korzysc) => {
              const Ikona = IKONY[korzysc.ikona];
              return (
                <li key={korzysc.ikona} className="flex items-start gap-2.5">
                  <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-primary-700 shadow-sm dark:bg-slate-800">
                    <Ikona className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                  <span className="min-w-0 text-sm font-medium leading-snug text-slate-700 dark:text-slate-200">
                    {korzysc.tekst}
                  </span>
                </li>
              );
            })}
          </ul>

          {naIos ? (
            // Na iOS nie da się zainstalować za użytkownika — Safari nie
            // udostępnia żadnego zdarzenia. Zostaje instrukcja, więc musi być
            // dosłowna: te dwie ikony wyglądają dokładnie tak, jak w systemie.
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-3.5 dark:border-slate-600">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Dwa stuknięcia
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                Stuknij
                <Share className="h-4 w-4 shrink-0 text-primary-700" strokeWidth={2.25} />
                na dole ekranu, potem
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-700">
                  <Plus className="h-3 w-3" strokeWidth={2.5} /> Do ekranu początkowego
                </span>
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={zainstaluj}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-700 px-4 py-3.5 text-base font-bold text-white shadow-[0_8px_24px_-10px_rgba(21,128,61,0.9)] transition hover:bg-primary-800 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" strokeWidth={3} />
              Dodaj do ekranu głównego
            </button>
          )}

          <button
            type="button"
            onClick={zamknij}
            className="mt-2 w-full rounded-xl py-2.5 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Nie teraz
          </button>
        </div>
      </div>
    </>
  );
}
