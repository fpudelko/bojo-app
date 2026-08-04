import { describe, it, expect } from 'vitest';
import { splitMyEvents, nextMatch, type MyEventRow } from '@/lib/myEvents';
import type { EventItem } from '@/types';
import type { MyEventRelation } from '@/lib/events';

function addDays(n: number): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fakeEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: overrides.id ?? 'e1',
    organizerId: 'u1',
    organizerName: 'Jan',
    sport: 'piłka nożna',
    fieldName: 'Orlik',
    date: ymd(addDays(1)),
    time: '18:00',
    maxPlayers: 10,
    visibility: 'public',
    createdAt: '2026-01-01T00:00:00Z',
    status: 'active',
    requireSmsConfirmation: false,
    trackAttendance: false,
    teamMode: 'brak',
    trackPayments: false,
    showPaymentStatus: false,
    trackResults: false,
    ...overrides,
  } as EventItem;
}

function row(event: Partial<EventItem>, relation: Partial<MyEventRelation> = {}): MyEventRow {
  return {
    event: fakeEvent(event),
    relation: { isOrganizer: false, status: 'playing', ...relation },
  };
}

// Mirrors the filters app/moje-gry/page.tsx used before switching to splitMyEvents
// — a regression guard for the extraction.
function legacyFilters(items: MyEventRow[]) {
  const upcoming = items.filter(({ event }) => event.status !== 'cancelled' && isUpcomingLocal(event));
  const history = items.filter(({ event }) => event.status === 'cancelled' || !isUpcomingLocal(event));
  const playing = upcoming.filter(({ relation }) => relation.status !== 'observing');
  const observing = upcoming.filter(({ relation }) => relation.status === 'observing');
  return { upcoming, history, playing, observing };
}
function isUpcomingLocal(event: EventItem): boolean {
  const [y, m, d] = event.date.split('-').map(Number);
  const eventDate = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return eventDate.getTime() >= today.getTime();
}

describe('splitMyEvents', () => {
  it('odwołany mecz trafia do historii, nie do upcoming', () => {
    const items = [row({ id: 'a', date: ymd(addDays(1)), status: 'cancelled' })];
    const { upcoming, history } = splitMyEvents(items);
    expect(upcoming).toHaveLength(0);
    expect(history).toHaveLength(1);
  });

  it('rozdziela obserwujesz od grasz', () => {
    const items = [
      row({ id: 'a' }, { status: 'playing' }),
      row({ id: 'b' }, { status: 'observing' }),
    ];
    const { playing, observing } = splitMyEvents(items);
    expect(playing.map((r) => r.event.id)).toEqual(['a']);
    expect(observing.map((r) => r.event.id)).toEqual(['b']);
  });

  it('przeszły mecz trafia do historii', () => {
    const items = [row({ id: 'a', date: ymd(addDays(-3)) })];
    const { upcoming, history } = splitMyEvents(items);
    expect(upcoming).toHaveLength(0);
    expect(history).toHaveLength(1);
  });

  it('zgadza się z dotychczasowymi filtrami z /moje-gry (test regresji)', () => {
    const items = [
      row({ id: 'a', date: ymd(addDays(1)) }, { status: 'playing' }),
      row({ id: 'b', date: ymd(addDays(2)) }, { status: 'observing' }),
      row({ id: 'c', date: ymd(addDays(-1)) }, { status: 'playing' }),
      row({ id: 'd', date: ymd(addDays(5)), status: 'cancelled' }, { status: 'playing' }),
    ];
    expect(splitMyEvents(items)).toEqual(legacyFilters(items));
  });
});

describe('nextMatch', () => {
  it('zwraca najbliższy mecz, nie pierwszy z wejścia (dane przychodzą malejąco)', () => {
    // getMyParticipatedEvents() sorts descending — simulate that order.
    const items = [
      row({ id: 'far', date: ymd(addDays(10)) }),
      row({ id: 'near', date: ymd(addDays(1)) }),
    ];
    expect(nextMatch(items)?.event.id).toBe('near');
  });

  it('pomija obserwowane mecze', () => {
    const items = [
      row({ id: 'observed', date: ymd(addDays(1)) }, { status: 'observing' }),
      row({ id: 'playing', date: ymd(addDays(3)) }, { status: 'playing' }),
    ];
    expect(nextMatch(items)?.event.id).toBe('playing');
  });

  it('pomija odwołane i przeszłe mecze', () => {
    const items = [
      row({ id: 'cancelled', date: ymd(addDays(1)), status: 'cancelled' }),
      row({ id: 'past', date: ymd(addDays(-2)) }),
    ];
    expect(nextMatch(items)).toBeNull();
  });

  it('zwraca null dla pustego wejścia', () => {
    expect(nextMatch([])).toBeNull();
  });
});
