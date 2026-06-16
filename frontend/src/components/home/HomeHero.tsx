'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CalendarPlus, Bell, BellRing, Plus, Map as MapIcon, Users, Trophy } from 'lucide-react';
import AlertSetupDialog from './AlertSetupDialog';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getPublicEvents, getMyParticipatedEvents } from '@/lib/events';
import { getMyGroups } from '@/lib/groups';
import { getMyAlert } from '@/lib/alerts';
import { SHOW_GAME_ALERTS } from '@/lib/features';
import { isUpcoming, isEventJoinable } from '@/components/EventCard';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import type { EventItem, GameAlert, Group } from '@/types';
import { sportEmoji } from '@/lib/sports';

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

/** Combined court motif (pure SVG, no stock photo): basketball key + hoop up
 *  top, volleyball court lines across the middle, football penalty box at the
 *  bottom — three sports in one clean line drawing. */
function CourtLines({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 300" fill="none" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round">
        {/* Outer boundary */}
        <rect x="14" y="14" width="172" height="272" rx="3" />

        {/* TOP — basketball: 3-point arc, key, free-throw circle, backboard, hoop */}
        <path d="M42 14 V38 A60 60 0 0 0 158 38 V14" />
        <rect x="72" y="14" width="56" height="62" />
        <circle cx="100" cy="76" r="22" />
        {/* Backboard — short, thick line just inside baseline */}
        <line x1="88" y1="21" x2="112" y2="21" strokeWidth="5" />
        {/* Hoop — larger circle clearly visible below backboard */}
        <circle cx="100" cy="31" r="9" />

        {/* MIDDLE — volleyball: net (thick center) + two attack lines */}
        <line x1="14" y1="150" x2="186" y2="150" strokeWidth="5" />
        <line x1="14" y1="126" x2="186" y2="126" />
        <line x1="14" y1="174" x2="186" y2="174" />

        {/* BOTTOM — football: penalty box, goal area, spot, arc (curves away from box) */}
        <rect x="50" y="232" width="100" height="54" />
        <rect x="74" y="262" width="52" height="24" />
        <circle cx="100" cy="250" r="2.5" fill="currentColor" stroke="none" />
        <path d="M66 232 A40 40 0 0 1 134 232" />
      </g>
    </svg>
  );
}

/** Shared hero shell — gradient + a contained pitch/ball motif. The decoration
 *  lives INSIDE the centred column (overflow-clipped), so it never drifts off to
 *  the far edges on wide desktop screens. */
function HeroShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="hero-surface relative overflow-hidden text-white min-h-[240px] sm:min-h-[320px]">
      <div className="relative mx-auto max-w-3xl px-5 pb-14 pt-14 sm:pb-24 sm:pt-20">
        {/* Decorative layer — clipped to this column's bounds */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <CourtLines className="absolute -right-4 -top-6 w-[58%] text-white/[0.11] sm:text-white/[0.13]" />
          <span className="absolute right-2 top-7 select-none text-5xl leading-none opacity-[0.16] rotate-12">⚽</span>
          <span className="absolute right-24 bottom-12 select-none text-4xl leading-none opacity-[0.13] -rotate-12">🏐</span>
          <span className="absolute right-3 bottom-7 select-none text-4xl leading-none opacity-[0.13] rotate-6">🏀</span>
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
        Znajdź mecz.<br />Albo stwórz własny.
      </h1>
      <p className="mt-4 max-w-md text-base font-medium leading-relaxed text-white/80 sm:text-lg">
        Dołącz do gry w okolicy albo wrzuć własny mecz i zbierz skład.
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
          <p className="text-sm font-semibold text-slate-700 mb-1">Brak wolnych miejsc</p>
          <p className="text-sm text-slate-500 mb-4">Wszystkie mecze w okolicy mają już komplet. Wrzuć własny albo wróć za chwilę.</p>
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

/** User's groups teaser — max 2 shown, + link to /grupy. */
function MyGroupsSection({ userId }: { userId: string }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyGroups(userId).then(setGroups).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  if (loading || groups.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Twoje grupy" href="/grupy" />
      <div className="space-y-2">
        {groups.slice(0, 2).map((g) => (
          <Link
            key={g.id}
            href={`/grupy/${g.id}`}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm hover:border-primary-200 hover:shadow-md transition-all group"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-xl">
              {g.sport ? sportEmoji(g.sport) : '👥'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink truncate">{g.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {g.memberCount ?? 0} {(g.memberCount ?? 0) === 1 ? 'członek' : 'członków'}
                {g.city && ` · ${g.city}`}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-primary-600 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function JoinByCodeSection() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const go = () => {
    const c = code.trim().toUpperCase().replace(/\s/g, '');
    if (c.length >= 4) router.push(`/d/${c}`);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-slate-800">Masz kod meczu?</p>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder="np. K7QP4B"
          maxLength={8}
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 font-mono text-lg font-bold uppercase tracking-widest text-primary-700 placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={go}
          disabled={code.trim().length < 4}
          className="rounded-xl bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-800 active:scale-95 disabled:opacity-40"
        >
          Idź →
        </button>
      </div>
    </div>
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
          <MyGroupsSection userId={user.id} />
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
