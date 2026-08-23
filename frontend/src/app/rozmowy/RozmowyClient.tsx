'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ChevronRight, LogIn, MessageCircle, Search, Users as UsersIcon, X } from 'lucide-react';
import Header from '@/components/layout/Header';
import MobileIdentityRow from '@/components/layout/MobileIdentityRow';
import { useAuth } from '@/lib/auth';
import { etykietaZapisu } from '@/lib/time';
import { foldText } from '@/lib/searchText';
import { wszystkieRozmowyMeczow, type RozmowaNaLiscie } from '@/lib/comments';
import { wszystkieRozmowyGrup } from '@/lib/groupPosts';
import { wszystkieRozmowyDm } from '@/lib/dm';
import { getMyGroups } from '@/lib/groups';
import { withCount } from '@/lib/plural';
import { oznaczWiadomosciPrzeczytane } from '@/lib/notifications';

/** Jedna rozmowa na liście `/rozmowy`. `typ` jest po to, żeby lista nie musiała
 *  zgadywać adresu z samego id — mecz i ekipa mają różne trasy. */
export interface WpisRozmowy extends RozmowaNaLiscie {
  typ: 'mecz' | 'grupa' | 'dm';
  href: string;
}

/** Mecze i ekipy w JEDNĄ listę, od najnowszej. Komunikator nie pyta, skąd
 *  wiadomość przyszła — pokazuje, co się ostatnio działo. Wydzielone z komponentu,
 *  żeby dało się to sprawdzić bez renderowania. */
export function polaczRozmowy(
  mecze: RozmowaNaLiscie[],
  ekipy: RozmowaNaLiscie[],
  prywatne: RozmowaNaLiscie[] = [],
): WpisRozmowy[] {
  return [
    ...mecze.map((r) => ({ ...r, typ: 'mecz' as const, href: `/wydarzenia/${r.id}?tab=rozmowa` })),
    ...ekipy.map((r) => ({ ...r, typ: 'grupa' as const, href: `/grupy/${r.id}?tab=tablica` })),
    ...prywatne.map((r) => ({ ...r, typ: 'dm' as const, href: `/rozmowy/${r.id}` })),
  ].sort((a, b) => b.najnowsza.localeCompare(a.najnowsza));
}

/**
 * `/rozmowy` — pełny ekran, który zastąpił arkusz otwierany z dolnej nawigacji.
 *
 * Arkusz miał dwa ograniczenia, z których żadne nie dawało się naprawić bez
 * zmiany formy: nie mieścił niczego poza listą (wyszukiwarki, zakładek,
 * miejsca na rozmowy prywatne), a jako warstwa nad inną stroną nie miał
 * własnego adresu — więc nie dało się do rozmów wrócić przyciskiem „wstecz"
 * ani wysłać linku.
 *
 * `hideMobileBarForUser`: na mobile dla zalogowanego pasek Header znika
 * całkiem, a jego miejsce zajmuje WŁASNY, kompaktowy nagłówek ekranu (tytuł +
 * `MobileIdentityRow` + szukajka) — ten sam wzorzec co `/mapa`, `/wydarzenia`.
 * Bez tego ekran wyglądał jak strona ze wstawionym czatem, nie jak
 * komunikator: generyczny pasek serwisu nad listą rozmów.
 */
