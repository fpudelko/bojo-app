'use client';

import { useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  ArrowRight, Bell, BellRing, CalendarPlus, Plus, Share2, Users,
  type LucideIcon,
} from 'lucide-react';
import AlertSetupDialog from '../AlertSetupDialog';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { InviteList } from '@/components/events/InviteList';
import { isEventJoinable } from '@/lib/eventDates';
import type { InviteWithEvent } from '@/lib/playerInvites';
import { LANDING_STEPS } from '../landing/content';
import WczesnyEtapBadge from '../landing/WczesnyEtapBadge';
import { sportEmoji } from '@/lib/sports';
import { SHOW_GAME_ALERTS } from '@/lib/features';
import type { EventItem, GameAlert, Group } from '@/types';
import type { MyEventRelation } from '@/lib/events';
import type { MyEventRow } from '@/lib/myEvents';
import { withCount } from '@/lib/plural';

type StatusFor = (event: EventItem) => MyEventRelation;

/** Reusable section header with optional "Wszystkie" link and subtitle.
 *  Exported so /moje-gry — which reuses these sections without truncation —
 *  can render the same heading style for "Obserwowane" with its explanatory
 *  subline, instead of a third copy of this markup. */
export function SectionHeader({ title, href, count, subtitle }: {
  title: string; href?: string; count?: number; subtitle?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between">
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
      {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
    </div>
  );
}

/** Named invites — highest on the page because someone is waiting on an
 *  answer. A game the user already answered (joined, reserve, observing,
 *  pending) no longer carries status 'invited' — see
 *  lib/events.ts#getMyParticipationMap — so it drops out here on its own
 *  and shows once, in MyMatchesSection / GroupGamesSection instead.
 *
 *  `limit` domyślnie 3 (teaser na pulpicie); /moje-gry podaje własny `href`
 *  do swojej zakładki „Zaproszenia". Odrzucania nie ma — przyciski odpowiedzi
 *  na zaproszenie zostały wycofane (PR #110). */
export function InvitesSection({ invites, statusFor, href, limit = 3 }: {
  invites: InviteWithEvent[];
  statusFor: StatusFor;
  href?: string;
  limit?: number;
}) {

  const open = invites.filter(({ event }) => statusFor(event).status === 'invited');
  if (open.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Zaproszenia" href={href} count={open.length} />
      <InviteList
        invites={open}
        statusFor={statusFor}
        limit={limit}
      />
    </div>
  );
}

/** "Twoje najbliższe mecze" — everything the user is playing/organizing,
 *  except whichever match NextMatchCard already put front and centre.
 *  `limit`/`href` default to the dashboard's teaser behaviour (2 items +
 *  link to /moje-gry); /moje-gry itself passes limit={null} href={null} to
 *  show the full list with no "Wszystkie" link back to itself. */
export function MyMatchesSection({ items, limit = 2, href = '/moje-gry' }: {
  items: MyEventRow[]; limit?: number | null; href?: string | null;
}) {
  if (items.length === 0) return null;
  const shown = limit != null ? items.slice(0, limit) : items;
  return (
    <div>
      <SectionHeader title="Twoje najbliższe mecze" href={href ?? undefined} count={items.length} />
      <div className="space-y-3">
        {shown.map(({ event, relation }) => (
          <EventBrowseCard key={event.id} event={event} relation={relation} />
        ))}
      </div>
    </div>
  );
}

/** „Na który z moich meczów nie zbiera się skład" — pytanie, na które
 *  organizator dotąd nie miał gdzie odpowiedzieć. `/moje-gry` miesza
 *  organizowanie i granie celowo w jednej liście (`splitMyEvents` obok),
 *  więc to osobna, DODATKOWA sekcja, nie zamiana tamtej. Dane są już
 *  pobrane przez `getMyParticipatedEvents()` — `participantsCount` liczy
 *  `toEvent()` z dołączonego `event_participants`, zero nowego zapytania.
 *
 *  Sortowanie po dacie ROSNĄCO niezależnie od kolejności wejściowej: `items`
 *  bywa przekazywane w kolejności `getMyParticipatedEvents()`, która sortuje
 *  malejąco (ten sam powód, dla którego `nextMatch()` w `lib/myEvents.ts`
 *  sortuje samodzielnie zamiast ufać porządkowi wejścia). */
/** Prośby o dołączenie czekające na decyzję organizatora.
 *
 *  Stoi NAD „Brakuje graczy", bo to jedyna sekcja, w której ktoś czeka na
 *  odpowiedź — mecz bez kompletu poczeka, człowiek z prośbą niekoniecznie.
 *  Dotąd jedynym śladem była niebieska kropka przy „Moje" w dolnej nawigacji
 *  i wpis w dzwonku; żeby dowiedzieć się, KTÓRY mecz czeka, trzeba było
 *  otwierać mecze po kolei.
 *
 *  Bez przycisków akceptuj/odrzuć w kafelku — decyzja zapada na stronie meczu,
 *  gdzie widać skład, rezerwę i kto właściwie prosi. Przyciski odpowiedzi
 *  wprost na liście zostały już raz wycofane z zaproszeń (PR #110). */
export function PendingRequestsSection({ items, href }: {
  items: MyEventRow[]; href?: string;
}) {
  const czekajace = items
    .filter(({ event, relation }) => relation.isOrganizer && (event.pendingApprovalCount ?? 0) > 0)
    .sort((a, b) => `${a.event.date}T${a.event.time || '23:59'}`
      .localeCompare(`${b.event.date}T${b.event.time || '23:59'}`));
  if (czekajace.length === 0) return null;

  const razem = czekajace.reduce((suma, { event }) => suma + (event.pendingApprovalCount ?? 0), 0);

  return (
    <div>
      <SectionHeader
        title="Czekają na Twoją decyzję"
        href={href}
        count={razem}
        subtitle={`${withCount(razem, 'prośba', 'prośby', 'próśb')} o dołączenie do Twoich meczów`}
      />
      <div className="space-y-3">
        {czekajace.map(({ event, relation }) => (
          <div key={event.id} className="rounded-2xl border border-blue-200 bg-blue-50/40 p-1">
            <EventBrowseCard event={event} relation={relation} />
            <p className="px-3 pb-1.5 pt-1 text-xs font-semibold text-blue-700">
              {withCount(event.pendingApprovalCount ?? 0, 'osoba czeka', 'osoby czekają', 'osób czeka')} na akceptację
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NeedsPlayersSection({ items, limit = 3, href }: {
  items: MyEventRow[]; limit?: number | null; href?: string;
}) {
  const needing = items
    .filter(({ event, relation }) =>
      relation.isOrganizer
      && (event.maxPlayers ?? 0) > 0
      && (event.participantsCount ?? 0) < (event.maxPlayers ?? 0))
    .sort((a, b) => {
      const ka = `${a.event.date}T${a.event.time || '23:59'}`;
      const kb = `${b.event.date}T${b.event.time || '23:59'}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  if (needing.length === 0) return null;
  const shown = limit != null ? needing.slice(0, limit) : needing;
  return (
    <div>
      <SectionHeader
        title="Brakuje graczy"
        href={href}
        count={needing.length}
        subtitle="Twoje mecze, które jeszcze nie mają kompletu"
      />
      <div className="space-y-3">
        {shown.map(({ event, relation }) => (
          <EventBrowseCard key={event.id} event={event} relation={relation} />
        ))}
      </div>
    </div>
  );
}

/** Kept separate from MyMatchesSection so "Obserwujesz" never reads as
 *  "you're in" — observing holds no spot and counts in no stats. Title and
 *  subtitle are overridable: /moje-gry calls this section "Obserwowane" and
 *  adds the explanatory subline it already had inline. */
export function ObservingSection({ items, limit = 2, href = '/moje-gry', title = 'Obserwujesz', subtitle }: {
  items: MyEventRow[]; limit?: number | null; href?: string | null; title?: string; subtitle?: string;
}) {
  if (items.length === 0) return null;
  const shown = limit != null ? items.slice(0, limit) : items;
  return (
    <div>
      <SectionHeader title={title} href={href ?? undefined} count={items.length} subtitle={subtitle} />
      <div className="space-y-3">
        {shown.map(({ event, relation }) => (
          <EventBrowseCard key={event.id} event={event} relation={relation} />
        ))}
      </div>
    </div>
  );
}

/** Matches organised inside the user's groups that they haven't reacted to
 *  yet. A group match is usually private, so before this section the only
 *  way in was the invite link someone pasted into a chat — easy to scroll
 *  past. Membership is enough of a reason to surface it. Anything already
 *  answered (joined, reserve, pending, observing, invited) is dropped: it
 *  lives in MyMatchesSection/ObservingSection/InvitesSection above and would
 *  otherwise show twice. */
export function GroupGamesSection({ events, statusFor }: {
  events: EventItem[];
  statusFor: StatusFor;
}) {
  const fresh = events.filter((e) => {
    const rel = statusFor(e);
    return rel.status === 'none' && !rel.isOrganizer;
  });
  if (fresh.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Mecze Twoich grup" href="/grupy" count={fresh.length} />
      <div className="space-y-3">
        {fresh.slice(0, 3).map((e) => (
          <EventBrowseCard key={e.id} event={e} relation={statusFor(e)} />
        ))}
      </div>
    </div>
  );
}

/** Public open-games feed. Unlike the other sections this always renders —
 *  even at zero, it tells the truth about whether Bojo has open games right
 *  now, instead of going quiet the way LandingOpenGames does. */
export function OpenGamesSection({ events, statusFor, alert }: {
  events: EventItem[];
  statusFor: StatusFor;
  alert: GameAlert | null;
}) {
  const [showAlert, setShowAlert] = useState(false);
  // Local override so a freshly-saved alert reflects immediately without
  // needing a setter on the shared dashboard-data hook.
  const [localAlert, setLocalAlert] = useState<GameAlert | null>(null);
  const effectiveAlert = localAlert ?? alert;

  const openEvents = events.filter((e) => {
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
          {SHOW_GAME_ALERTS && (
            <button
              onClick={() => setShowAlert(true)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                effectiveAlert ? 'bg-primary-50 text-primary-700' : 'bg-amber-50 text-amber-700',
              ].join(' ')}
            >
              {effectiveAlert ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              {effectiveAlert ? 'Alert włączony' : 'Ustaw alert'}
            </button>
          )}
          <Link href="/wydarzenia" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800">
            Wszystkie <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {openEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="mb-2 text-2xl">⚽</p>
          {events.length === 0 ? (
            <>
              <p className="mb-1 text-sm font-semibold text-slate-700">Nie ma teraz otwartych gier w okolicy</p>
              <p className="mb-4 text-sm text-slate-600">Wrzuć własną — zobaczą ją gracze z Twojej okolicy.</p>
            </>
          ) : (
            <>
              <p className="mb-1 text-sm font-semibold text-slate-700">Wszystkie gry w okolicy mają komplet</p>
              <p className="mb-4 text-sm text-slate-600">Wrzuć własną albo wróć za chwilę.</p>
            </>
          )}
          {SHOW_GAME_ALERTS ? (
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
          {openEvents.slice(0, 3).map((e) => (
            <EventBrowseCard key={e.id} event={e} relation={statusFor(e)} />
          ))}
        </div>
      )}

      {showAlert && (
        <AlertSetupDialog
          onClose={() => setShowAlert(false)}
          onSaved={(a) => { setLocalAlert(a); setShowAlert(false); }}
        />
      )}
    </div>
  );
}

/** User's groups teaser — max 2 shown, + link to /grupy. */
export function MyGroupsSection({ groups }: { groups: Group[] }) {
  if (groups.length === 0) return null;
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
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {withCount(g.memberCount ?? 0, 'członek', 'członkowie', 'członków')}
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

const ONBOARDING_ICONS: Record<string, LucideIcon> = { CalendarPlus, Share2, Users };

/** "Jak to działa" — shown only at zero activity (see AppHome.tsx). Reuses
 *  LANDING_STEPS from the landing page's content module instead of a second
 *  copy of the same three steps, so the two can never drift apart. */
export function OnboardingSection() {
  return (
    <div>
      <SectionHeader title="Jak to działa" />
      <ol className="flex flex-col gap-3">
        {LANDING_STEPS.map((step, i) => {
          const Icon = ONBOARDING_ICONS[step.icon];
          // Pulpit renderuje te same kroki własnym markupem, więc plakietkę
          // wczesnego etapu trzeba postawić i tu — dane są wspólne, widok nie.
          const wczesny = 'wczesnyEtap' in step && step.wczesnyEtap;
          return (
            <li
              key={step.title}
              className={clsx(
                'flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-100 shadow-sm',
                wczesny && 'opacity-80',
              )}
            >
              <div className={clsx(
                'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                wczesny ? 'bg-slate-100 text-slate-400' : 'bg-primary-50 text-primary-700',
              )}>
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-[11px] font-bold text-primary-950 ring-2 ring-canvas">
                  {i + 1}
                </span>
              </div>
              <div>
                <p className="font-bold text-ink">{step.title}</p>
                {wczesny && <WczesnyEtapBadge />}
                <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>
              </div>
            </li>
          );
        })}
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
