'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CalendarPlus, ChevronRight, MapPin, Users, Trophy } from 'lucide-react';
import NearbyGames from './NearbyGames';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { getMyParticipatedEvents } from '@/lib/events';
import { EventCard, isUpcoming } from '@/components/EventCard';
import type { EventItem } from '@/types';

function firstName(name: string): string {
  return name.split(' ')[0] || name;
}

/** Full marketing hero — split 60/40 with phone mockup. Shown to logged-out visitors. */
function MarketingHero() {
  return (
    <section className="hero-surface relative overflow-hidden text-white">
      <div className="hero-dots absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-24 lg:pt-20">
        {/* LEFT: copy + CTA */}
        <div className="text-center lg:text-left">
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-amber-200 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            Poznań i okolice
          </span>

          <h1
            className="mt-5 animate-fade-up font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ animationDelay: '80ms' }}
          >
            Otwarte mecze amatorskie.
            <br />
            <span className="text-white/85">Dołącz w 30 sekund.</span>
          </h1>

          <p
            className="mx-auto mt-5 max-w-xl animate-fade-up text-base font-medium text-white/80 sm:text-lg lg:mx-0"
            style={{ animationDelay: '160ms' }}
          >
            Piłka, kosz, siatka. Zero grup na WhatsAppie, zero excela,
            zero „kto w końcu gra?". Znajdź grę blisko, kliknij Dołącz, idź zagrać.
          </p>

          <div
            className="mt-8 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
            style={{ animationDelay: '240ms' }}
          >
            <Link href="/wydarzenia" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-[#F5A623] text-[#1A1D21] font-bold hover:bg-amber-400 border-transparent shadow-lg active:scale-[0.97]"
              >
                Znajdź grę <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/wydarzenia/nowe" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full border-white/30 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15 sm:w-auto"
              >
                Zorganizuj mecz
              </Button>
            </Link>
            <Link
              href="/mapa"
              className="inline-flex items-center gap-2 px-2 py-2 text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline"
            >
              <MapPin className="h-4 w-4" /> Mapa boisk
            </Link>
          </div>

          {/* Proof stats */}
          <dl
            className="mx-auto mt-10 grid max-w-md animate-fade-up grid-cols-3 gap-6 border-t border-white/10 pt-6 lg:mx-0"
            style={{ animationDelay: '320ms' }}
          >
            <Stat icon={<MapPin className="h-4 w-4" />} value="Setki" label="boisk w bazie" />
            <Stat icon={<Users className="h-4 w-4" />} value="5" label="dyscyplin" />
            <Stat
              icon={<Trophy className="h-4 w-4" />}
              value="Open"
              label="BOJO Cup"
              href="/turniej"
            />
          </dl>
        </div>

        {/* RIGHT: phone mockup */}
        <div
          className="relative mx-auto w-full max-w-[300px] animate-fade-up sm:max-w-[340px] lg:max-w-[400px]"
          style={{ animationDelay: '200ms' }}
        >
          <Image
            src="/mockups/mockup-1-lista-gier.png"
            alt="Aplikacja BOJO — lista nadchodzących meczów"
            width={1024}
            height={1536}
            priority
            sizes="(max-width: 640px) 70vw, 400px"
            className="w-full select-none drop-shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
          />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-canvas" aria-hidden="true" />
    </section>
  );
}

function Stat({ icon, value, label, href }: { icon: React.ReactNode; value: string; label: string; href?: string }) {
  const body = (
    <>
      <dt className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-white/55 lg:justify-start">
        {icon} {label}
      </dt>
      <dd className="mt-1 text-center font-display text-2xl font-bold tracking-tight lg:text-left">{value}</dd>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="group transition-opacity hover:opacity-80">
        {body}
      </Link>
    );
  }
  return <div>{body}</div>;
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

      {/* Personal games + nearby */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-8 pb-10">
        {hasMatches && (
          <>
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
          </>
        )}
        <NearbyGames />
      </section>
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
