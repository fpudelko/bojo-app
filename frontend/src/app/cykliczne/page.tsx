'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, RepeatIcon, Lock, ChevronRight, Bell } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { getMyRecurringEvents, getNextEventsForRecurring } from '@/lib/recurring';
import type { RecurringEvent } from '@/types';
import { sportEmoji } from '@/lib/sports';


const DAY_SHORT: Record<number, string> = {
  1: 'Pon', 2: 'Wt', 3: 'Śr', 4: 'Czw', 5: 'Pt', 6: 'Sob', 7: 'Nd',
};

type RecurringStatus = 'open' | 'waiting' | 'full' | 'cancelled' | 'inactive';

interface NextEvent {
  id: string;
  date: string;
  maxPlayers: number;
  status: string;
}

function deriveStatus(ev: RecurringEvent, next: NextEvent | null | undefined): RecurringStatus {
  if (!ev.isActive) return 'inactive';
  if (!next) return 'waiting';
  if (next.status === 'cancelled') return 'cancelled';
  return 'open';
}

const STATUS_CONFIG: Record<RecurringStatus, { label: string; bg: string; text: string; dot: string }> = {
  open:     { label: 'Zapisy otwarte',           bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  waiting:  { label: 'Czeka na otwarcie zapisów', bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400'   },
  full:     { label: 'Komplet',                   bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400'   },
  cancelled:{ label: 'Odwołana',                  bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-500'     },
  inactive: { label: 'Nieaktywna',                bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-300'   },
};

function StatusBadge({ status }: { status: RecurringStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function ActionButton({ status, ev, isOrganizer }: {
  status: RecurringStatus;
  ev: RecurringEvent;
  isOrganizer: boolean;
}) {
  if (isOrganizer && status === 'waiting') {
    return (
      <Link href={`/cykliczne/${ev.id}`}>
        <span className="text-xs font-medium text-primary-700 hover:text-primary-800 underline underline-offset-2">
          Otwórz zapisy
        </span>
      </Link>
    );
  }
  if (status === 'open') {
    return (
      <Link href={`/cykliczne/${ev.id}`}>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-lg hover:bg-primary-100 transition-colors">
          Zapisz się
        </span>
      </Link>
    );
  }
  if (status === 'waiting') {
    return (
      <button className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800">
        <Bell className="w-3 h-3" /> Powiadom mnie
      </button>
    );
  }
  return null;
}

export default function RecurringEventsPage() {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<RecurringEvent[]>([]);
  const [nextEvents, setNextEvents] = useState<Record<string, NextEvent | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    getMyRecurringEvents(user.id)
      .then(async (evs) => {
        setEvents(evs);
        if (evs.length > 0) {
          const nexts = await getNextEventsForRecurring(evs.map((e) => e.id));
          setNextEvents(nexts as Record<string, NextEvent | null>);
        }
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col bg-canvas">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
              <Lock className="w-7 h-7 text-primary-700" />
            </div>
            <h1 className="font-display text-xl font-bold text-ink">Zaloguj się, żeby zobaczyć stałe gierki</h1>
            <p className="text-slate-500 text-sm mt-2 mb-6">
              Stałe gierki wymagają konta organizatora.
            </p>
            <Button onClick={() => { window.location.href = `/logowanie?next=${encodeURIComponent(window.location.pathname)}`; }}>Zaloguj się</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Moje stałe gierki</h1>
            <p className="text-sm text-slate-500 mt-0.5">Cykliczne mecze i ich status</p>
          </div>
          {user && (
            <Link href="/cykliczne/nowe">
              <Button size="sm">
                <Plus className="w-4 h-4" /> Nowe
              </Button>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
              <RepeatIcon className="w-7 h-7 text-primary-700" />
            </div>
            <p className="font-semibold text-ink">Nie masz jeszcze stałych gierek</p>
            <p className="text-slate-500 text-sm mt-1 mb-6">
              Utwórz szablon i zapraszaj tę samą grupę graczy co tydzień.
            </p>
            <Link href="/cykliczne/nowe">
              <Button><Plus className="w-4 h-4" /> Utwórz pierwszą</Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => {
              const next = nextEvents[ev.id];
              const status = deriveStatus(ev, next);
              const isOrganizer = !!user && user.id === ev.organizerId;

              return (
                <li key={ev.id}>
                  <Link
                    href={`/cykliczne/${ev.id}`}
                    className="block bg-white rounded-2xl border border-slate-200/80 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 p-5"
                  >
                    <div className="flex items-start gap-4">
                      {/* Sport emoji */}
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-canvas text-2xl">
                        {sportEmoji(ev.sport)}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-ink truncate">
                              {ev.title || ev.sport}
                            </p>
                            {/* Fixed schedule */}
                            <p className="text-sm text-slate-600 mt-0.5">
                              {DAY_SHORT[ev.dayOfWeek]}, {ev.eventTime.slice(0, 5)}
                              {ev.endTime && (
                                <span className="text-slate-400"> – {ev.endTime.slice(0, 5)}</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{ev.fieldName}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <StatusBadge status={status} />
                            {next && (
                              <span className="text-xs text-slate-400">
                                {new Date(next.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
                          <ActionButton status={status} ev={ev} isOrganizer={isOrganizer} />
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
