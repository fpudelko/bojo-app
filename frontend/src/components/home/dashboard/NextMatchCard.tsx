'use client';

import Link from 'next/link';
import { ArrowRight, Crown, MapPin, Share2 } from 'lucide-react';
import { matchWhenLabel, timeUntil } from '@/lib/eventDates';
import { sportColor } from '@/lib/sports';
import { eventLocation } from '@/lib/utils';
import { eventDisplayTitle } from '@/lib/eventTitle';
import { useToast } from '@/lib/toast';
import type { MyEventRow } from '@/lib/myEvents';

/** The dashboard's hero slot: the single match the user is actually playing
 *  next, picked by lib/myEvents.ts#nextMatch(). Answers the one question a
 *  returning user has ("what and when am I playing") without scrolling. */
export default function NextMatchCard({ row }: { row: MyEventRow | null }) {
  const { toast } = useToast();

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
      </div>
    );
  }

  const { event, relation } = row;
  const color = sportColor(event.sport);
  const title = eventDisplayTitle(event);
  const when = matchWhenLabel(event.date, event.time);
  const until = timeUntil(event.date, event.time);
  const location = eventLocation(event).primary;

  const max = event.maxPlayers ?? 0;
  const taken = event.participantsCount ?? 0;
  const full = max > 0 && taken >= max;
  const pct = max > 0 ? Math.min(100, Math.round((taken / max) * 100)) : 0;

  const share = async () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/wydarzenia/${event.id}` : '';
    const text = `${title} — dołączasz? ${when}`;
    if (navigator.share) {
      await navigator.share({ title, text, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {});
      toast('Skopiowano link do meczu');
    }
  };

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">
        Najbliższy mecz
      </span>
      <div
        className="mt-2 rounded-2xl bg-white p-5 shadow-card"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate font-display text-lg font-bold text-ink">{title}</h3>
          {relation.isOrganizer && (
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-700">
              <Crown className="h-3.5 w-3.5" aria-hidden="true" /> Organizujesz
            </span>
          )}
        </div>

        <p className="mt-1.5 text-sm text-slate-500">
          <span className={until ? 'font-semibold text-amber-600' : ''}>{when}</span>
          {until && ` · ${until}`}
        </p>
        {location && (
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {location}
          </p>
        )}

        {max > 0 && (
          <div className="mt-3 flex items-center gap-2.5">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: full ? '#dc2626' : color }}
              />
            </div>
            <span className="shrink-0 text-xs font-semibold text-slate-600">{taken}/{max} graczy</span>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Link
            href={`/wydarzenia/${event.id}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800"
          >
            Szczegóły <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <button
            onClick={share}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> Udostępnij
          </button>
        </div>
      </div>
    </div>
  );
}
