'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarPlus, Bell, BellRing, Plus, Search, Map as MapIcon, Users, Trophy } from 'lucide-react';
import AlertSetupDialog from './AlertSetupDialog';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getPublicEvents, getMyParticipatedEvents } from '@/lib/events';
import { getMyAlert } from '@/lib/alerts';
import { SHOW_GAME_ALERTS } from '@/lib/features';
import { isUpcoming, isEventJoinable } from '@/components/EventCard';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import type { EventItem, GameAlert } from '@/types';


/** Live "today" count pill — used in both hero variants for one shared look. */
function LivePill({ label }: { label: string }) {
  return (
    <span className="inline-flex animate-fade-up items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur-sm">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-500" />
      </span>
      {label}
    </span>
  );
}

/** Shared hero shell — same gradient, pitch motif and floating glyphs in both
 *  the logged-out marketing view and the logged-in dashboard, so they match. */
function HeroShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden text-white">
      {/* Photo background — drop hero-bg.jpg into /public to enable.
          Gradient overlay keeps text readable at any brightness level. */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/hero-bg.jpg)' }}
        aria-hidden="true"
      />
      {/* Dark gradient: left side fully opaque so text pops, right side reveals photo */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(105deg, #0f4c2e 0%, #0f4c2edd 38%, #0f4c2e99 65%, #0f4c2e55 100%)' }}
        aria-hidden="true"
      />
      {/* Bottom fade to canvas */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-canvas" aria-hidden="true" />
      <div className="relative mx-auto max-w-md px-5 pb-12 pt-12 lg:max-w-3xl">
        {children}
      </div>
    </section>
  );
}

/** Reads today's open public match count for the live pill. */
function useTodayCount() {
  const [count, setCount] = useState<number | null>(null);
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
        setCount(count ?? 0);
      } catch { /* ignore */ }
    })();
  }, []);
  return count;
}

function todayLabel(count: number | null) {
  if (count !== null && count > 0) {
    const word = count === 1 ? 'otwarty mecz' : count < 5 ? 'otwarte mecze' : 'otwartych meczy';
    return `${count} ${word} dziś w okolicy`;
  }
  return 'Poznań i okolice';
}

/** Marketing hero for logged-out visitors */
function MarketingHero() {
  const count = useTodayCount();

  return (
    <HeroShell>
      <LivePill label={todayLabel(count)} />

      <h1
        className="mt-5 animate-fade-up font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl"
        style={{ animationDelay: '80ms' }}
      >
        Zbierz skład.<br />Wyjdź na boisko.
      </h1>
      <p
        className="mt-4 max-w-md animate-fade-up text-base font-medium leading-relaxed text-white/85 sm:text-lg"
        style={{ animationDelay: '160ms' }}
      >
        Koniec z dzwonieniem po znajomych. Wrzuć termin, a gracze z Poznania
        dopiszą się sami. Brakuje Ci gry? Wskocz do otwartego meczu obok.
      </p>

      <div
        className="mt-7 flex animate-fade-up flex-col gap-3 sm:max-w-sm"
        style={{ animationDelay: '240ms' }}
      >
        <Link
          href="/wydarzenia"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/5 px-5 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
        >
          <Search className="h-5 w-5" aria-hidden="true" /> Znajdź mecz w okolicy
        </Link>
      </div>
    </HeroShell>
  );
}

/** Hero for logged-in users — same shell + copy tuned to "create a match". */
function DashboardHeader() {
  const count = useTodayCount();

  return (
    <HeroShell>
      <LivePill label={todayLabel(count)} />

      <h1
        className="mt-5 animate-fade-up font-display text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl"
        style={{ animationDelay: '80ms' }}
      >
        Czas na mecz?
      </h1>
      <p
        className="mt-3 max-w-md animate-fade-up text-base font-medium leading-relaxed text-white/85"
        style={{ animationDelay: '160ms' }}
      >
        Wrzuć termin i zbierz skład — albo dołącz do otwartego meczu poniżej.
      </p>

      <div
        className="mt-6 flex animate-fade-up flex-col gap-3 sm:max-w-sm"
        style={{ animationDelay: '240ms' }}
      >
        <Link
          href="/wydarzenia/nowe"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-5 py-3.5 text-base font-bold text-primary-950 shadow-sm transition-colors hover:bg-accent-400"
        >
          <Plus className="h-5 w-5" aria-hidden="true" /> Stwórz mecz
        </Link>
      </div>
    </HeroShell>
  );
}

