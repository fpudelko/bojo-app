import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, MapPin, ChevronRight } from 'lucide-react';
import type { EventItem } from '@/types';
import { sportEmoji } from '@/lib/sports';
import { eventLocation } from '@/lib/utils';
import { eventDisplayTitle } from '@/lib/eventTitle';

/** @deprecated Import sportEmoji from @/lib/sports instead */
export const SPORT_EMOJI: Record<string, string> = new Proxy({}, {
  get: (_, sport) => typeof sport === 'string' ? sportEmoji(sport) : '🏅',
}) as Record<string, string>;

// Re-exported for backward compatibility — the implementations now live in
// lib/eventDates.ts so non-component code (dashboard hooks) can import them
// without reaching into a component file. Import from '@/lib/eventDates' in
// new code.
export { isUpcoming, isEventJoinable } from '@/lib/eventDates';

export function EventCard({ event, isOrganizer }: { event: EventItem; isOrganizer: boolean }) {
  let dayLabel = '';
  try {
    const d = parseISO(event.date);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const evDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((evDay.getTime() - now.getTime()) / 86400000);
    if (diff === 0) dayLabel = 'Dziś';
    else if (diff === 1) dayLabel = 'Jutro';
    else dayLabel = format(d, 'EEE, d MMM', { locale: pl });
  } catch {}

  const cancelled = event.status === 'cancelled';

  return (
    <Link href={`/wydarzenia/${event.id}`} className="block group">
      <div className={[
        'bg-white rounded-2xl border p-4 flex items-center gap-3 transition-all duration-200',
        cancelled
          ? 'border-red-100 opacity-60'
          : 'border-slate-200/80 shadow-card hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-card-hover',
      ].join(' ')}>
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-2xl"
          role="img"
          aria-label={event.sport}
        >
          {sportEmoji(event.sport)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">
            {eventDisplayTitle(event)}
            {cancelled && <span className="ml-2 text-xs text-red-500 font-normal">Odwołane</span>}
          </p>
          <p className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
            <Calendar className="w-3 h-3 shrink-0" />
            {dayLabel}{event.time ? `, ${event.time.slice(0, 5)}` : ''}
          </p>
          <p className="flex items-center gap-1 mt-0.5 text-xs text-slate-500 truncate">
            <MapPin className="w-3 h-3 shrink-0" />
            {eventLocation(event).primary}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {isOrganizer && (
            <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium">
              Org.
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600" />
        </div>
      </div>
    </Link>
  );
}
