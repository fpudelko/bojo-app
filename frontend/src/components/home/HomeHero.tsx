'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CalendarPlus, Bell, BellRing } from 'lucide-react';
import AlertSetupDialog from './AlertSetupDialog';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getPublicEvents, getMyParticipatedEvents } from '@/lib/events';
import { getMyAlert } from '@/lib/alerts';
import { isUpcoming } from '@/components/EventCard';
import { EventListCard } from '@/components/EventListCard';
import { sportEmoji } from '@/lib/sports';
import type { EventItem, GameAlert } from '@/types';

const SPORT_CHIPS = [
  { sport: 'piłka nożna',       emoji: '⚽', label: 'Piłka' },
  { sport: 'siatkówka plażowa', emoji: '🏖️', label: 'Siatkówka plażowa' },
  { sport: 'siatkówka',         emoji: '🏐', label: 'Siatkówka' },
  { sport: 'koszykówka',        emoji: '🏀', label: 'Koszykówka' },
];

const FILTER_SPORTS = ['piłka nożna', 'siatkówka plażowa', 'siatkówka', 'koszykówka'];

/** Marketing hero for logged-out visitors */
function MarketingHero() {
  const [venueCount, setVenueCount] = useState<number | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { count } = await supabase
          .from('fields')
          .select('id', { count: 'exact', head: true })
          .eq('map_visibility', 'public');
        setVenueCount(count ?? 0);
      } catch { /* ignore */ }
    })();
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { count } = await supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('date', today)
          .eq('visibility', 'public')
          .eq('status', 'active');
        setTodayCount(count ?? 0);
      } catch { /* ignore */ }
    })();
  }, []);

  return (
    <section className="hero-surface relative overflow-hidden text-white">
      <div className="hero-dots absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:pb-20 lg:pt-20">
        <div className="text-center lg:text-left">
          {/* Live today badge */}
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-amber-200 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            {todayCount !== null && todayCount > 0
              ? `Dziś wieczorem · ${todayCount} ${todayCount === 1 ? 'gra' : todayCount < 5 ? 'gry' : 'gier'}`
              : 'Poznań i okolice'}
          </span>

          <h1
            className="mt-5 animate-fade-up font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ animationDelay: '80ms' }}
          >
            Znajdź grę
            <br />
            <span className="text-white/85">na dziś wieczór.</span>
          </h1>
          <p
            className="mx-auto mt-5 max-w-xl animate-fade-up text-base font-medium text-white/80 sm:text-lg lg:mx-0"
            style={{ animationDelay: '160ms' }}
          >
            Organizuj grę ze znajomymi, znajdź brakujących graczy i dołączaj do
            otwartych meczów w okolicy — piłka, siatka czy kosz, wszystko w jednym miejscu.
          </p>

          {/* CTA */}
          <div
            className="mt-8 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
            style={{ animationDelay: '240ms' }}
          >
            <Link href="/wydarzenia" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-[#F5A623] text-[#1A1D21] font-bold hover:bg-amber-400 border-transparent shadow-lg active:scale-[0.97]">
                Znajdź grę <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/wydarzenia/nowe" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full border-white/30 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15 sm:w-auto">
                Stwórz mecz
              </Button>
            </Link>
          </div>

          {/* Sport chips */}
          <div
            className="mt-6 flex animate-fade-up flex-wrap items-center justify-center gap-2 lg:justify-start"
            style={{ animationDelay: '300ms' }}
          >
            {SPORT_CHIPS.map(({ sport, emoji, label }) => (
              <Link
                key={sport}
                href={`/wydarzenia?sport=${encodeURIComponent(sport)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm hover:bg-white/20 transition-colors"
              >
                <span>{emoji}</span> {label}
              </Link>
            ))}
          </div>

          {/* Stats bar */}
          <dl
            className="mx-auto mt-10 grid max-w-md animate-fade-up grid-cols-3 gap-4 border-t border-white/10 pt-6 lg:mx-0"
            style={{ animationDelay: '360ms' }}
          >
            <div>
              <dt className="text-xs uppercase tracking-wider text-white/55 text-center lg:text-left">boisk</dt>
              <dd className="mt-1 text-center font-display text-2xl font-bold tracking-tight lg:text-left">
                {venueCount !== null ? venueCount : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-white/55 text-center lg:text-left">gier dziś</dt>
              <dd className="mt-1 text-center font-display text-2xl font-bold tracking-tight lg:text-left">
                {todayCount !== null ? todayCount : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-white/55 text-center lg:text-left">dyscypliny</dt>
              <dd className="mt-1 text-center font-display text-2xl font-bold tracking-tight lg:text-left">4</dd>
            </div>
          </dl>
        </div>

        {/* Mockup */}
        <div className="relative mx-auto hidden w-full max-w-[300px] animate-fade-up sm:block sm:max-w-[340px] lg:max-w-[400px]" style={{ animationDelay: '200ms' }}>
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

/** Compact green header for logged-in users */
function DashboardHeader() {
  return (
    <section className="hero-surface relative overflow-hidden text-white">
      <div className="hero-dots absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Znajdź grę na dziś wieczór.
            </h1>
            <p className="mt-1 text-sm text-white/70 max-w-sm">
              Organizuj grę ze znajomymi, znajdź brakujących graczy i dołączaj do otwartych meczów w okolicy.
            </p>
          </div>
          <Link href="/wydarzenia/nowe" className="shrink-0">
            <Button variant="outline" size="sm" className="border-white/30 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15 whitespace-nowrap">
              <CalendarPlus className="h-4 w-4" /> Stwórz
            </Button>
          </Link>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-canvas" aria-hidden="true" />
    </section>
  );
}

/** The user's own upcoming games — shown above the open list so they can check
 *  attendance / invite people quickly. Renders nothing when there are none. */
function MyGamesSection({ userId }: { userId: string }) {
  const [games, setGames] = useState<{ event: EventItem; isOrganizer: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyParticipatedEvents(userId)
      .then((items) => setGames(items.filter(({ event }) => event.status !== 'cancelled' && isUpcoming(event))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading || games.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-ink">
          Twoje gry
          <span className="ml-2 text-xs font-bold bg-primary-50 text-primary-700 border border-primary-100 rounded-full px-2 py-0.5">
            {games.length}
          </span>
        </h2>
        <Link href="/moje-gry" className="text-xs font-semibold text-primary-700 hover:text-primary-800 inline-flex items-center gap-1">
          Wszystkie <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="space-y-2">
        {games.slice(0, 3).map(({ event, isOrganizer }) => (
          <div key={event.id} className="relative">
            {isOrganizer && (
              <span className="absolute top-2 right-2 z-10 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2 py-0.5 pointer-events-none">
                Organizujesz
              </span>
            )}
            <EventListCard event={event} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Public open-games feed with sport filter — shown to everyone. */
function OpenGamesSection() {
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<GameAlert | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [activeSport, setActiveSport] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([
      getPublicEvents(),
      user ? getMyAlert().catch(() => null) : Promise.resolve(null),
    ]).then(([events, myAlert]) => {
      setAllEvents(events);
      setAlert(myAlert);
    }).finally(() => setLoading(false));
  }, [user]);

  const openEvents = allEvents.filter((e) => {
    if (e.status === 'cancelled') return false;
    const taken = (e.participantsCount ?? 0) + (e.externalCount ?? 0);
    if (!isUpcoming(e) || taken >= e.maxPlayers) return false;
    if (activeSport && e.sport !== activeSport) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-ink">
          Otwarte gry
          {openEvents.length > 0 && (
            <span className="ml-2 text-xs font-bold bg-primary-50 text-primary-700 border border-primary-100 rounded-full px-2 py-0.5">
              {openEvents.length}
            </span>
          )}
        </h2>
        {user && (
          <button
            onClick={() => setShowAlert(true)}
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              alert ? 'bg-primary-50 text-primary-700' : 'bg-amber-50 text-amber-700',
            ].join(' ')}
          >
            {alert ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
            {alert ? 'Alert włączony' : 'Ustaw alert'}
          </button>
        )}
      </div>

      {/* Sport filter — emoji chips; nic nie wybrane = wszystkie */}
      <div className="flex items-center gap-2.5 mb-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTER_SPORTS.map((sport) => {
          const active = activeSport === sport;
          return (
            <button
              key={sport}
              onClick={() => setActiveSport(active ? '' : sport)}
              aria-pressed={active}
              aria-label={sport}
              title={sport}
              className={[
                'shrink-0 flex items-center justify-center h-11 w-11 rounded-full border transition-all',
                active
                  ? 'bg-primary-700 border-primary-700 shadow-md scale-105'
                  : 'bg-white border-slate-200 hover:border-primary-300 active:scale-95',
              ].join(' ')}
            >
              <span aria-hidden="true" className="text-xl leading-none">{sportEmoji(sport)}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
        </div>
      ) : openEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-2xl mb-3">⚽</p>
          <p className="text-sm font-medium text-slate-600 mb-4">
            {activeSport ? 'Brak otwartych gier w tym sporcie' : 'Brak otwartych gier w tej chwili'}
          </p>
          {user ? (
            <button
              onClick={() => setShowAlert(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white"
            >
              <Bell className="w-4 h-4" /> Ustaw alert
            </button>
          ) : (
            <Link href="/wydarzenia/nowe" className="inline-flex items-center gap-2 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white">
              Stwórz pierwszy mecz
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {openEvents.slice(0, 8).map((e) => (
            <EventListCard key={e.id} event={e} />
          ))}
          {openEvents.length > 8 && (
            <Link href="/wydarzenia" className="flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-primary-700 hover:text-primary-800">
              Pokaż wszystkie ({openEvents.length}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}

      {showAlert && (
        <AlertSetupDialog
          onClose={() => setShowAlert(false)}
          onSaved={(a) => { setAlert(a); setShowAlert(false); }}
        />
      )}
    </div>
  );
}

/** Quick links to the user's games and the venue map. */
function QuickLinks() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link href="/moje-gry" className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm hover:border-primary-200 hover:shadow-card-hover transition-all">
        <span className="text-xl">📋</span>
        <div>
          <p className="text-sm font-semibold text-ink">Twoje mecze</p>
          <p className="text-xs text-slate-400">Nadchodzące i historia</p>
        </div>
      </Link>
      <Link href="/mapa" className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm hover:border-primary-200 hover:shadow-card-hover transition-all">
        <span className="text-xl">🗺️</span>
        <div>
          <p className="text-sm font-semibold text-ink">Mapa boisk</p>
          <p className="text-xs text-slate-400">Setki lokalizacji</p>
        </div>
      </Link>
    </div>
  );
}

export default function HomeHero() {
  const { user, loading: authLoading } = useAuth();

  // Logged-in dashboard: greeting → your games → open games → quick links
  if (!authLoading && user) {
    return (
      <>
        <DashboardHeader />
        <section className="mx-auto w-full max-w-3xl px-4 pt-6 pb-10 space-y-6">
          <MyGamesSection userId={user.id} />
          <OpenGamesSection />
          <QuickLinks />
        </section>
      </>
    );
  }

  // Logged-out: marketing hero + public open games below
  return (
    <>
      <MarketingHero />
      <section className="mx-auto w-full max-w-3xl px-4 pt-2 pb-12 space-y-6">
        <OpenGamesSection />
      </section>
    </>
  );
}
