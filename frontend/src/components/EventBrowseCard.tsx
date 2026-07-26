'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Clock, MapPin, Crown } from 'lucide-react';
import type { EventItem } from '@/types';
import type { MyEventStatus, MyEventRelation } from '@/lib/events';
import { sportEmoji, sportColor } from '@/lib/sports';
import { eventLocation } from '@/lib/utils';
import { timeUntil } from './EventListCard';
import { isUpcoming } from './EventCard';

function sizeSuffix(max: number): string {
  if (max <= 0) return '';
  if (max % 2 === 0) return ` ${max / 2}v${max / 2}`;
  return ` · ${max} os.`;
}

/**
 * Participation status → the bottom-right slot, where "Dołącz →" normally sits.
 * This is "my standing / what's next", one value at a time.
 *
 * Ownership is deliberately NOT in here: it's a separate axis rendered as a tag
 * in the meta row, so a match you organize AND play shows both.
 */
const STATUS_CHIP: Partial<Record<MyEventStatus, { label: string; cls: string }>> = {
  playing:   { label: 'Grasz ✓',              cls: 'bg-green-50 text-green-700 border-green-200' },
  reserve:   { label: 'Rezerwa',              cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  observing: { label: 'Obserwujesz',          cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending:   { label: 'Czeka na akceptację',  cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  invited:   { label: 'Zaproszenie →',        cls: 'bg-accent-100 text-primary-900 border-accent-200' },
};

// Past-tense labels for the history tab — "Grasz ✓" on an already-played match
// reads wrong, so a match that has happened gets its own wording.
const PAST_STATUS_CHIP: Partial<Record<MyEventStatus, { label: string; cls: string }>> = {
  playing:   { label: 'Zagrałeś',       cls: 'bg-green-50 text-green-700 border-green-200' },
  reserve:   { label: 'Byłeś rezerwą',  cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  observing: { label: 'Obserwowałeś',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending:   { label: 'Nie zaakceptowano', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

/** Compact list-view card with left sport-color border accent. Used on /wydarzenia. */
export function EventBrowseCard({ event, distance, relation }: {
  event: EventItem; distance?: number; relation?: MyEventRelation;
}) {
  const color = sportColor(event.sport);
  const emoji = sportEmoji(event.sport);

  const max = event.maxPlayers ?? 0;
  const taken = event.participantsCount ?? 0;
  const left = max > 0 ? Math.max(0, max - taken) : 0;
  const full = max > 0 && taken >= max;
  const pct = max > 0 ? Math.min(100, Math.round((taken / max) * 100)) : 0;
  const barColor = full ? '#dc2626' : color;

  let dayLabel = '';
  try {
    const d = parseISO(event.date);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const evDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((evDay.getTime() - now.getTime()) / 86400000);
    if (diff === 0) dayLabel = 'Dzisiaj';
    else if (diff === 1) dayLabel = 'Jutro';
    else dayLabel = format(d, 'EEE d MMM', { locale: pl });
  } catch { /* ignore */ }
  const timeLabel = event.time ? event.time.slice(0, 5) : '';
  const until = timeUntil(event.date, event.time ?? undefined);
  const soon = until !== null;
  const cancelled = event.status === 'cancelled';
  const past = cancelled || !isUpcoming(event);
  const statusChip = relation ? (past ? PAST_STATUS_CHIP : STATUS_CHIP)[relation.status] : undefined;

  const location = eventLocation(event).primary;
  const title = event.title || `${event.sport}${sizeSuffix(max)}`;
  const costGrosze = event.costGrosze ?? 0;
  const free = costGrosze <= 0;
  const priceLabel = free
    ? 'Za darmo'
    : `${(costGrosze / 100).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} zł`;

  return (
    <Link
      href={`/wydarzenia/${event.id}`}
      className={`flex overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-slate-100 dark:ring-slate-700 transition-shadow active:scale-[0.995] ${past ? 'opacity-60' : 'hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]'}`}
      style={{ borderLeft: `4px solid ${past ? '#94a3b8' : color}` }}
    >
      <div className="flex-1 p-3">
        {/* top: icon + title + price */}
        <div className="flex items-start gap-2.5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
            style={{ backgroundColor: `${color}1a`, boxShadow: `inset 0 0 0 1px ${color}33` }}
            aria-hidden="true"
          >
            {emoji}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{title}</h3>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                free ? 'bg-green-50 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {priceLabel}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              {/* Ownership tag — a property of the match, not a status. Lives in
                  the meta row so it never competes with the CTA slot below. */}
              {relation?.isOrganizer && (
                <span className="flex items-center gap-1 font-semibold text-primary-700">
                  <Crown className="h-3 w-3 shrink-0" />
                  Organizujesz
                </span>
              )}
              <span className={`flex items-center gap-1 font-medium ${soon ? 'text-amber-600' : 'text-slate-500'}`}>
                <Clock className="h-3 w-3" />
                {dayLabel}{timeLabel ? ` · ${timeLabel}` : ''}
                {until && ` · ${until}`}
              </span>
              {location && (
                <span className="flex items-center gap-1 text-slate-500">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[120px]">{location}</span>
                </span>
              )}
              {distance !== undefined && (
                <span className="text-primary-700 font-medium">
                  {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* progress / past indicator */}
        {past ? (
          <div className="mt-2.5 flex items-center gap-2">
            {cancelled ? (
              <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Anulowany</span>
            ) : (
              <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Rozegrany</span>
            )}
            {max > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400">{taken} graczy</span>
            )}
            {statusChip && (
              <span className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusChip.cls}`}>
                {statusChip.label}
              </span>
            )}
          </div>
        ) : max > 0 ? (
          <>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{taken}/{max} graczy</span>
              <div className="flex items-center gap-3">
                {full ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">Komplet</span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                    {left === 1 ? '1 wolne miejsce' : left < 5 ? `${left} wolne miejsca` : `${left} wolnych miejsc`}
                  </span>
                )}
                {statusChip ? (
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusChip.cls}`}>
                    {statusChip.label}
                  </span>
                ) : !full && (
                  <span className="text-xs font-bold text-primary-700">Dołącz →</span>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Link>
  );
}