export default function RozmowyClient() {
  const { user, loading: authLoading } = useAuth();
  const [ladowanie, setLadowanie] = useState(true);
  const [wpisy, setWpisy] = useState<WpisRozmowy[]>([]);
  const [szukane, setSzukane] = useState('');

  const zaladuj = useCallback(async (userId: string) => {
    const grupy = await getMyGroups(userId);
    const [mecze, ekipy, prywatne] = await Promise.all([
      wszystkieRozmowyMeczow(userId),
      wszystkieRozmowyGrup(userId, grupy),
      wszystkieRozmowyDm(userId),
    ]);
    setWpisy(polaczRozmowy(mecze, ekipy, prywatne));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLadowanie(false); return; }
    let aktualne = true;
    setLadowanie(true);
    zaladuj(user.id)
      .catch((e) => console.warn('[Rozmowy]', e))
      .finally(() => { if (aktualne) setLadowanie(false); });
    // Wejście na ekran rozmów gasi powiadomienia o wiadomościach — dawniej
    // robiło to otwarcie panelu chmurki w nagłówku, który odszedł razem z tą
    // trasą. Bez tego wiersze `TYPY_WIADOMOSCI` nie mają już ŻADNEJ drogi do
    // przeczytania: zostają w bazie na zawsze, a plakietka na ikonie aplikacji
    // (liczona z `notifications`, tak samo w `public/sw.js`) nigdy nie gaśnie.
    // Stan nieprzeczytania samej rozmowy liczy się osobno, ze znaczników
    // „widziano" — lista nadal pokazuje, czego nie czytano.
    oznaczWiadomosciPrzeczytane(user.id).catch(() => {});
    return () => { aktualne = false; };
  }, [user, authLoading, zaladuj]);

  // Powrót na tę kartę odświeża listę. Komunikator, do którego wraca się po
  // przeczytaniu rozmowy, nie może pokazywać jej nadal jako nieprzeczytanej —
  // a znacznik „widziano" siedzi w `localStorage`, więc React sam się o nim
  // nie dowie.
  useEffect(() => {
    if (!user) return;
    const odswiez = () => {
      if (document.visibilityState === 'visible') zaladuj(user.id).catch(() => {});
    };
    document.addEventListener('visibilitychange', odswiez);
    return () => document.removeEventListener('visibilitychange', odswiez);
  }, [user, zaladuj]);

  const nieprzeczytane = wpisy.reduce((suma, w) => suma + w.ile, 0);

  // Szukajka filtruje w pamięci — cała lista jest już wczytana, więc nie ma
  // po co iść po nią do bazy drugi raz. Dopasowuje tytuł ORAZ zajawkę
  // ostatniej wiadomości (`ostatnia`): „Boisko" znajdzie „Widzimy się na
  // boisku o 18", nie tylko rozmowę zatytułowaną tak samo.
  const wpisyPrzefiltrowane = useMemo(() => {
    const wzorzec = foldText(szukane.trim());
    if (!wzorzec) return wpisy;
    return wpisy.filter((w) => foldText(w.tytul).includes(wzorzec) || foldText(w.ostatnia ?? '').includes(wzorzec));
  }, [wpisy, szukane]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header hideMobileBarForUser />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 md:py-6">
        {/* Nagłówek komunikatora: na mobile zastępuje CAŁY pasek Header
            (`hideMobileBarForUser` wyżej) — tytuł, tożsamość i szukajka w
            jednym miejscu, jak w prawdziwym komunikatorze, nie jak strona ze
            wstawionym czatem pod nawigacją serwisu. */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-xl font-bold text-ink md:text-2xl">Rozmowy</h1>
            {nieprzeczytane > 0 && (
              <p className="text-[13px] font-medium text-pink-600 dark:text-pink-400">
                {withCount(nieprzeczytane, 'nieprzeczytana wiadomość', 'nieprzeczytane wiadomości', 'nieprzeczytanych wiadomości')}
              </p>
            )}
          </div>
          <div className="md:hidden"><MobileIdentityRow /></div>
        </div>

        {user && wpisy.length > 0 && (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={szukane}
              onChange={(e) => setSzukane(e.target.value)}
              placeholder="Szukaj w rozmowach"
              className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-ink placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-primary-900"
            />
            {szukane && (
              <button
                type="button"
                onClick={() => setSzukane('')}
                aria-label="Wyczyść szukanie"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {authLoading || ladowanie ? (
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700" />
            ))}
          </div>
        ) : !user ? (
          <div className="mt-10 text-center">
            <p className="text-3xl" aria-hidden="true">💬</p>
            <p className="mt-2 text-sm font-semibold text-ink">Rozmowy są dla zalogowanych</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
              Zaloguj się, żeby zobaczyć rozmowy ze swoich meczów i ekip.
            </p>
            <Link
              href="/logowanie"
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-700 px-4 text-sm font-semibold text-white transition hover:bg-primary-800"
            >
              <LogIn className="h-4 w-4" /> Zaloguj się
            </Link>
          </div>
        ) : wpisy.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-3xl" aria-hidden="true">💬</p>
            <p className="mt-2 text-sm font-semibold text-ink">Jeszcze cicho</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
              Rozmowy z Twoich meczów i ekip pojawią się tutaj — razem, od najnowszej.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link
                href="/wydarzenia"
                className="inline-flex min-h-[44px] items-center rounded-xl bg-primary-700 px-4 text-sm font-semibold text-white transition hover:bg-primary-800"
              >
                Znajdź grę
              </Link>
              <Link
                href="/grupy"
                className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Twoje ekipy
              </Link>
            </div>
          </div>
        ) : wpisyPrzefiltrowane.length === 0 ? (
          <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nic nie pasuje do „{szukane}".
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
            {wpisyPrzefiltrowane.map((w) => (
              <li key={`${w.typ}-${w.id}`}>
                <Link href={w.href} className="flex min-h-[44px] items-center gap-3 py-3 active:opacity-70">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl dark:bg-slate-700" aria-hidden="true">
                    {w.typ === 'mecz' ? '⚽' : w.typ === 'dm' ? (
                      /* Inicjał jak w bąbelkach czatu — rozmowa prywatna to
                         OSOBA, a nie „rzecz" z ikoną kategorii. */
                      <span className="flex h-full w-full items-center justify-center rounded-full bg-primary-100 text-base font-bold text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                        {w.tytul.charAt(0).toUpperCase()}
                      </span>
                    ) : <UsersIcon className="h-5 w-5 text-slate-500 dark:text-slate-300" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={clsx(
                        'min-w-0 flex-1 truncate text-sm text-ink',
                        w.ile > 0 ? 'font-bold' : 'font-semibold',
                      )}>
                        {w.tytul}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">{etykietaZapisu(w.najnowsza)}</span>
                    </span>
                    {/* Zajawka ostatniej wiadomości — bez niej lista mówi
                        wyłącznie „coś tu jest" i za każdym razem trzeba wejść,
                        żeby się dowiedzieć, czy warto było wchodzić. */}
                    <span className={clsx(
                      'mt-0.5 block truncate text-[13px]',
                      w.ile > 0 ? 'font-medium text-slate-600 dark:text-slate-300' : 'text-slate-400',
                    )}>
                      {w.ostatnia
                        ? `${w.moja ? 'Ty' : w.autor.split(' ')[0]}: ${w.ostatnia}`
                        : 'Brak wiadomości'}
                    </span>
                  </span>
                  {w.ile > 0 ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-pink-100 px-2 py-0.5 text-[11px] font-bold text-pink-700 dark:bg-pink-950 dark:text-pink-300">
                      <MessageCircle className="h-3 w-3" /> {w.ile}
                    </span>
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
