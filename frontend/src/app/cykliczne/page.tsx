'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, RepeatIcon, Lock } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { getMyRecurringEvents } from '@/lib/recurring';
import type { RecurringEvent } from '@/types';

const SPORT_EMOJI: Record<string, string> = {
  'piłka nożna': '⚽',
  futsal: '⚡',
  koszykówka: '🏀',
  siatkówka: '🏐',
  'siatkówka plażowa': '🏖️',
  'piłka ręczna': '🤾',
  inne: '🏅',
};

const DAY_NAMES: Record<number, string> = {
  1: 'Poniedziałek',
  2: 'Wtorek',
  3: 'Środa',
  4: 'Czwartek',
  5: 'Piątek',
  6: 'Sobota',
  7: 'Niedziela',
};

export default function RecurringEventsPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [events, setEvents] = useState<RecurringEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    getMyRecurringEvents(user.id)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <Lock className="w-10 h-10 mx-auto mb-4 text-gray-300" />
            <h1 className="text-xl font-bold text-gray-900">Zaloguj się, aby zobaczyć swoje cykliczne</h1>
            <p className="text-gray-500 text-sm mt-2 mb-6">
              Cykliczne wydarzenia wymagają konta organizatora.
            </p>
            <Button onClick={() => signInWithGoogle()}>Zaloguj się przez Google</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <RepeatIcon className="w-5 h-5 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">Cykliczne</h1>
          </div>
          {user && (
            <Link href="/cykliczne/nowe">
              <Button size="sm">
                <Plus className="w-4 h-4" />
                Nowe cykliczne
              </Button>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <RepeatIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Nie masz jeszcze cyklicznych wydarzeń</p>
            <p className="text-gray-400 text-sm mt-1 mb-6">
              Utwórz szablon i zapraszaj tę samą grupę graczy co tydzień.
            </p>
            <Link href="/cykliczne/nowe">
              <Button>
                <Plus className="w-4 h-4" />
                Utwórz pierwsze cykliczne
              </Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => (
              <li key={ev.id}>
                <Link
                  href={`/cykliczne/${ev.id}`}
                  className="block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-200 transition-all p-5"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-3xl shrink-0" role="img" aria-label={ev.sport}>
                      {SPORT_EMOJI[ev.sport] ?? '🏅'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 truncate">
                          {ev.title || ev.sport}
                        </span>
                        {ev.title && (
                          <span className="text-xs text-gray-400 capitalize">{ev.sport}</span>
                        )}
                        <span
                          className={[
                            'ml-auto shrink-0 text-xs px-2 py-0.5 rounded-full font-medium',
                            ev.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500',
                          ].join(' ')}
                        >
                          {ev.isActive ? 'Aktywne' : 'Nieaktywne'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {DAY_NAMES[ev.dayOfWeek]}, {ev.eventTime.slice(0, 5)}
                        {ev.endTime && (
                          <span className="text-gray-400"> – {ev.endTime.slice(0, 5)}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{ev.fieldName}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
