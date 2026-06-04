'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarPlus, ChevronRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { getMyParticipatedEvents } from '@/lib/events';
import { EventCard, isUpcoming } from '@/components/EventCard';
import type { EventItem } from '@/types';

function firstName(name: string): string {
  return name.split(' ')[0] || name;
}

/** Full marketing hero — shown to logged-out visitors (and while auth resolves). */
function MarketingHero() {
  return (
    <section className="hero-surface relative overflow-hidden text-white">
      <div className="hero-dots absolute inset-0" aria-hidden="true" />
      <div className="relative max-w-3xl mx-auto text-center px-4 py-24 sm:py-28">
        <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-amber-200 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          Poznań i okolice
        </span>

        <h1
          className="mt-6 animate-fade-up font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl"
          style={{ animationDelay: '80ms' }}
        >
          Następny mecz
          <br />
          zaczyna się tutaj.
        </h1>

        <p
          className="mx-auto mt-6 max-w-xl animate-fade-up text-lg font-medium text-white/80 sm:text-xl"
          style={{ animationDelay: '160ms' }}
        >
          Boiska, mecze i gracze w Poznaniu i okolicach.
        </p>

        <div
          className="mt-10 flex animate-fade-up flex-col justify-center gap-3 sm:flex-row"
          style={{ animationDelay: '240ms' }}
        >
          <Link href="/wydarzenia">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-[#F5A623] text-[#1A1D21] font-bold hover:bg-amber-400 border-transparent shadow-lg active:scale-[0.97]"
            >
              Dołącz do gry <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/wydarzenia/nowe">
            <Button
              variant="outline"
              size="lg"
              className="w-full border-white/30 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15 sm:w-auto"
            >
              Szukam ludzi do gry
            </Button>
          </Link>
        </div>

        <p className="mt-6 animate-fade-up text-sm text-white/50" style={{ animationDelay: '320ms' }}>
          <Link href="/mapa" className="hover:text-white/80 transition-colors underline underline-offset-2">
            Przeglądaj boiska →
          </Link>
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-canvas" aria-hidden="true" />
    </section>
  );
}

/** Compact dashboard-style hero for logged-in users. */
function PersonalizedHero({ name, matches }: { name: string; matches: { event: EventItem; isOrganizer: boolean }[] }) {
  const hasMatches = matches.length > 0;

  return (
    <>
      {/* Slim welcome band */}
      <section className="hero-surface relative overflow-hidden text-white">
        <div className="hero-dots absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-start gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:py-12">
          <div>
            <p className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Cześć, {firstName(name)} 👋
            </p>
            <p className="mt-1 text-sm text-white/70">
              {hasMatches ? 'Gotowy na grę? Oto Twoje najbliższe mecze.' : 'Gotowy na grę? Znajdź mecz albo zbierz ekipę.'}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/wydarzenia">
              <Button
                size="sm"
                className="bg-[#F5A623] text-[#1A1D21] font-bold hover:bg-amber-400 border-transparent shadow-lg active:scale-[0.97]"
              >
                Dołącz do gry <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/wydarzenia/nowe">
              <Button
                variant="outline"
                size="sm"
                className="border-white/30 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15"
              >
                <CalendarPlus className="h-4 w-4" /> Nowy mecz
              </Button>
            </Link>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-canvas" aria-hidden="true" />
      </section>

      {/* Upcoming matches */}
      {hasMatches && (
        <section className="mx-auto w-full max-w-3xl px-4 pt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Twoje najbliższe mecze
            </h2>
            <Link
              href="/moje-gry"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800"
            >
              Wszystkie <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {matches.map(({ event, isOrganizer }) => (
              <EventCard key={event.id} event={event} isOrganizer={isOrganizer} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default function HomeHero() {
  const { user, loading: authLoading } = useAuth();
  const [matches, setMatches] = useState<{ event: EventItem; isOrganizer: boolean }[]>([]);

  useEffect(() => {
    if (!user) { setMatches([]); return; }
    let cancelled = false;
    getMyParticipatedEvents(user.id)
      .then((items) => {
        if (cancelled) return;
        const upcoming = items
          .filter(({ event }) => isUpcoming(event) && event.status !== 'cancelled')
          .sort((a, b) => (a.event.date + a.event.time).localeCompare(b.event.date + b.event.time))
          .slice(0, 3);
        setMatches(upcoming);
      })
      .catch(() => { if (!cancelled) setMatches([]); });
    return () => { cancelled = true; };
  }, [user]);

  // While auth resolves, or for logged-out visitors → full marketing hero.
  if (authLoading || !user) return <MarketingHero />;

  return <PersonalizedHero name={displayName(user)} matches={matches} />;
}
