'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarPlus, Bell, BellRing, Plus, Map as MapIcon, Users, Trophy } from 'lucide-react';
import AlertSetupDialog from './AlertSetupDialog';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getPublicEvents, getMyParticipatedEvents } from '@/lib/events';
import { getMyAlert } from '@/lib/alerts';
import { SHOW_GAME_ALERTS } from '@/lib/features';
import { isUpcoming, isEventJoinable } from '@/components/EventCard';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import type { EventItem, GameAlert } from '@/types';

/** Reads today's open public match count. */
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
  return 'Aktywne w Poznaniu i okolicach';
}

/** Football-pitch line motif (pure SVG, no stock photo). */
function PitchLines({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.5">
        <rect x="14" y="14" width="172" height="232" rx="3" />
        <line x1="14" y1="130" x2="186" y2="130" />
        <circle cx="100" cy="130" r="34" />
        <circle cx="100" cy="130" r="2.5" fill="currentColor" stroke="none" />
        <rect x="60" y="14" width="80" height="38" />
        <rect x="60" y="208" width="80" height="38" />
      </g>
    </svg>
  );
}

/** Shared hero shell — gradient + a contained pitch/ball motif. The decoration
 *  lives INSIDE the centred column (overflow-clipped), so it never drifts off to
 *  the far edges on wide desktop screens. */
function HeroShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="hero-surface relative overflow-hidden text-white">
      <div className="relative mx-auto max-w-3xl px-5 pb-14 pt-14">
        {/* Decorative layer — clipped to this column's bounds */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <PitchLines className="absolute -right-10 top-0 h-full w-[56%] text-white/[0.07]" />
          <span className="absolute right-2 top-7 select-none text-5xl leading-none opacity-[0.14] rotate-12">⚽</span>
          <span className="absolute right-24 bottom-12 select-none text-4xl leading-none opacity-[0.11] -rotate-12">🏐</span>
          <span className="absolute right-3 bottom-7 select-none text-4xl leading-none opacity-[0.11] rotate-6">🏀</span>
        </div>
        <div className="relative">{children}</div>
      </div>
    </section>
  );
}

/** Pulsing live indicator pill. */
function LivePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-500" />
      </span>
      {label}
    </span>
  );
}

/** Hero — identical copy for logged-in and logged-out visitors. */
function Hero() {
  const count = useTodayCount();
  return (
    <HeroShell>
      <LivePill label={todayLabel(count)} />
      <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
        Czas na mecz?
      </h1>
      <p className="mt-4 max-w-md text-base font-medium leading-relaxed text-white/80 sm:text-lg">
        Wrzuć termin i zbierz skład — albo dołącz do otwartego meczu poniżej.
      </p>
    </HeroShell>
  );
}

/** "Jak to działa" — 3 numbered steps. */
function HowItWorks() {
  const steps = [
    { Icon: CalendarPlus, title: 'Stwórz mecz',           desc: 'Wybierz sport, boisko i termin. Zajmie Ci to minutę.' },
    { Icon: Users,        title: 'Zaproś i uzupełnij',    desc: 'Wyślij link ekipie. Brakuje kilku osób? Upublicznij mecz, a gracze z okolicy dobiorą się sami.' },
    { Icon: Trophy,       title: 'Wychodzicie grać',      desc: 'Komplet graczy? Widzimy się na boisku.' },
  ];
  return (
    <div>
      <SectionHeader title="Jak to działa" />
      <ol className="flex flex-col gap-3">
        {steps.map(({ Icon, title, desc }, i) => (
          <li key={title} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-100 shadow-sm">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-[11px] font-bold text-primary-950 ring-2 ring-canvas">
                {i + 1}
              </span>
            </div>
            <div>
              <p className="font-bold text-ink">{title}</p>
              <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link
        href="/wydarzenia/nowe"
        className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-5 py-3.5 text-base font-bold text-primary-950 shadow-sm transition-colors hover:bg-accent-400"
      >
        <Plus className="h-5 w-5" /> Stwórz mecz
      </Link>
    </div>
  );
}

/** Reusable section header with optional "Wszystkie" link. */
function SectionHeader({ title, href, count }: { title: string; href?: string; count?: number }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-bold text-ink">
        {title}
        {count != null && count > 0 && (
          <span className="ml-2 rounded-full border border-primary-100 bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">
            {count}
          </span>
        )}
      </h2>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800">
          Wszystkie <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

/** The user's upcoming games — max 2. */
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
      <SectionHeader title="Twoje najbliższe mecze" href="/moje-gry" count={games.length} />
      <div className="space-y-3">
        {games.slice(0, 2).map(({ event }) => (
          <EventBrowseCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

/** Public open-games feed — shown to everyone, max 2. */
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
    return isEventJoinable(e) && taken < e.maxPlayers;
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">
          Otwarte mecze
          {openEvents.length > 0 && (
            <span className="ml-2 rounded-full border border-primary-100 bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">
              {openEvents.length}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {user && SHOW_GAME_ALERTS && (
            <button
              onClick={() => setShowAlert(true)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                alert ? 'bg-primary-50 text-primary-700' : 'bg-amber-50 text-amber-700',
              ].join(' ')}
            >
              {alert ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              {alert ? 'Alert włączony' : 'Ustaw alert'}
            </button>
          )}
          <Link href="/wydarzenia" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800">
            Wszystkie <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : openEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-2xl mb-2">⚽</p>
          <p className="text-sm font-semibold text-slate-700 mb-1">Brak otwartych meczy</p>
          <p className="text-sm text-slate-500 mb-4">Bądź pierwszy — wrzuć termin, reszta się dopisze.</p>
          {user && SHOW_GAME_ALERTS ? (
            <button onClick={() => setShowAlert(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white">
              <Bell className="h-4 w-4" /> Ustaw alert
            </button>
          ) : (
            <Link href="/wydarzenia/nowe" className="inline-flex items-center gap-2 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white">
              <CalendarPlus className="h-4 w-4" /> Stwórz mecz
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

/** Map teaser card. */
function MapTeaser() {
  return (
    <Link
      href="/mapa"
      className="group flex items-center gap-4 rounded-2xl bg-primary-700 p-5 text-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
        <MapIcon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold">Mapa boisk</p>
        <p className="text-sm text-white/75">Sprawdź boiska w Poznaniu i okolicach</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-white/50 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

export default function HomeHero() {
  const { user, loading: authLoading } = useAuth();

  if (!authLoading && user) {
    return (
      <>
        <Hero />
        <section className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-12 pt-8">
          <MyGamesSection userId={user.id} />
          <OpenGamesSection />
          <MapTeaser />
          <HowItWorks />
        </section>
      </>
    );
  }

  return (
    <>
      <Hero />
      <section className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-12 pt-8">
        <OpenGamesSection />
        <HowItWorks />
        <MapTeaser />
      </section>
    </>
  );
}
