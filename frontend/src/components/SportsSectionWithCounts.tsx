'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { FOCUS_SPORTS, sportEmoji, sportLabel } from '@/lib/sports';

const MIN_COUNT_TO_SHOW = 3;

function getWeekendRange(): { from: string; to: string } {
  const today = new Date();
  const day = today.getDay();
  const daysUntilSat = day === 6 ? 0 : (6 - day);
  const sat = new Date(today);
  sat.setDate(today.getDate() + daysUntilSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { from: fmt(today), to: fmt(sun) };
}

export default function SportsSectionWithCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const { from, to } = getWeekendRange();
    supabase
      .from('events')
      .select('sport')
      .gte('event_date', from)
      .lte('event_date', to)
      .eq('visibility', 'public')
      .then(({ data, error }) => {
        if (error) { console.warn('[SportsCounts]', error); return; }
        const c: Record<string, number> = {};
        (data ?? []).forEach((e) => {
          const s = (e.sport as string).toLowerCase();
          c[s] = (c[s] ?? 0) + 1;
        });
        setCounts(c);
      });
  }, []);

  return (
    <section className="bg-gray-50 py-16 px-4">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Wybierz swój sport</h2>
        <div className="flex flex-wrap justify-center gap-3 text-sm font-medium text-gray-700">
          {FOCUS_SPORTS.map((sport) => {
            const count = counts[sport] ?? 0;
            return (
              <Link
                key={sport}
                href={`/wydarzenia?sport=${encodeURIComponent(sport)}`}
                aria-label={`${sportLabel(sport)} — ${count >= MIN_COUNT_TO_SHOW ? `${count} gier w ten weekend` : "znajdź mecz"}`}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2.5 hover:border-primary-300 hover:text-primary-700 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 transition-colors"
              >
                <span role="img" aria-hidden>{sportEmoji(sport)}</span>
                <span>{sportLabel(sport)}</span>
                <span className="text-gray-400 font-normal">
                  {count >= MIN_COUNT_TO_SHOW
                    ? `· ${count} gier w ten weekend`
                    : '· znajdź mecz'}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
