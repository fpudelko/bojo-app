'use client';

import { useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  ArrowRight, Bell, BellRing, CalendarPlus, Plus, Repeat, Share2, Users,
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
export function SectionHeader({ title, href, count, subtitle, extra }: {
  title: string; href?: string; count?: number; subtitle?: string;
  /** Dodatkowa kontrolka po prawej stronie wiersza, obok (albo zamiast) linku
   *  „Wszystkie" — np. przycisk filtra na `/moje-gry` (patrz `NeedsPlayersSection`). */
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-ink">
          {title}
          {count != null && count > 0 && (
            <span className="ml-2 rounded-full border border-primary-100 bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">
              {count}
            </span>
          )}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {href && (
            <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800">
              Wszystkie <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          {extra}
        </div>
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
export function MyMatchesSection({ items, limit = 2, href = '/moje-gry', unreadByEvent }: {
  items: MyEventRow[]; limit?: number | null; href?: string | null;
  /** Nieprzeczytane wiadomości per mecz — patrz `unreadMessages` na `EventBrowseCard`. */
  unreadByEvent?: Record<string, number>;
}) {
  if (items.length === 0) return null;
  const shown = limit != null ? items.slice(0, limit) : items;
  return (
    <div>
      <SectionHeader title="Twoje najbliższe mecze" href={href ?? undefined} count={items.length} />
      <div className="space-y-3">
        {shown.map(({ event, relation }) => (
          <EventBrowseCard key={event.id} event={event} relation={relation} unreadMessages={unreadByEvent?.[event.id]} />
        ))}
      </div>
    </div>
  );
}

/** Ekipa z najbliższym nadchodzącym meczem — nad „Twoje najbliższe mecze"
 *  (zgłoszone wprost), zanim trzeba przewijać do „Twoje grupy" niżej.
 *  `groupEvents` z `useDashboardData()` przychodzi posortowane po dacie
 *  (`getMyGroupEvents()` w `lib/events.ts`), ale tylko po `event_date` w
 *  SQL-u — bez godziny w drugiej kolumnie sortowania dwa mecze tego samego
 *  dnia mogłyby wyjść w złej kolejności, więc doprecyzowanie po `date+time`
 *  tutaj jest tanie i pewne. */
export function NextGroupMatchTeaser({ groupEvents, groups }: {
  groupEvents: EventItem[];
  groups: Group[];
}) {
  const najblizszy = [...groupEvents].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];
  if (!najblizszy) return null;
  const ekipa = groups.find((g) => g.id === najblizszy.groupId);
  if (!ekipa) return null;

  const max = najblizszy.maxPlayers ?? 0;
  const taken = najblizszy.participantsCount ?? 0;
  const pct = max > 0 ? Math.min(100, Math.round((taken / max) * 100)) : 0;

  let dzien = '';
  try { dzien = format(parseISO(najblizszy.date), 'EEE d MMM', { locale: pl }); }
  catch { dzien = najblizszy.date; }

  return (
    <div>
      <SectionHeader title="Twoja ekipa gra wkrótce" href="/grupy" />
      <Link
        href={`/grupy/${ekipa.id}`}
        className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:border-primary-200 hover:shadow-md dark:border-slate-700/80 dark:bg-slate-800"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-2xl">
            {ekipa.sport ? sportEmoji(ekipa.sport) : '👥'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{ekipa.name}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="capitalize">{dzien}</span> · {najblizszy.time.slice(0, 5)}
              {najblizszy.fieldName && ` · ${najblizszy.fieldName}`}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
        </div>
        {max > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div className="h-full rounded-full bg-primary-600" style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-[11px] text-slate-400">{taken}/{max}</span>
          </div>
        )}
      </Link>
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
/** Kolejna edycja stałej gierki, która jeszcze nie powstała.
 *
 *  Termin serii tworzy się sam, `notifyDaysBefore` dni przed datą meczu — do
 *  tego czasu organizator nie widział po sobie żadnego śladu i nie miał jak
 *  odróżnić „jeszcze za wcześnie" od „mechanizm nie zadziałał". Karta jest
 *  celowo WIDMEM: liczymy ją z szablonu serii, w bazie nie powstaje żaden
 *  wiersz. Tworzenie meczu wcześniej tylko po to, żeby go pokazać, wysłałoby
 *  powiadomienia przed czasem i zaśmiecało listy odwołanymi terminami.
 *
 *  Data liczona jest tą samą regułą co `utworz_nalezne_terminy_serii()`
 *  w migracji `073`, więc karta pokazuje dokładnie ten termin, który powstanie. */
export function NastepneEdycjeSection({ pozycje }: {
  pozycje: { serieId: string; nazwa: string; data: string; godzina: string; zaIle: number; powstanieZa: number }[];
}) {
  if (pozycje.length === 0) return null;
  return (
    <div>
      <SectionHeader
        title="Kolejne stałe gierki"
        subtitle="Terminy, które powstaną same — jeszcze ich nie ma"
      />
      <div className="space-y-3">
        {pozycje.map((p) => (
          <Link
            key={p.serieId}
            href={`/cykliczne/${p.serieId}`}
            className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3.5 transition-colors hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800/40"
          >
            <Repeat className="h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-500 dark:text-slate-400">{p.nazwa}</p>
              <p className="text-xs text-slate-400">
                {formatujTermin(p.data)} · {p.godzina.slice(0, 5)}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-400 dark:border-slate-600 dark:bg-slate-800">
              {p.powstanieZa <= 0 ? 'powinien już istnieć' : `powstanie za ${withCount(p.powstanieZa, 'dzień', 'dni', 'dni')}`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** „niedz. 16 sie" — ten sam skrót co na kartach meczów. */
function formatujTermin(data: string): string {
  const [y, m, d] = data.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
}

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
export function PendingRequestsSection({ items, href, unreadByEvent }: {
  items: MyEventRow[]; href?: string; unreadByEvent?: Record<string, number>;
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
            <EventBrowseCard event={event} relation={relation} unreadMessages={unreadByEvent?.[event.id]} />
            <p className="px-3 pb-1.5 pt-1 text-xs font-semibold text-blue-700">
              {withCount(event.pendingApprovalCount ?? 0, 'osoba czeka', 'osoby czekają', 'osób czeka')} na akceptację
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Czy ten mecz liczy się jako „brakuje graczy" — wydzielone z
 *  `NeedsPlayersSection`, żeby `/moje-gry` mogło policzyć to samo PRZED
 *  renderowaniem, bez duplikowania reguły (decyduje, gdzie ma stanąć filtr
 *  nieprzeczytanych, patrz `pokazPustyNaglowek` niżej). */
export function needsPlayers({ event, relation }: MyEventRow): boolean {
  return relation.isOrganizer
    && (event.maxPlayers ?? 0) > 0
    && (event.participantsCount ?? 0) < (event.maxPlayers ?? 0);
}

export function NeedsPlayersSection({ items, limit = 3, href, unreadByEvent, extra, pokazPustyNaglowek }: {
  items: MyEventRow[]; limit?: number | null; href?: string; unreadByEvent?: Record<string, number>;
  /** Dodatkowa kontrolka w nagłówku, patrz `SectionHeader`. */
  extra?: React.ReactNode;
  /** `/moje-gry`: gdy sekcja akurat nie ma czego pokazać, ale wywołujący i tak
   *  chce tu zakotwiczyć `extra` (bo to pierwsza sekcja w kolejności, która
   *  realnie coś pokazuje) — renderuje samą kontrolkę zamiast `null`.
   *  Domyślnie `false`, bo pulpit (`AppHome`) ma zostać dokładnie taki, jaki
   *  był — pusta sekcja tam ma po prostu nie istnieć. */
  pokazPustyNaglowek?: boolean;
}) {
  const needing = items
    .filter(needsPlayers)
    .sort((a, b) => {
      const ka = `${a.event.date}T${a.event.time || '23:59'}`;
      const kb = `${b.event.date}T${b.event.time || '23:59'}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  if (needing.length === 0) {
    if (!pokazPustyNaglowek || !extra) return null;
    return <div className="flex items-center justify-end">{extra}</div>;
  }
  const shown = limit != null ? needing.slice(0, limit) : needing;
  return (
    <div>
      <SectionHeader
        title="Brakuje graczy"
        href={href}
        count={needing.length}
        subtitle="Twoje mecze, które jeszcze nie mają kompletu"
        extra={extra}
      />
      <div className="space-y-3">
        {shown.map(({ event, relation }) => (
          <EventBrowseCard key={event.id} event={event} relation={relation} unreadMessages={unreadByEvent?.[event.id]} />
        ))}
      </div>
    </div>
  );
}

/** Rozegrane mecze organizatora, w których ktoś ze składu nie oddał
 *  pieniędzy — góra zakładki „Historia" na `/moje-gry`. Filtrowanie i
 *  sortowanie w `doRozliczenia()` (`lib/myEvents.ts`); ta sekcja tylko
 *  renderuje, dokładnie jak `NeedsPlayersSection` wyżej. `EventBrowseCard`
 *  już pokazuje plakietkę „N osób nie zapłaciło" na karcie meczu przeszłego
 *  — zero nowej logiki prezentacji. */
export function DoRozliczeniaSection({ items, limit = null }: {
  items: MyEventRow[]; limit?: number | null;
}) {
  if (items.length === 0) return null;
  const shown = limit != null ? items.slice(0, limit) : items;
  return (
    <div>
      <SectionHeader
        title="Do rozliczenia"
        count={items.length}
        subtitle="Twoje rozegrane mecze, w których ktoś jeszcze nie oddał pieniędzy"
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
