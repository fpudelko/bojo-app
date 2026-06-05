'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogIn, Users } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { getMyParticipatedEvents } from '@/lib/events';
import { EventCard, isUpcoming } from '@/components/EventCard';
import type { EventItem } from '@/types';

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
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h2>
      {events.length === 0
        ? <p className="rounded-2xl border border-dashed border-slate-200 bg-white/50 py-6 text-center text-sm text-slate-400">{emptyText}</p>
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
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
              <Users className="w-7 h-7 text-primary-700" />
            </div>
            <h1 className="font-display text-2xl font-bold text-ink mb-2">Moje gry</h1>
            <p className="text-slate-500 text-sm mb-6">Zaloguj się, aby zobaczyć swoje gry.</p>
            <Button onClick={() => signInWithGoogle()} className="inline-flex items-center gap-2">
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

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[76px] bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
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
