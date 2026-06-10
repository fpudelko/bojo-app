'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Clock, MapPin, Navigation } from 'lucide-react';
import type { EventItem } from '@/types';
import { sportEmoji } from '@/lib/sports';

const SPORT_SHORT: Record<string, string> = {
  'piłka nożna': 'Piłka',
  'siatkówka plażowa': 'Plaża',
  'siatkówka': 'Siatka',
  'koszykówka': 'Kosz',
};

/** "Piłka 6v6" / "Siatka 4v4" for even counts, else "Piłka · N os." */
export function formatLabel(sport: string, max: number): string {
  const short = SPORT_SHORT[sport] ?? sport;
  if (max > 0 && max % 2 === 0) return `${short} ${max / 2}v${max / 2}`;
  return max > 0 ? `${short} · ${max} os.` : short;
}

/** "za 2 h" / "za 30 min" within 24h, else null */
export function timeUntil(date: string, time?: string): string | null {
  if (!time) return null;
  try {
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    const ms = new Date(y, m - 1, d, h, min).getTime() - Date.now();
    if (ms <= 0 || ms > 24 * 3600_000) return null;
    const hours = ms / 3600_000;
    if (hours < 1) return `za ${Math.round(hours * 60)} min`;
    return `za ${Math.round(hours)} h`;
  } catch { return null; }
}

function DistanceBadge({ km }: { km: number }) {
  const label = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  return (
    <span className="text-xs text-primary-700 font-medium flex items-center gap-1">
      <Navigation className="w-3 h-3" /> {label}
    </span>
  );
}

export function EventListCard({ event, distance }: { event: EventItem; distance?: number }) {
  let timeLabel = '';
  let dayLabel = '';
  try {
    const d = parseISO(event.date);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const evDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((evDay.getTime() - now.getTime()) / 86400000);
    if (diff === 0) dayLabel = 'Dzisiaj';
    else if (diff === 1) dayLabel = 'Jutro';
    else dayLabel = format(d, 'EEE d MMM', { locale: pl });
  } catch {}
  if (event.time) timeLabel = event.time.slice(0, 5);

  const taken = (event.participantsCount ?? 0) + (event.externalCount ?? 0);
  const max = event.maxPlayers ?? 0;
  const isFull = max > 0 && taken >= max;
  const fillPct = max > 0 ? Math.min(100, Math.round((taken / max) * 100)) : 0;
  const fillColor = isFull ? 'bg-red-400' : fillPct >= 80 ? 'bg-amber-400' : 'bg-primary-600';
  const until = timeUntil(event.date, event.time ?? undefined);

  const location = event.district
    ? `${event.district}, Poznań`
    : (event.fieldName && !/^\d+$/.test(event.fieldName.trim()) ? event.fieldName : null);

  const costGrosze = event.costGrosze ?? 0;
  const priceLabel = costGrosze > 0
    ? `${(costGrosze / 100).toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} zł`
    : 'Za darmo';
  const priceClass = costGrosze > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700';

  const fmt = formatLabel(event.sport, max);

  return (
    <Link href={`/wydarzenia/${event.id}`} className="block active:scale-[0.99] transition-transform">
      <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        {/* Countdown badge — top-right corner */}
        {until && (
          <span className="absolute top-3 right-3 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
            {until}
          </span>
        )}

        {/* Title + format/price */}
        <div className="flex items-start gap-2.5 pr-14">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${fillColor}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink leading-snug truncate">
              {event.title || `${sportEmoji(event.sport)} ${event.sport}`}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5">
                {sportEmoji(event.sport)} {fmt}
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${priceClass}`}>
                {priceLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Date + location */}
        <div className="ml-5 mt-2.5 space-y-1">
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            {dayLabel}{timeLabel ? ` ${timeLabel}` : ''}
          </p>
          {location && (
            <p className="text-sm text-slate-500 flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              {location}
            </p>
          )}
        </div>

        {/* Progress + CTA */}
        <div className="ml-5 mt-3 flex items-end gap-3">
          <div className="flex-1 min-w-0">
            {max > 0 && (
              <>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${fillColor}`} style={{ width: `${fillPct}%` }} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400">{taken} z {max} graczy</span>
                  {distance !== undefined && <DistanceBadge km={distance} />}
                </div>
              </>
            )}
            {max === 0 && distance !== undefined && <DistanceBadge km={distance} />}
          </div>
          <span className={[
            'shrink-0 px-4 py-1.5 rounded-xl text-sm font-bold whitespace-nowrap',
            isFull
              ? 'bg-slate-100 text-slate-400'
              : fillPct >= 80
                ? 'bg-amber-500 text-white'
                : 'bg-primary-700 text-white',
          ].join(' ')}>
            {isFull ? 'Pełne' : 'Dołącz'}
          </span>
        </div>
      </div>
    </Link>
  );
}
