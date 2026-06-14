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

// ── Pure-CSS/SVG sport-field motifs (no stock photos) ──────────────────────
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

function HoopLines({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.5">
        <rect x="14" y="14" width="172" height="232" rx="3" />
        <rect x="72" y="14" width="56" height="86" />
        <circle cx="100" cy="100" r="28" />
        <path d="M44 14 V52 A56 56 0 0 0 156 52 V14" />
        <line x1="86" y1="30" x2="114" y2="30" />
        <circle cx="100" cy="38" r="6" />
      </g>
    </svg>
  );
}

function NetLines({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.5">
        <rect x="14" y="14" width="172" height="232" rx="3" />
        <line x1="14" y1="90" x2="186" y2="90" />
        <line x1="14" y1="170" x2="186" y2="170" />
        <line x1="14" y1="130" x2="186" y2="130" strokeWidth="5" strokeDasharray="7 7" />
      </g>
    </svg>
  );
}

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

  const liveLabel =
    todayCount !== null && todayCount > 0
      ? `${todayCount} ${todayCount === 1 ? 'otwarty mecz' : todayCount < 5 ? 'otwarte mecze' : 'otwartych meczy'} dziś`
      : 'Poznań i okolice';

  return (
    <section className="relative overflow-hidden text-white">
      {/* Brand gradient mesh (green + amber glow, pure CSS) */}
      <div className="hero-surface absolute inset-0" aria-hidden="true" />
      {/* Pitch-line motif drifting off the right edge */}
      <PitchLines className="absolute -right-20 top-0 hidden h-full w-[68%] text-white/[0.07] sm:block" />
      {/* Floating sport glyphs for depth */}
      <span aria-hidden="true" className="pointer-events-none absolute right-5 top-9 select-none text-5xl opacity-[0.13] rotate-12">⚽</span>
      <span aria-hidden="true" className="pointer-events-none absolute right-28 bottom-20 select-none text-4xl opacity-[0.10] -rotate-12">🏐</span>
      <span aria-hidden="true" className="pointer-events-none absolute right-3 bottom-8 select-none text-4xl opacity-[0.10] rotate-6">🏀</span>

      <div className="relative mx-auto max-w-md px-5 pb-12 pt-12 lg:max-w-3xl">
        {/* Live today pill */}
        <span className="inline-flex animate-fade-up items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-500" />
          </span>
          {liveLabel}
        </span>

        <h1
          className="mt-5 animate-fade-up font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl"
          style={{ animationDelay: '80ms' }}
        >
          Organizuj mecz.<br />Zbierz skład. Zagraj.
        </h1>
        <p
          className="mt-4 max-w-md animate-fade-up text-base font-medium leading-relaxed text-white/85 sm:text-lg"
          style={{ animationDelay: '160ms' }}
        >
          Wrzuć termin i sport — gracze dołączą sami. Albo dołącz do otwartego meczu i uzupełnij skład.
        </p>

        <div
          className="mt-7 flex animate-fade-up flex-col gap-3 sm:max-w-sm"
          style={{ animationDelay: '240ms' }}
        >
          <Link
            href="/wydarzenia"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/5 px-5 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            <Search className="h-5 w-5" aria-hidden="true" /> Znajdź mecz
          </Link>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-canvas" aria-hidden="true" />
    </section>
  );
}

/** Sport picker — 3 designed cards (gradient + court motif, no stock photos). */
const SPORT_CARDS = [
  { label: 'Piłka nożna',       emoji: '⚽', grad: 'linear-gradient(150deg,#1f8a52 0%,#0f4c2e 100%)', Lines: PitchLines },
  { label: 'Siatkówka plażowa', emoji: '🏖️', grad: 'linear-gradient(150deg,#f3bd6b 0%,#d4881c 100%)', Lines: NetLines },
  { label: 'Koszykówka',        emoji: '🏀', grad: 'linear-gradient(150deg,#f0903e 0%,#bf3d12 100%)', Lines: HoopLines },
] as const;

function SportsShowcase() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Wybierz sport</h2>
        <Link href="/wydarzenia" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800">
          Wszystkie <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {SPORT_CARDS.map(({ label, emoji, grad, Lines }) => (
          <Link
            key={label}
            href="/wydarzenia"
            className="group relative aspect-[3/4] overflow-hidden rounded-2xl shadow-md ring-1 ring-black/5 transition-transform active:scale-[0.98]"
            style={{ background: grad }}
          >
            <Lines className="absolute inset-0 h-full w-full text-white/[0.18]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
            <span aria-hidden="true" className="absolute left-1/2 top-5 -translate-x-1/2 text-3xl drop-shadow-md transition-transform group-hover:scale-110">{emoji}</span>
            <span className="absolute inset-x-0 bottom-0 p-2.5 text-[13px] font-bold leading-tight text-white">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** "Jak to działa" — 3 numbered steps, shown to logged-out visitors. */
function HowItWorks() {
  const steps = [
    { Icon: CalendarPlus, title: 'Wrzuć mecz', desc: 'Sport, miejsce, ilu graczy potrzebujesz.' },
    { Icon: Users, title: 'Gracze dołączają', desc: 'Inni widzą Twój mecz i zapisują się sami.' },
    { Icon: Trophy, title: 'Komplet? Gracie!', desc: 'Skład pełny — wychodzicie na boisko.' },
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
        <Plus className="h-5 w-5" aria-hidden="true" /> Stwórz mecz
      </Link>
    </div>
  );
}

/** Compact green header for logged-in users */
function DashboardHeader() {
  return (
    <section className="hero-surface relative overflow-hidden text-white">
      <div className="hero-dots absolute inset-0" aria-hidden="true" />
      <PitchLines className="absolute -right-16 top-0 hidden h-full w-[55%] text-white/[0.06] sm:block" />
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
        {games.slice(0, 2).map(({ event, isOrganizer }) => (
          <EventBrowseCard key={event.id} event={event} />
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
          Najbliższe otwarte mecze
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
          <p className="text-sm font-medium text-slate-600 mb-4">
            Brak otwartych meczy w tej chwili
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
        <p className="text-sm text-white/85">Boiska w Poznaniu i okolicach</p>
      </div>
      <ArrowRight className="relative h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
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
          <SportsShowcase />
          <MapTeaser />
        </section>
      </>
    );
  }

  // Logged-out: marketing hero + public open games below
  return (
    <>
      <MarketingHero />
      <section className="mx-auto w-full max-w-3xl px-4 pt-6 pb-12 space-y-8">
        <SportsShowcase />
        <OpenGamesSection />
        <HowItWorks />
        <MapTeaser />
      </section>
    </>
  );
}
