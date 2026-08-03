'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarPlus, Bell, BellRing, Plus, Map as MapIcon, Users, Trophy } from 'lucide-react';
import AlertSetupDialog from './AlertSetupDialog';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getPublicEvents, getMyParticipatedEvents, getMyGroupEvents, type MyEventRelation } from '@/lib/events';
import { useMyParticipation } from '@/lib/useMyParticipation';
import { getMyGroups } from '@/lib/groups';
import { getMyInvites, dismissInvite, type InviteWithEvent } from '@/lib/playerInvites';
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

/** Hero for the logged-in dashboard. */
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

/** The user's upcoming games, split the same way as /moje-gry: matches you
 *  organize or are signed up for vs. matches you're merely observing. Kept
 *  as two sections so "Obserwujesz" never reads as "you're in". */
function MyGamesSection({ userId }: { userId: string }) {
  const [items, setItems] = useState<{ event: EventItem; relation: MyEventRelation }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyParticipatedEvents(userId)
      .then((rows) => setItems(rows.filter(({ event }) => event.status !== 'cancelled' && isUpcoming(event))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading || items.length === 0) return null;

  const playing = items.filter(({ relation }) => relation.status !== 'observing');
  const observing = items.filter(({ relation }) => relation.status === 'observing');

  return (
    <div className="space-y-6">
      {playing.length > 0 && (
        <div>
          <SectionHeader title="Twoje najbliższe mecze" href="/moje-gry" count={playing.length} />
          <div className="space-y-3">
            {playing.slice(0, 2).map(({ event, relation }) => (
              <EventBrowseCard key={event.id} event={event} relation={relation} />
            ))}
          </div>
        </div>
      )}
      {observing.length > 0 && (
        <div>
          <SectionHeader title="Obserwujesz" href="/moje-gry" count={observing.length} />
          <div className="space-y-3">
            {observing.slice(0, 2).map(({ event, relation }) => (
              <EventBrowseCard key={event.id} event={event} relation={relation} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Imienne zaproszenia — najwyżej na stronie, bo ktoś czeka na odpowiedź.
 *
 *  Zaproszenia, na które użytkownik już odpowiedział (dołączył, rezerwa,
 *  obserwuje), znikają stąd same: mecz jest wtedy w „Twoje najbliższe mecze"
 *  i pokazywanie go drugi raz jako zaproszenia sugerowałoby, że coś jeszcze
 *  trzeba zrobić. */
function InvitesSection({ userId }: { userId: string }) {
  const [items, setItems] = useState<InviteWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const statusFor = useMyParticipation();

  useEffect(() => {
    getMyInvites(userId)
      .then((rows) => setItems(rows.filter(({ event }) => isUpcoming(event))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const open = items.filter(({ event }) => {
    const rel = statusFor(event);
    return !rel || (rel.status === 'none' && !rel.isOrganizer);
  });

  if (loading || open.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Zaproszenia" count={open.length} />
      <div className="space-y-3">
        {open.slice(0, 3).map(({ invite, event }) => (
          <div key={invite.id} className="space-y-1.5">
            <EventBrowseCard event={event} relation={statusFor(event)} />
            <button
              onClick={() => {
                // Optimistic: zaproszenie znika od razu, bo odrzucenie
                // niczego nie psuje, a czekanie na sieć wygląda na zawiechę.
                setItems((prev) => prev.filter((i) => i.invite.id !== invite.id));
                dismissInvite(invite.id).catch(() => {});
              }}
              className="px-1 text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              Nie tym razem
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Matches organised inside the user's groups that they haven't reacted to yet.
 *
 *  A group match is usually private, so before this section the only way in was
 *  the invite link someone pasted into a chat — easy to scroll past. Membership
 *  is enough of a reason to surface it. Anything the user already answered
 *  (joined, reserve, pending, observing) is dropped: it lives in "Twoje
 *  najbliższe mecze" above and would otherwise be listed twice. */
function GroupGamesSection({ userId }: { userId: string }) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const statusFor = useMyParticipation();

  useEffect(() => {
    getMyGroupEvents(userId)
      .then((rows) => setEvents(rows.filter(isUpcoming)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const fresh = events.filter((e) => {
    const rel = statusFor(e);
    // No relation row yet = nothing answered, exactly what we want to surface.
    return !rel || (rel.status === 'none' && !rel.isOrganizer);
  });

  if (loading || fresh.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Mecze Twoich ekip" href="/grupy" count={fresh.length} />
      <div className="space-y-3">
        {fresh.slice(0, 3).map((e) => (
          <EventBrowseCard key={e.id} event={e} relation={statusFor(e)} />
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
  const statusFor = useMyParticipation();

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
    const taken = e.participantsCount ?? 0;
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
            <EventBrowseCard key={e.id} event={e} relation={statusFor(e)} />
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

/** Dashboard shown to signed-in users. Identical in behaviour to the old
 *  logged-in branch of HomeHero.tsx — only the never-rendered
 *  JoinByCodeSection was dropped, and auth is resolved by the caller
 *  (HomeSwitch) instead of read again here. */
export default function AppHome({ userId }: { userId: string }) {
  return (
    <>
      <Hero />
      <section className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-12 pt-8">
        <InvitesSection userId={userId} />
        <MyGamesSection userId={userId} />
        <GroupGamesSection userId={userId} />
        <OpenGamesSection />
        <MapTeaser />
        <MyGroupsSection userId={userId} />
        <HowItWorks />
      </section>
    </>
  );
}
