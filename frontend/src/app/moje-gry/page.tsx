'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO, isFuture, isToday } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, MapPin, Users, ChevronRight, LogIn } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { getMyParticipatedEvents } from '@/lib/events';
import type { EventItem } from '@/types';

const SPORT_EMOJI: Record<string, string> = {
  'piłka nożna': '⚽', koszykówka: '🏀', siatkówka: '🏐',
  'siatkówka plażowa': '🏖️', futsal: '⚡', 'piłka ręczna': '🤾', inne: '🏅',
};

function isUpcoming(event: EventItem): boolean {
  try {
    const [y, m, d] = event.date.split('-').map(Number);
    const eventDate = new Date(y, m - 1, d);
    return isFuture(eventDate) || isToday(eventDate);
  } catch { return false; }
}

function EventCard({ event, isOrganizer }: { event: EventItem; isOrganizer: boolean }) {
  let dateStr = event.date;
  try { dateStr = format(parseISO(event.date), 'EEE, d MMM', { locale: pl }); } catch {}

  const cancelled = event.status === 'cancelled';

  return (
    <Link href={`/wydarzenia/${event.id}`} className="block group">
      <div className={[
        'bg-white rounded-xl border p-4 flex items-center gap-4 hover:shadow-md transition-shadow',
        cancelled ? 'border-red-100 opacity-60' : 'border-gray-100',
      ].join(' ')}>
        <span className="text-2xl shrink-0" role="img">{SPORT_EMOJI[event.sport] ?? '🏅'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {event.title || event.sport}
            {cancelled && <span className="ml-2 text-xs text-red-500 font-normal">Odwołane</span>}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />{dateStr} {event.time?.slice(0, 5)}
            </span>
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />{event.fieldName}
            </span>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {isOrganizer && (
            <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium">
              Org.
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
        </div>
      </div>
    </Link>
  );
}

function Section({
  title, events, isOrganizer, emptyText,
}: {
  title: string;
  events: { event: EventItem; isOrganizer: boolean }[];
  isOrganizer?: boolean;
  emptyText: string;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h2>
      {events.length === 0
        ? <p className="text-sm text-gray-400 py-4 text-center">{emptyText}</p>
        : (
          <div className="space-y-2">
            {events.map(({ event, isOrganizer: org }) => (
              <EventCard key={event.id} event={event} isOrganizer={isOrganizer ?? org} />
            ))}
          </div>
        )}
    </section>
  );
}

export default function MojeGryPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [items, setItems] = useState<{ event: EventItem; isOrganizer: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getMyParticipatedEvents(user.id)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const upcomingAsParticipant = items.filter(
    ({ event, isOrganizer }) => isUpcoming(event) && !isOrganizer,
  );
  const upcomingAsOrganizer = items.filter(
    ({ event, isOrganizer }) => isUpcoming(event) && isOrganizer,
  );
  const history = items.filter(({ event }) => !isUpcoming(event));

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <Users className="w-10 h-10 mx-auto mb-4 text-gray-300" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Moje gry</h1>
            <p className="text-gray-500 text-sm mb-6">Zaloguj się, aby zobaczyć swoje gry.</p>
            <Button onClick={() => signInWithGoogle()} className="inline-flex items-center gap-2">
              <LogIn className="w-4 h-4" /> Zaloguj się
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Moje gry</h1>
          <Link href="/wydarzenia/nowe">
            <Button size="sm">+ Nowa gra</Button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white rounded-xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <Section
              title="Nadchodzące — biorę udział"
              events={upcomingAsParticipant}
              emptyText="Brak nadchodzących gier jako uczestnik."
            />
            <Section
              title="Nadchodzące — organizuję"
              events={upcomingAsOrganizer}
              emptyText="Nie organizujesz żadnych nadchodzących gier."
            />
            <Section
              title="Historia"
              events={history}
              emptyText="Brak rozegranych gier."
            />
          </>
        )}
      </main>
    </div>
  );
}
