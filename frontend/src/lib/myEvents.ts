// Shared "my events" splitting logic — previously duplicated between
// AppHome.tsx (MyGamesSection) and app/moje-gry/page.tsx.
import type { EventItem } from '@/types';
import type { MyEventRelation } from '@/lib/events';
import { isUpcoming } from '@/lib/eventDates';

export interface MyEventRow {
  event: EventItem;
  relation: MyEventRelation;
}

export interface SplitMyEvents {
  upcoming: MyEventRow[];
  history: MyEventRow[];
  playing: MyEventRow[];
  observing: MyEventRow[];
}

/** Klucz sortowania: data + godzina. Mecz bez godziny ląduje na końcu dnia. */
function kluczTerminu(row: MyEventRow): string {
  return `${row.event.date}T${row.event.time || '23:59'}`;
}

/**
 * Splits a user's participated events the same way /moje-gry does:
 * cancelled matches never count as "upcoming" (they drop into history), and
 * observing is split out from playing so it never reads as "you're in".
 *
 * Sortowanie jest tutaj, a nie u wywołujących: `getMyParticipatedEvents()`
 * oddaje wiersze po `event_date` MALEJĄCO, więc listy nadchodzących zaczynały
 * się od meczu najdalszego w przyszłości. Naprawione było dotąd wyłącznie
 * w `nextMatch()` — stąd sytuacja, w której „najbliższy mecz" nad listą
 * pokazywał inny termin niż pierwsza karta na liście pod nim.
 */
export function splitMyEvents(items: MyEventRow[]): SplitMyEvents {
  const wgTerminuRosnaco = (a: MyEventRow, b: MyEventRow) => kluczTerminu(a).localeCompare(kluczTerminu(b));

  const upcoming = items
    .filter(({ event }) => event.status !== 'cancelled' && isUpcoming(event))
    .sort(wgTerminuRosnaco);
  // Historia odwrotnie: ostatnio rozegrany mecz jest tym, o który się pyta.
  const history = items
    .filter(({ event }) => event.status === 'cancelled' || !isUpcoming(event))
    .sort((a, b) => -wgTerminuRosnaco(a, b));
  const playing = upcoming.filter(({ relation }) => relation.status !== 'observing');
  const observing = upcoming.filter(({ relation }) => relation.status === 'observing');
  return { upcoming, history, playing, observing };
}

/**
 * The single most imminent match the user is actually in. Observing doesn't
 * count — you're not playing — and neither do cancelled or past matches.
 */
export function nextMatch(items: MyEventRow[]): MyEventRow | null {
  const { playing } = splitMyEvents(items);
  if (playing.length === 0) return null;

  // `splitMyEvents` sortuje już rosnąco — pierwszy wiersz JEST najbliższy.
  return playing[0];
}
