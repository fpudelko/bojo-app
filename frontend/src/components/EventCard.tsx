import Link from 'next/link';
import { format, parseISO, isFuture, isToday } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, MapPin, ChevronRight } from 'lucide-react';
import type { EventItem } from '@/types';
import { sportEmoji } from '@/lib/sports';

/** @deprecated Import sportEmoji from @/lib/sports instead */
export const SPORT_EMOJI: Record<string, string> = new Proxy({}, {
  get: (_, sport) => typeof sport === 'string' ? sportEmoji(sport) : '🏅',
}) as Record<string, string>;

export function isUpcoming(event: EventItem): boolean {
  try {
    const [y, m, d] = event.date.split('-').map(Number);
    const eventDate = new Date(y, m - 1, d);
    return isFuture(eventDate) || isToday(eventDate);
  } catch { return false; }
}

export function EventCard({ event, isOrganizer }: { event: EventItem; isOrganizer: boolean }) {
  let dateStr = event.date;
  try { dateStr = format(parseISO(event.date), 'EEE, d MMM', { locale: pl }); } catch {}

  const cancelled = event.status === 'cancelled';

  return (
    <Link href={`/wydarzenia/${event.id}`} className="block group">
      <div className={[
        'bg-white rounded-2xl border p-4 flex items-center gap-4 transition-all duration-200',
        cancelled
          ? 'border-red-100 opacity-60'
          : 'border-slate-200/80 shadow-card hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-card-hover',
      ].join(' ')}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-canvas text-2xl" role="img">
          {sportEmoji(event.sport)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">
            {event.title || event.sport}
            {cancelled && <span className="ml-2 text-xs text-red-500 font-normal">Odwołane</span>}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />{dateStr} {event.time?.slice(0, 5)}
            </span>
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />{event.fieldName}
            </span>
          </div>
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
