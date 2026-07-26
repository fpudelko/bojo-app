'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogIn, Users, ChevronRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { getMyParticipatedEvents, type MyEventRole } from '@/lib/events';
import { isUpcoming } from '@/components/EventCard';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { SHOW_RECURRING } from '@/lib/features';
import type { EventItem } from '@/types';

export default function MojeGryPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<{ event: EventItem; isOrganizer: boolean; role: MyEventRole }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoadError(false);
    getMyParticipatedEvents(user.id)
      .then(setItems)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [user]);

  // Cancelled games never count as "upcoming" — they drop into History so the
  // calendar only shows games that are actually happening.
  const upcoming = items.filter(({ event }) => event.status !== 'cancelled' && isUpcoming(event));
  const history = items.filter(({ event }) => event.status === 'cancelled' || !isUpcoming(event));
  // Observing is split out: seeing it next to real sign-ups reads as "I'm in".
  const playing = upcoming.filter(({ role }) => role !== 'observing');
  const observing = upcoming.filter(({ role }) => role === 'observing');

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
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Zaloguj się, aby zobaczyć swoje mecze.</p>
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
            <Button size="sm">+ Nowy mecz</Button>
          </Link>
        </div>

        {/* Stałe gierki link */}
        {SHOW_RECURRING && (
          <Link
            href="/cykliczne"
            className="flex items-center justify-between rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 px-4 py-3.5 shadow-sm hover:border-primary-200 hover:shadow-md transition-all group"
          >
            <span className="text-sm font-semibold text-ink">🔁 Stałe gierki</span>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary-600 transition-colors" />
          </Link>
        )}

        {/* Tabs */}
        <div className="border-b border-slate-100 dark:border-slate-700">
          <div className="flex gap-6">
            <button
              onClick={() => setTab('upcoming')}
              className={`pb-2.5 text-sm transition-colors ${
                tab === 'upcoming'
                  ? 'border-b-2 border-primary-700 text-primary-700 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-ink dark:hover:text-slate-100'
              }`}
            >
              Nadchodzące
            </button>
            <button
              onClick={() => setTab('history')}
              className={`pb-2.5 text-sm transition-colors ${
                tab === 'history'
                  ? 'border-b-2 border-primary-700 text-primary-700 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-ink dark:hover:text-slate-100'
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
              <div key={i} className="h-[76px] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <span className="text-4xl">⚠️</span>
            <p className="text-base font-semibold text-ink">Nie udało się załadować meczy</p>
            <button onClick={() => { setLoading(true); setLoadError(false); getMyParticipatedEvents(user!.id).then(setItems).catch(() => setLoadError(true)).finally(() => setLoading(false)); }} className="text-sm font-semibold text-primary-700 hover:text-primary-800">Spróbuj ponownie</button>
          </div>
        ) : tab === 'upcoming' ? (
          upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <span className="text-5xl">⚽</span>
              <p className="text-base font-semibold text-ink">Brak meczy w kalendarzu</p>
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
            <div className="space-y-6">
              {/* Playing — an actual spot in the squad */}
              {playing.length > 0 && (
                <section className="space-y-3">
                  {observing.length > 0 && (
                    <h2 className="text-sm font-semibold text-ink">Grasz</h2>
                  )}
                  {playing.map(({ event, role }) => (
                    <EventBrowseCard key={event.id} event={event} myStatus={role} />
                  ))}
                </section>
              )}

              {/* Observing — deliberately separate so it never reads as "signed up" */}
              {observing.length > 0 && (
                <section className="space-y-3">
                  <div>
                    <h2 className="text-sm font-semibold text-ink">Obserwowane</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Obserwowane mecze nie rezerwują miejsca — zapisz się, gdy będziesz pewny.
                    </p>
                  </div>
                  {observing.map(({ event, role }) => (
                    <EventBrowseCard key={event.id} event={event} myStatus={role} />
                  ))}
                </section>
              )}
            </div>
          )
        ) : (
          history.length === 0 ? (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-12">Brak historii meczy</p>
          ) : (
            <div className="space-y-3">
              {history.map(({ event, role }) => (
                <EventBrowseCard key={event.id} event={event} myStatus={role} />
              ))}
            </div>
          )
        )}

      </main>
    </div>
  );
}
