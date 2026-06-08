'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import { getFields } from '@/lib/api';
import { slugify } from '@/lib/utils';
import { sportEmoji } from '@/lib/sports';
import type { Field } from '@/types';

/**
 * "Popularne boiska" teaser on the homepage.
 * Wired to real fields from DB (public map_visibility only) instead of mock data.
 * Links to the real venue detail route /boisko/[slug].
 */
export default function FieldsTeaser() {
  const [fields, setFields] = useState<Field[]>([]);

  useEffect(() => {
    let cancelled = false;
    getFields({ mapVisibility: 'public', limit: 8 })
      .then(({ fields }) => {
        if (cancelled) return;
        // Prefer fields with a district + at least one sport, take first 4.
        const picked = fields
          .filter((f) => f.district && f.sport.length > 0)
          .slice(0, 4);
        setFields(picked.length >= 4 ? picked : fields.slice(0, 4));
      })
      .catch(() => { if (!cancelled) setFields([]); });
    return () => { cancelled = true; };
  }, []);

  // Don't render an empty/half section if we couldn't load anything.
  if (fields.length === 0) return null;

  return (
    <section className="bg-white px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">
              Boiska w okolicy
            </span>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Gdzie można zagrać
            </h2>
          </div>
          <Link
            href="/mapa"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800"
          >
            Cała mapa boisk <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map((f) => (
            <li key={f.id}>
              <Link
                href={`/boisko/${slugify(f.name)}`}
                className="block rounded-2xl border border-slate-200/80 bg-canvas p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-card-hover"
              >
                <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-primary-50 text-4xl">
                  {sportEmoji(f.sport[0] ?? 'inne')}
                </div>
                <h3 className="mt-4 truncate font-semibold text-ink" title={f.name}>{f.name}</h3>
                {f.district && (
                  <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> {f.district}
                  </p>
                )}
                <p className="mt-3 text-xs font-medium text-primary-700">
                  Zobacz boisko →
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
