'use client';

import Link from 'next/link';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import type { MyEventRow } from '@/lib/myEvents';

/** The dashboard's hero slot: the single match the user is actually playing
 *  next, picked by lib/myEvents.ts#nextMatch(). Answers the one question a
 *  returning user has ("what and when am I playing") without scrolling.
 *
 *  Wypełniony stan renderuje EventBrowseCard — ten sam styl co reszta kart
 *  na /moje-gry ("Twoje najbliższe mecze"), zamiast osobnego, większego
 *  markupu. Przycisk „Udostępnij" znika razem z tym — mecz nadal da się
 *  udostępnić ze strony szczegółów. */
export default function NextMatchCard({ row }: { row: MyEventRow | null }) {
  if (!row) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
        <p className="mb-2 text-2xl">⚽</p>
        <p className="mb-1 text-sm font-semibold text-slate-700">Nie masz zaplanowanych gier</p>
        <p className="mb-4 text-sm text-slate-500">
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
            href="/wydarzenia"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Znajdź grę
          </Link>
        </div>
        {/* Uprzedzenie zamiast rozczarowania: kto kliknie „Znajdź grę" i trafi
            na pustą listę, drugi raz nie kliknie. Lepiej powiedzieć wprost, że
            Bojo dopiero się rozkręca, i pokazać szybszą ścieżkę. */}
        <p className="mt-3 text-xs text-slate-400">
          Bojo dopiero się rozkręca — otwartych gier bywa mało. Najszybciej zagrasz,
          tworząc mecz i wysyłając link ekipie.
        </p>
      </div>
    );
  }

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">
        Najbliższy mecz
      </span>
      <div className="mt-2">
        <EventBrowseCard event={row.event} relation={row.relation} />
      </div>
    </div>
  );
}
