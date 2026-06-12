'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Clock, MapPin, Navigation } from 'lucide-react';
import type { EventItem } from '@/types';
import { sportEmoji } from '@/lib/sports';
import { eventLocation } from '@/lib/utils';

/** How the current user relates to this event — drives the CTA. */
export type EventRelation = 'organizer' | 'going' | 'reserve';

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

/** Just the size suffix — "6v6", "· 10 os." — no sport name prefix */
function formatSize(max: number): string {
  if (max <= 0) return '';
  if (max % 2 === 0) return ` ${max / 2}v${max / 2}`;
  return ` · ${max} os.`;
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

export function EventListCard({ event, distance, relation }: { event: EventItem; distance?: number; relation?: EventRelation }) {
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

  const location = eventLocation(event).primary;

  const costGrosze = event.costGrosze ?? 0;
  const priceLabel = costGrosze > 0
    ? `${(costGrosze / 100).toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} zł`
    : 'Za darmo';
  const priceClass = costGrosze > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700';

  const fmt = formatLabel(event.sport, max);

  const borderAccent =
    relation === 'organizer' ? 'border-l-primary-500' :
    relation === 'going'     ? 'border-l-green-500' :
    relation === 'reserve'   ? 'border-l-amber-400' :
    'border-l-transparent';

  return (
    <Link href={`/wydarzenia/${event.id}`} className="block active:scale-[0.99] transition-transform">
      <div className={`relative bg-white rounded-2xl border border-slate-100 border-l-4 ${borderAccent} shadow-sm px-4 py-3.5`}>

        {/* Row 1: sport emoji + title + price */}
        <div className="flex items-center gap-2.5">
          <span className="text-xl leading-none shrink-0">{sportEmoji(event.sport)}</span>
          <p className="font-semibold text-ink leading-snug truncate flex-1">
            {event.title || `${event.sport}${formatSize(max)}`}
          </p>
          <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${priceClass}`}>
            {priceLabel}
          </span>
        </div>

        {/* Row 2: date/time + location */}
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3 text-slate-400" />
            {dayLabel}{timeLabel ? ` · ${timeLabel}` : ''}
            {until && <span className="ml-1 font-semibold text-amber-600">({until})</span>}
          </span>
          {location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          )}
        </div>

        {/* Row 3: progress bar + slots + distance */}
        {max > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${fillColor}`} style={{ width: `${fillPct}%` }} />
            </div>
            <span className={`text-xs font-semibold ${isFull ? 'text-red-500' : 'text-slate-400'}`}>
              {taken}/{max}
            </span>
            {distance !== undefined && <DistanceBadge km={distance} />}
          </div>
        )}
        {max === 0 && distance !== undefined && (
          <div className="mt-2"><DistanceBadge km={distance} /></div>
        )}
      </div>
    </Link>
  );
}
