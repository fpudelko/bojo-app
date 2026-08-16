'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Share, Plus, X } from 'lucide-react';
import { LogoIcon } from '@/components/Logo';
import { WARSTWA } from '@/lib/warstwy';
import {
  czyJuzOdrzucil,
  czyPokazacZachete,
  czytajStanPrzegladarki,
  powodInstalacji,
  zapamietajOdrzucenie,
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

/**
 * Pasek zachęcający do dodania Bojo do ekranu głównego.
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

  return (
    <div
      role="dialog"
      aria-label="Dodaj Bojo do ekranu głównego"
      className={`fixed inset-x-0 bottom-0 ${WARSTWA.zachetaInstalacji} border-t border-slate-200 bg-white shadow-[0_-2px_16px_rgba(0,0,0,0.10)] dark:border-slate-700 dark:bg-slate-800`}
      // Pasek jest `fixed`, więc dopełnienie <body> go nie dotyczy — musi sam
      // odsunąć się o wysokość dolnej nawigacji. Ta sama sztuczka co
      // w `CookieBanner`; `--bottom-nav-h` wynosi 0 tam, gdzie paska nie ma.
      style={{ marginBottom: 'var(--bottom-nav-h)' }}
    >
      <div className="mx-auto flex max-w-lg items-start gap-3 px-4 py-3.5">
        <LogoIcon size={40} className="mt-0.5 shrink-0 rounded-xl" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink dark:text-slate-100">
            Miej Bojo pod ręką
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {powodInstalacji(stan.system)}
          </p>

          {naIos ? (
            // Na iOS nie da się zainstalować za użytkownika — Safari nie
            // udostępnia żadnego zdarzenia. Zostaje instrukcja, więc musi być
            // dosłowna: te dwie ikony wyglądają dokładnie tak, jak w systemie.
            <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              Stuknij
              <Share className="h-4 w-4 shrink-0 text-primary-700" strokeWidth={2.25} />
              na dole ekranu, potem
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-700">
                <Plus className="h-3 w-3" strokeWidth={2.5} /> Do ekranu początkowego
              </span>
            </p>
          ) : (
            <button
              type="button"
              onClick={zainstaluj}
              className="mt-2.5 inline-flex items-center justify-center rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-800 active:scale-95"
            >
              Dodaj do ekranu
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={zamknij}
          aria-label="Nie teraz"
          className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
