'use client';

import Link from 'next/link';
import { ArrowRight, Repeat } from 'lucide-react';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { InviteList } from '@/components/events/InviteList';
import type { InviteWithEvent } from '@/lib/playerInvites';
import type { EventItem } from '@/types';
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
          <EventBrowseCard key={event.id} event={event} relation={relation} unreadMessages={unreadByEvent?.[event.id]} odznakiOrganizatora />
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


/** Czy ten mecz liczy się jako „brakuje graczy" — wydzielone z
 *  `NeedsPlayersSection`, żeby `/moje-gry` mogło policzyć to samo PRZED
 *  renderowaniem, bez duplikowania reguły (decyduje, gdzie ma stanąć filtr
 *  nieprzeczytanych, patrz `pokazPustyNaglowek` niżej). */
export function needsPlayers({ event, relation }: MyEventRow): boolean {
  return relation.isOrganizer
    && (event.maxPlayers ?? 0) > 0
    && (event.participantsCount ?? 0) < (event.maxPlayers ?? 0);
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

