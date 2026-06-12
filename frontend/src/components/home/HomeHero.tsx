'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarPlus, Bell, BellRing } from 'lucide-react';
import AlertSetupDialog from './AlertSetupDialog';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getPublicEvents, getMyParticipatedEvents } from '@/lib/events';
import { getMyAlert } from '@/lib/alerts';
import { SHOW_GAME_ALERTS } from '@/lib/features';
import { isUpcoming, isEventJoinable } from '@/components/EventCard';
import { EventListCard } from '@/components/EventListCard';
import type { EventItem, GameAlert } from '@/types';

/** Marketing hero for logged-out visitors */
function MarketingHero() {
  const [todayCount, setTodayCount] = useState<number | null>(null);

  useEffect(() => {
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
      <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-14 text-center lg:pb-20 lg:pt-20">
        <div>
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
            className="mt-5 animate-fade-up font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ animationDelay: '80ms' }}
          >
            Mecze, boiska i gracze
            <br />
            <span className="text-white/85">w Twojej okolicy.</span>
          </h1>
          <p
            className="mx-auto mt-5 max-w-md animate-fade-up text-base font-medium text-white/80 sm:text-lg"
            style={{ animationDelay: '160ms' }}
          >
            Znajdź brakujących graczy i dołączaj do otwartych meczów.
          </p>

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
      <div className="relative mx-auto max-w-3xl px-4 pt-8 pb-10">
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          Mecze, boiska i gracze w Twojej okolicy.
        </h1>
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
        <h2 className="text-base font-bold text-ink">
          Twoje najbliższe gry
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
          <EventListCard key={event.id} event={event} relation={isOrganizer ? 'organizer' : 'going'} />
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
  const [myRel, setMyRel] = useState<Record<string, 'organizer' | 'going'>>({});
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([
      getPublicEvents(),
      user && SHOW_GAME_ALERTS ? getMyAlert().catch(() => null) : Promise.resolve(null),
      user ? getMyParticipatedEvents(user.id).catch(() => []) : Promise.resolve([]),
    ]).then(([events, myAlert, mine]) => {
      setAllEvents(events);
      setAlert(myAlert);
      setMyRel(Object.fromEntries(mine.map(({ event, isOrganizer }) => [event.id, isOrganizer ? 'organizer' : 'going'] as const)));
    }).finally(() => setLoading(false));
  }, [user]);

  const openEvents = allEvents.filter((e) => {
    if (e.status === 'cancelled') return false;
    const taken = (e.participantsCount ?? 0) + (e.externalCount ?? 0);
    if (!isEventJoinable(e) || taken >= e.maxPlayers) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-ink">
          Najbliższe otwarte gry
          {openEvents.length > 0 && (
            <span className="ml-2 text-xs font-bold bg-primary-50 text-primary-700 border border-primary-100 rounded-full px-2 py-0.5">
              {openEvents.length}
            </span>
          )}
        </h2>
        {user && SHOW_GAME_ALERTS && (
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

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
        </div>
      ) : openEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-2xl mb-3">⚽</p>
          <p className="text-sm font-medium text-slate-600 mb-4">
            Brak otwartych gier w tej chwili
          </p>
          {user && SHOW_GAME_ALERTS ? (
            <button
              onClick={() => setShowAlert(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white"
            >
              <Bell className="w-4 h-4" /> Ustaw alert
            </button>
          ) : (
            <Link href="/wydarzenia/nowe" className="inline-flex items-center gap-2 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white">
              <CalendarPlus className="w-4 h-4" /> Stwórz mecz
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {openEvents.slice(0, 5).map((e) => (
            <EventListCard key={e.id} event={e} relation={myRel[e.id]} />
          ))}
          {openEvents.length > 5 && (
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

/** Map teaser linking to /mapa */
function MapTeaser() {
  return (
    <Link href="/mapa" className="group block rounded-2xl overflow-hidden relative h-32 bg-[#e8f0e9] hover:shadow-card-hover transition-all">
      {/* pseudo-map grid */}
      <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="map-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#15803d" strokeWidth="0.8"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#map-grid)" />
      </svg>
      {/* decorative pins */}
      <span className="absolute top-4 left-1/3 text-2xl drop-shadow">📍</span>
      <span className="absolute top-8 left-2/3 text-xl drop-shadow">📍</span>
      <span className="absolute top-3 left-3/5 text-base drop-shadow">📍</span>
      {/* label */}
      <div className="absolute inset-0 flex items-end p-4">
        <div className="flex-1">
          <p className="text-sm font-bold text-primary-800">Mapa boisk</p>
          <p className="text-xs text-primary-700/70">Boiska w Poznaniu i okolicach</p>
        </div>
        <ArrowRight className="w-5 h-5 text-primary-700 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
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
          <MapTeaser />
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
        <MapTeaser />
      </section>
    </>
  );
}
