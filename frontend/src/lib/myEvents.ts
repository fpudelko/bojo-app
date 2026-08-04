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

/**
 * Splits a user's participated events the same way /moje-gry does:
 * cancelled matches never count as "upcoming" (they drop into history), and
 * observing is split out from playing so it never reads as "you're in".
 */
export function splitMyEvents(items: MyEventRow[]): SplitMyEvents {
  const upcoming = items.filter(({ event }) => event.status !== 'cancelled' && isUpcoming(event));
  const history = items.filter(({ event }) => event.status === 'cancelled' || !isUpcoming(event));
  const playing = upcoming.filter(({ relation }) => relation.status !== 'observing');
  const observing = upcoming.filter(({ relation }) => relation.status === 'observing');
  return { upcoming, history, playing, observing };
}

/**
 * The single most imminent match the user is actually in. Observing doesn't
 * count — you're not playing — and neither do cancelled or past matches.
 *
 * getMyParticipatedEvents() orders its rows by event_date DESCENDING, so
 * naively taking the first "playing" row would surface the FARTHEST match,
 * not the nearest. This sorts independently by date+time, ascending.
 */
export function nextMatch(items: MyEventRow[]): MyEventRow | null {
  const { playing } = splitMyEvents(items);
  if (playing.length === 0) return null;

  const withKey = playing.map((row) => ({
    row,
    key: `${row.event.date}T${row.event.time || '23:59'}`,
  }));
  withKey.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return withKey[0].row;
}
