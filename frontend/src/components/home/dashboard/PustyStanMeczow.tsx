'use client';

import Link from 'next/link';
import WczesnyEtapBadge from '../landing/WczesnyEtapBadge';

/**
 * „Nie masz zaplanowanych gier" — jedyne, co zostało z dawnego `NextMatchCard`.
 *
 * Karta „NAJBLIŻSZY MECZ" wyróżniała jeden mecz nad listą i została usunięta
 * (2026-08-24, zgłoszone wprost): przy podziale na „Grasz" / „Organizujesz"
 * pierwszy element pierwszej sekcji I TAK jest najbliższym meczem, więc osobny
 * nagłówek nad nim mówił to, co lista mówi sama.
 *
 * Pusty stan przeżył, bo odpowiada na inne pytanie niż lista — „nie mam nic,
 * co teraz?" — i niesie dwie drogi wyjścia zamiast pustki.
 */
export default function PustyStanMeczow() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-800/40">
      <p className="mb-2 text-2xl">⚽</p>
      <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Nie masz zaplanowanych gier</p>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Wrzuć własny mecz albo dołącz do otwartej gry w okolicy.
      </p>
      <div className="flex flex-col justify-center gap-2 sm:flex-row">
        <Link
          href="/wydarzenia/nowe"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-2 text-sm font-bold text-primary-950 hover:bg-accent-400"
        >
          Stwórz mecz
        </Link>
        <Link
          href="/mapa?gry=1"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Znajdź grę <WczesnyEtapBadge />
        </Link>
      </div>
      {/* Uprzedzenie zamiast rozczarowania: kto kliknie „Znajdź grę" i trafi
          na pustą listę, drugi raz nie kliknie. Lepiej powiedzieć wprost, że
          Bojo dopiero się rozkręca, i pokazać szybszą ścieżkę. */}
      <p className="mt-3 text-xs text-slate-400">
        Bojo dopiero się rozkręca — otwartych gier bywa mało. Najszybciej zagrasz,
        tworząc mecz i wysyłając link znajomym.
      </p>
    </div>
  );
}
