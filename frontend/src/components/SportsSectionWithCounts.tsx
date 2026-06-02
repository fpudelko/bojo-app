'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const SPORTS = [
  ['⚽', 'Piłka nożna', 'piłka nożna'],
  ['🏀', 'Koszykówka', 'koszykówka'],
  ['🏐', 'Siatkówka', 'siatkówka'],
  ['🏖️', 'Siatkówka plażowa', 'siatkówka plażowa'],
  ['⚡', 'Futsal', 'futsal'],
  ['🤾', 'Piłka ręczna', 'piłka ręczna'],
] as const;

function getWeekendRange(): { from: string; to: string } {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 6=Sat
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
      .gte('date', from)
      .lte('date', to)
      .eq('visibility', 'public')
      .then(({ data }) => {
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Znajdź graczy w swoim sporcie</h2>
        <p className="text-sm text-gray-500 mb-8">Dołącz do gier albo stwórz własną — w kilka sekund</p>
        <div className="flex flex-wrap justify-center gap-3 text-sm font-medium text-gray-700">
          {SPORTS.map(([emoji, display, key]) => {
            const count = counts[key] ?? 0;
            return (
              <Link
                key={key}
                href={`/wydarzenia?sport=${encodeURIComponent(key)}`}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2.5 hover:border-primary-300 hover:text-primary-700 transition-colors"
              >
                <span>{emoji}</span>
                <span>{display}</span>
                {count > 0 && (
                  <span className="text-gray-400 font-normal">
                    · {count} {count === 1 ? 'gra' : 'gier'} w ten weekend
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
