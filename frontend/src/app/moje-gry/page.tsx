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

export default function MojeGryPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<{ event: EventItem; isOrganizer: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getMyParticipatedEvents(user.id)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const upcoming = items.filter(({ event }) => isUpcoming(event));
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
            <h1 className="font-display text-2xl font-bold text-ink mb-2">Twoje mecze</h1>
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
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Twoje mecze</h1>
          <Link href="/wydarzenia/nowe">
            <Button size="sm">+ Nowa gra</Button>
          </Link>
        </div>

        {/* Stałe gierki link */}
        <Link
          href="/cykliczne"
          className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm hover:border-primary-200 hover:shadow-md transition-all group"
        >
          <span className="text-sm font-semibold text-ink">🔁 Stałe gierki</span>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-600 transition-colors" />
        </Link>

        {/* Tabs */}
        <div className="border-b border-slate-100">
          <div className="flex gap-6">
            <button
              onClick={() => setTab('upcoming')}
              className={`pb-2.5 text-sm transition-colors ${
                tab === 'upcoming'
                  ? 'border-b-2 border-primary-700 text-primary-700 font-semibold'
                  : 'text-slate-500 hover:text-ink'
              }`}
            >
              Nadchodzące
            </button>
            <button
              onClick={() => setTab('history')}
              className={`pb-2.5 text-sm transition-colors ${
                tab === 'history'
                  ? 'border-b-2 border-primary-700 text-primary-700 font-semibold'
                  : 'text-slate-500 hover:text-ink'
              }`}
            >
              Historia
            </button>
          </div>
        </div>

        {/* Tab content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[76px] bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
            ))}
          </div>
        ) : tab === 'upcoming' ? (
          upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <span className="text-5xl">⚽</span>
              <p className="text-base font-semibold text-ink">Brak gier w kalendarzu</p>
              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <Link href="/wydarzenia">
                  <Button size="sm">Znajdź grę dziś</Button>
                </Link>
                <Link href="/wydarzenia/nowe">
                  <Button size="sm" variant="outline">Stwórz mecz</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map(({ event, isOrganizer }) => (
                <div key={event.id} className="relative">
                  {isOrganizer && (
                    <span className="absolute top-2 right-2 z-10 text-[10px] font-bold bg-primary-50 text-primary-700 border border-primary-100 rounded-full px-2 py-0.5 pointer-events-none">
                      Organizujesz
                    </span>
                  )}
                  <EventCard event={event} isOrganizer={isOrganizer} />
                </div>
              ))}
            </div>
          )
        ) : (
          history.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-12">Brak historii gier</p>
          ) : (
            <div className="space-y-2">
              {history.map(({ event, isOrganizer }) => (
                <div key={event.id} className="relative">
                  {isOrganizer && (
                    <span className="absolute top-2 right-2 z-10 text-[10px] font-bold bg-primary-50 text-primary-700 border border-primary-100 rounded-full px-2 py-0.5 pointer-events-none">
                      Organizujesz
                    </span>
                  )}
                  <EventCard event={event} isOrganizer={isOrganizer} />
                </div>
              ))}
            </div>
          )
        )}

      </main>
    </div>
  );
}
