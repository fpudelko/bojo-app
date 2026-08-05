'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { getFields } from '@/lib/api';
import { slugify } from '@/lib/utils';
import { sportEmoji } from '@/lib/sports';
import type { Field } from '@/types';

/**
 * "Boiska w okolicy" proof section. Wired to real fields from DB
 * (public map_visibility only), links to the real venue detail route
 * /boisko/[slug]. Renders nothing if the query comes back empty — same
 * rule as LandingOpenGames: no half-empty section on a cold database.
 */
export default function LandingVenues() {
  const [fields, setFields] = useState<Field[]>([]);

  useEffect(() => {
    let cancelled = false;
    getFields({ mapVisibility: 'public', limit: 8 })
      .then(({ fields }) => {
        if (cancelled) return;
        const picked = fields
          .filter((f) => f.district && f.sport.length > 0)
          .slice(0, 4);
        setFields(picked.length >= 4 ? picked : fields.slice(0, 4));
      })
      .catch(() => { if (!cancelled) setFields([]); });
    return () => { cancelled = true; };
  }, []);

  if (fields.length === 0) return null;

  return (
    <section className="bg-canvas px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">
              Boiska w okolicy
            </span>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Boiska, na których się gra
            </h2>
          </div>
          <Link
            href="/mapa"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800"
          >
            Cała mapa boisk <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <li key={f.id}>
              <Link
                href={`/boisko/${slugify(f.name)}`}
                className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-card transition-colors duration-200 hover:border-primary-200 hover:shadow-card-hover"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-xl">
                  {sportEmoji(f.sport[0] ?? 'inne')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink" title={f.name}>{f.name}</span>
                  {f.district && (
                    <span className="block truncate text-xs text-slate-600">{f.district}</span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
