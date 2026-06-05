'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Target, Circle, Trophy, Sun, Dumbbell } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type SportRow = {
  Icon: React.ComponentType<{ className?: string }>;
  display: string;
  keys: string[];
  href: string;
};

const SPORTS: SportRow[] = [
  { Icon: Target,   display: 'Piłka nożna',      keys: ['piłka nożna', 'futsal'],  href: '/wydarzenia?sport=piłka nożna' },
  { Icon: Circle,   display: 'Koszykówka',         keys: ['koszykówka'],              href: '/wydarzenia?sport=koszykówka' },
  { Icon: Trophy,   display: 'Siatkówka',          keys: ['siatkówka'],               href: '/wydarzenia?sport=siatkówka' },
  { Icon: Sun,      display: 'Siatkówka plażowa',  keys: ['siatkówka plażowa'],       href: '/wydarzenia?sport=siatkówka plażowa' },
  { Icon: Dumbbell, display: 'Piłka ręczna',       keys: ['piłka ręczna'],            href: '/wydarzenia?sport=piłka ręczna' },
];

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
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Wybierz swój sport</h2>
        <div className="flex flex-wrap justify-center gap-3 text-sm font-medium text-gray-700">
          {SPORTS.map(({ Icon, display, keys, href }) => {
            const count = keys.reduce((sum, k) => sum + (counts[k] ?? 0), 0);
            return (
              <Link
                key={display}
                href={href}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2.5 hover:border-primary-300 hover:text-primary-700 transition-colors"
              >
                <Icon className="w-4 h-4 text-primary-600" />
                <span>{display}</span>
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
