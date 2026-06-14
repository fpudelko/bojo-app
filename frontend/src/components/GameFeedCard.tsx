'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Clock, MapPin, ArrowRight } from 'lucide-react';
import type { EventItem } from '@/types';
import { sportEmoji, sportColor, sportLabel } from '@/lib/sports';
import { eventLocation } from '@/lib/utils';
import { timeUntil } from './EventListCard';

/** "6v6" / "· 10 os." size suffix for an untitled game. */
function sizeSuffix(max: number): string {
  if (max <= 0) return '';
  if (max % 2 === 0) return ` ${max / 2}v${max / 2}`;
  return ` · ${max} os.`;
}

/** Rich, conversion-focused game card for the public feed.
 *  Player count is the visual hero; a prominent "Dołącz" CTA drives joins. */
export function GameFeedCard({ event }: { event: EventItem }) {
  const color = sportColor(event.sport);
  const emoji = sportEmoji(event.sport);

  const max = event.maxPlayers ?? 0;
  const taken = (event.participantsCount ?? 0) + (event.externalCount ?? 0);
  const left = max > 0 ? Math.max(0, max - taken) : 0;
  const full = max > 0 && taken >= max;
  const pct = max > 0 ? Math.min(100, Math.round((taken / max) * 100)) : 0;
  const barColor = full ? '#ef4444' : pct >= 80 ? '#f59e0b' : color;

  // Date / time label
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

  const location = eventLocation(event).primary;
  const title = event.title || `${sportLabel(event.sport)}${sizeSuffix(max)}`;

  const costGrosze = event.costGrosze ?? 0;
  const free = costGrosze <= 0;
  const priceLabel = free
    ? 'Za darmo'
    : `${(costGrosze / 100).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} zł`;

  return (
    <Link
      href={`/wydarzenia/${event.id}`}
      className="block rounded-2xl bg-white p-4 ring-1 ring-slate-100 shadow-[0_2px_8px_rgba(20,40,30,0.04),0_8px_24px_-8px_rgba(20,40,30,0.10)] transition-shadow hover:shadow-[0_4px_12px_rgba(20,40,30,0.06),0_12px_32px_-10px_rgba(20,40,30,0.16)] active:scale-[0.995]"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
          style={{ backgroundColor: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}22` }}
          aria-hidden="true"
        >
          {emoji}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-bold leading-tight text-ink line-clamp-2">{title}</h3>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                free ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {priceLabel}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              {dayLabel}{timeLabel ? ` · ${timeLabel}` : ''}
              {until && <span className="ml-0.5 font-semibold text-amber-600">({until})</span>}
            </span>
            {location && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="truncate">{location}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Player count — the visual focus */}
      {max > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-end justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold tabular-nums text-ink">{taken}/{max}</span>
              <span className="text-sm font-medium text-slate-500">graczy</span>
            </div>
            {full ? (
              <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-500">Komplet</span>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700">
                brak {left}
              </span>
            )}
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: barColor }}
              role="progressbar"
              aria-valuenow={taken}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-label={`${taken} z ${max} graczy`}
            />
          </div>
        </div>
      )}

      <div
        className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-base font-bold transition-colors ${
          full
            ? 'cursor-not-allowed bg-slate-100 text-slate-400'
            : 'bg-primary-700 text-white hover:bg-primary-800'
        }`}
      >
        {full ? 'Komplet' : 'Dołącz'}
        {!full && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
      </div>
    </Link>
  );
}
