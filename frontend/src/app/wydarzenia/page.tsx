'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { isThisWeek } from 'date-fns';
import { ArrowLeft, Plus, Search, X } from 'lucide-react';
import Header from '@/components/layout/Header';
import { useAuth } from '@/lib/auth';
import { getPublicEvents } from '@/lib/events';
import type { EventItem } from '@/types';
import { sportEmoji } from '@/lib/sports';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { isEventJoinable } from '@/components/EventCard';
import { useRouter } from 'next/navigation';

const SPORT_CHIPS = [
  { value: 'piłka nożna' },
  { value: 'siatkówka' },
  { value: 'siatkówka plażowa' },
  { value: 'koszykówka' },
] as const;

type DateBucket = 'dzisiaj' | 'jutro' | 'tydzien' | 'wszystkie';
const DATE_CHIPS: { value: DateBucket; label: string }[] = [
  { value: 'dzisiaj',   label: 'Dzisiaj' },
  { value: 'jutro',     label: 'Jutro' },
  { value: 'tydzien',   label: 'Ten tydzień' },
  { value: 'wszystkie', label: 'Wszystkie' },
];

function dateBucket(dateStr: string): DateBucket {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (dt.getTime() === today.getTime()) return 'dzisiaj';
    if (dt.getTime() === tomorrow.getTime()) return 'jutro';
    if (isThisWeek(dt, { weekStartsOn: 1 })) return 'tydzien';
    return 'wszystkie';
  } catch { return 'wszystkie'; }
}

export default function EventsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<DateBucket>('wszystkie');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pub = await getPublicEvents();
      setAllEvents(pub);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = allEvents.filter((event) =>
      event.status !== 'cancelled' && isEventJoinable(event),
    );
    if (sportFilter) {
      const matchSports = sportFilter === 'piłka nożna' ? ['piłka nożna', 'futsal'] : [sportFilter];
      list = list.filter((event) => matchSports.includes(event.sport));
    }
    if (dateFilter !== 'wszystkie') {
      list = list.filter((event) => {
        const b = dateBucket(event.date);
        if (dateFilter === 'tydzien') return b === 'dzisiaj' || b === 'jutro' || b === 'tydzien';
        return b === dateFilter;
      });
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((event) =>
        event.title?.toLowerCase().includes(q) ||
        event.sport.toLowerCase().includes(q) ||
        event.fieldName?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allEvents, sportFilter, dateFilter, query]);

  const hasFilters = !!sportFilter || dateFilter !== 'wszystkie' || !!query;

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-2xl">
        {/* Page title row */}
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            type="button"
            aria-label="Wróć"
            onClick={() => router.back()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="flex-1 text-base font-bold text-ink">Szukaj meczu</span>
        </div>

        {/* Search bar */}
        <div className="px-4 pt-1 pb-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj po nazwie lub boisku…"
              className="w-full rounded-2xl bg-slate-100 dark:bg-slate-700 py-2.5 pl-10 pr-9 text-sm text-ink placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white dark:focus:bg-slate-700 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sport chips — emoji only, no "Wszystkie" (empty = all) */}
        <div className="flex gap-2 overflow-x-auto px-4 py-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SPORT_CHIPS.map(({ value }) => {
            const active = sportFilter === value;
            const emoji = sportEmoji(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSportFilter(active ? '' : value)}
                title={value}
                className={`flex shrink-0 items-center justify-center h-9 w-9 rounded-full text-lg transition-colors ${
                  active
                    ? 'bg-primary-700 ring-2 ring-primary-700 ring-offset-1'
                    : 'bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-primary-300'
                }`}
                aria-pressed={active}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            );
          })}
        </div>

        {/* Date chips */}
        <div className="flex gap-2 overflow-x-auto px-4 py-1 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {DATE_CHIPS.map(({ value, label }) => {
            const active = dateFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setDateFilter(value)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-primary-700 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-primary-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Results count */}
        {!loading && (
          <div className="flex items-center justify-between px-4 pb-2">
            <span className="text-[13px] text-slate-500 dark:text-slate-400">
              {filtered.length > 0 ? `${filtered.length} ${filtered.length === 1 ? 'mecz' : filtered.length < 5 ? 'mecze' : 'meczy'}` : 'Brak meczy'}
            </span>
          </div>
        )}

        {/* Skeletons */}
        {loading && (
          <div className="space-y-3 px-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-700" />
            ))}
          </div>
        )}

        {/* List */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3 px-4 pb-24">
            {filtered.map((event) => (
              <EventBrowseCard key={event.id} event={event} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
            <span className="text-5xl mb-4">⚽</span>
            <p className="text-base font-bold text-slate-700 dark:text-slate-300">Brak meczy</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Zmień filtr lub stwórz własny mecz.</p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => { setSportFilter(''); setDateFilter('wszystkie'); setQuery(''); }}
                className="mt-4 text-sm font-semibold text-primary-700 underline"
              >
                Wyczyść filtry
              </button>
            )}
            <Link
              href="/wydarzenia/nowe"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent-500 px-5 py-3 text-sm font-bold text-primary-950"
            >
              <Plus className="h-4 w-4" /> Stwórz mecz
            </Link>
          </div>
        )}
      </main>

      {/* FAB */}
      {user && filtered.length > 0 && (
        <Link
          href="/wydarzenia/nowe"
          aria-label="Nowy mecz"
          className="fixed bottom-6 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-primary-950 shadow-lg shadow-black/15 transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Link>
      )}
    </div>
  );
}
