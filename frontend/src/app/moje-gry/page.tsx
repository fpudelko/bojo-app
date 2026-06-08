'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogIn, Users, ChevronRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { getMyParticipatedEvents } from '@/lib/events';
import { EventCard, isUpcoming } from '@/components/EventCard';
import type { EventItem } from '@/types';

function Section({
  title, events,
}: {
  title: string;
  events: { event: EventItem; isOrganizer: boolean }[];
}) {
  if (events.length === 0) return null;
  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h2>
      <div className="space-y-2">
        {events.map(({ event, isOrganizer }) => (
          <EventCard key={event.id} event={event} isOrganizer={isOrganizer} />
        ))}
      </div>
    </section>
  );
}

export default function MojeGryPage() {
  const { user, loading: authLoading } = useAuth();
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
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
              <Users className="w-7 h-7 text-primary-700" />
            </div>
            <h1 className="font-display text-2xl font-bold text-ink mb-2">Moje gry</h1>
            <p className="text-slate-500 text-sm mb-6">Zaloguj się, aby zobaczyć swoje gry.</p>
            <Button onClick={() => { window.location.href = `/logowanie?next=${encodeURIComponent(window.location.pathname)}`; }} className="inline-flex items-center gap-2">
              <LogIn className="w-4 h-4" /> Zaloguj się
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Moje gry</h1>
          <Link href="/wydarzenia/nowe">
            <Button size="sm">+ Nowa gra</Button>
          </Link>
        </div>

        <Link
          href="/cykliczne"
          className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-card hover:border-primary-200 hover:shadow-card-hover transition-all group"
        >
          <span className="text-sm font-semibold text-ink">🔁 Stałe gierki</span>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-600 transition-colors" />
        </Link>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[76px] bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <Section title="Nadchodzące — gram" events={upcomingAsParticipant} />
            <Section title="Nadchodzące — organizuję" events={upcomingAsOrganizer} />
            <Section title="Historia" events={history} />
            {!loading && items.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8">Nie masz jeszcze żadnych gier.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