/** "Jak to działa" — 3 numbered steps, shown to logged-out visitors. */
function HowItWorks() {
  const steps = [
    { Icon: CalendarPlus, title: 'Stwórz mecz', desc: 'Wybierz sport, boisko i termin. Zajmie Ci to minutę.' },
    { Icon: Users, title: 'Skład zbiera się sam', desc: 'Gracze z okolicy widzą Twój mecz i zapisują się.' },
    { Icon: Trophy, title: 'Wychodzicie grać', desc: 'Komplet graczy? Widzimy się na boisku.' },
  ];
  return (
    <div>
      <h2 className="mb-4 text-base font-bold text-ink">Jak to działa</h2>
      <ol className="flex flex-col gap-3">
        {steps.map(({ Icon, title, desc }, i) => (
          <li key={title} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-100">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <Icon className="h-6 w-6" aria-hidden="true" />
              <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-primary-950 ring-2 ring-canvas">
                {i + 1}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-ink">{title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link
        href="/wydarzenia/nowe"
        className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-5 py-3.5 text-base font-bold text-primary-950 shadow-sm transition-colors hover:bg-accent-400"
      >
        <Plus className="h-5 w-5" aria-hidden="true" /> Stwórz pierwszy mecz
      </Link>
    </div>
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
          Twoje najbliższe mecze
          <span className="ml-2 text-xs font-bold bg-primary-50 text-primary-700 border border-primary-100 rounded-full px-2 py-0.5">
            {games.length}
          </span>
        </h2>
        <Link href="/moje-gry" className="text-xs font-semibold text-primary-700 hover:text-primary-800 inline-flex items-center gap-1">
          Wszystkie <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="space-y-3">
        {games.slice(0, 2).map(({ event }) => (
          <EventBrowseCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

/** Public open-games feed — shown to everyone. */
function OpenGamesSection() {
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<GameAlert | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([
      getPublicEvents(),
      user && SHOW_GAME_ALERTS ? getMyAlert().catch(() => null) : Promise.resolve(null),
    ]).then(([events, myAlert]) => {
      setAllEvents(events);
      setAlert(myAlert);
    }).finally(() => setLoading(false));
  }, [user]);

  const openEvents = allEvents.filter((e) => {
    if (e.status === 'cancelled') return false;
    const taken = (e.participantsCount ?? 0) + (e.externalCount ?? 0);
    if (!isEventJoinable(e) || taken >= e.maxPlayers) return false;
    return true;
  });

  return (
    <div id="otwarte-gry" className="scroll-mt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-ink">
          Otwarte mecze
          {openEvents.length > 0 && (
            <span className="ml-2 text-xs font-bold bg-primary-50 text-primary-700 border border-primary-100 rounded-full px-2 py-0.5">
              {openEvents.length}
            </span>
          )}
        </h2>
        <Link href="/wydarzenia" className="text-xs font-semibold text-primary-700 hover:text-primary-800 inline-flex items-center gap-1">
          Wszystkie <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {user && SHOW_GAME_ALERTS && (
        <div className="mb-3 flex justify-end">
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
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
        </div>
      ) : openEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-2xl mb-3">⚽</p>
          <p className="text-sm font-medium text-slate-600 mb-1">
            Na razie cisza — żadnego otwartego meczu
          </p>
          <p className="text-sm text-slate-500 mb-4">
            Bądź pierwszy i wrzuć termin. Reszta się dopisze.
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
        <div className="space-y-3">
          {openEvents.slice(0, 2).map((e) => (
            <EventBrowseCard key={e.id} event={e} />
          ))}
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

/** Map teaser linking to /mapa — green card with satellite backdrop */
function MapTeaser() {
  return (
    <Link
      href="/mapa"
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl bg-primary-700 p-5 text-white shadow-[0_8px_24px_-8px_rgba(20,40,30,0.30)] transition-shadow hover:shadow-[0_12px_32px_-8px_rgba(20,40,30,0.40)]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-luminosity"
        style={{ backgroundImage: 'url(/poznan-satellite.jpg)' }}
        aria-hidden="true"
      />
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
        <MapIcon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="relative min-w-0 flex-1">
        <p className="font-bold">Mapa boisk</p>
        <p className="text-sm text-white/85">Sprawdź, gdzie zagrać w Poznaniu i okolicach</p>
      </div>
      <ArrowRight className="relative h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}

export default function HomeHero() {
  const { user, loading: authLoading } = useAuth();

  // Logged-in dashboard: hero → your games → open games → map
  if (!authLoading && user) {
    return (
      <>
        <DashboardHeader />
        <section className="mx-auto w-full max-w-3xl px-4 pt-6 pb-10 space-y-8">
          <MyGamesSection userId={user.id} />
          <OpenGamesSection />
          <MapTeaser />
        </section>
      </>
    );
  }

  // Logged-out: marketing hero → open games → how it works → map
  return (
    <>
      <MarketingHero />
      <section className="mx-auto w-full max-w-3xl px-4 pt-6 pb-12 space-y-8">
        <OpenGamesSection />
        <HowItWorks />
        <MapTeaser />
      </section>
    </>
  );
}
