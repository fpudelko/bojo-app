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
   *  „Wszystkie". Dziś nieużywane — filtry `/moje-gry` mają własny rząd. */
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

/** Lista moich meczów pod własnym nagłówkiem.
 *
 *  `title` jest propem, bo `/moje-gry` dzieli te same karty na TRZY sekcje
 *  wg relacji („Grasz", „Organizujesz", „Rezerwa i oczekujące") — jeden
 *  komponent z podmienianym nagłówkiem zamiast trzech kopii tego samego
 *  markupu. `limit`/`href` domyślnie zachowują się jak zajawka (2 pozycje
 *  + link do /moje-gry) dla `/grupy/[id]`; `/moje-gry` podaje
 *  `limit={null} href={null}`, bo pokazuje pełną listę i nie linkuje do
 *  samego siebie. */
export function MyMatchesSection({ items, title = 'Twoje najbliższe mecze', subtitle, limit = 2, href = '/moje-gry', unreadByEvent, emptyState }: {
  items: MyEventRow[]; title?: string; subtitle?: string;
  limit?: number | null; href?: string | null;
  /** Nieprzeczytane wiadomości per mecz — patrz `unreadMessages` na `EventBrowseCard`. */
  unreadByEvent?: Record<string, number>;
  /** Gdy podane, sekcja NIE znika przy pustej liście — nagłówek zostaje
   *  na stałe, a zamiast kart pokazuje się to. Bez tego propa puste `items`
   *  nadal oznacza `null` (Organizujesz/Rezerwa mają znikać, gdy nie ma czego
   *  pokazać — tylko „Grasz" na `/moje-gry` ma być zawsze widoczna). */
  emptyState?: React.ReactNode;
}) {
  if (items.length === 0) {
    if (!emptyState) return null;
    return (
      <div>
        <SectionHeader title={title} subtitle={subtitle} href={href ?? undefined} />
        {emptyState}
      </div>
    );
  }
  const shown = limit != null ? items.slice(0, limit) : items;
  return (
    <div>
      <SectionHeader title={title} subtitle={subtitle} href={href ?? undefined} count={items.length} />
      <div className="space-y-3">
        {shown.map(({ event, relation }) => (
          <EventBrowseCard key={event.id} event={event} relation={relation} unreadMessages={unreadByEvent?.[event.id]} odznakiOrganizatora />
        ))}
      </div>
    </div>
  );
}


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
      {/* Nagłówek mówi wprost, że to NIE SĄ Twoje mecze. „Mecze Twoich grup"
          brzmiało jak kolejna lista własnych gier i zlewało się z sekcją
          wyżej — a to jedyne miejsce na tej stronie, gdzie mecz jest CUDZY
          i można do niego dołączyć (zgłoszone wprost). */}
      <SectionHeader
        title="Możesz dołączyć"
        subtitle="Mecze Twojej ekipy, w których jeszcze Cię nie ma"
        href="/grupy"
        count={fresh.length}
      />
      <div className="space-y-3">
        {fresh.slice(0, 3).map((e) => (
          <EventBrowseCard key={e.id} event={e} relation={statusFor(e)} />
        ))}
      </div>
    </div>
  );
}

