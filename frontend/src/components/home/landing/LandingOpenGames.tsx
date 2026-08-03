'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getPublicEvents } from '@/lib/events';
import { useMyParticipation } from '@/lib/useMyParticipation';
import { isEventJoinable } from '@/components/EventCard';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import type { EventItem } from '@/types';

/**
 * Proof, not promise: shows real open games when there are any. On a cold
 * database (or while loading) this renders nothing — an empty/skeleton
 * state here would tell a first-time visitor the product is empty.
 */
export default function LandingOpenGames() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const statusFor = useMyParticipation();

  useEffect(() => {
    getPublicEvents()
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const openEvents = events.filter((e) => {
    if (e.status === 'cancelled') return false;
    const taken = e.participantsCount ?? 0;
    return isEventJoinable(e) && taken < e.maxPlayers;
  });

  if (openEvents.length === 0) return null;

  return (
    <section className="bg-white px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
            Możesz dołączyć już dziś
          </h2>
          <Link href="/wydarzenia" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800">
            Wszystkie <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="space-y-3">
          {openEvents.slice(0, 3).map((e) => (
            <EventBrowseCard key={e.id} event={e} relation={statusFor(e)} />
          ))}
        </div>
      </div>
    </section>
  );
}
