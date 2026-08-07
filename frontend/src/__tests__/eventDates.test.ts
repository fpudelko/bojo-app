import { describe, it, expect } from 'vitest';
import { isUpcoming, isEventJoinable, timeUntil, matchWhenLabel, minutesUntilStart } from '@/lib/eventDates';
import type { EventItem } from '@/types';

function fakeEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: 'e1',
    organizerId: 'u1',
    organizerName: 'Jan',
    sport: 'piłka nożna',
    fieldName: 'Orlik',
    date: '2026-01-01',
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

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(n: number): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d;
}

describe('isUpcoming', () => {
  it('dzisiejsza data jest nadchodząca', () => {
    expect(isUpcoming(fakeEvent({ date: ymd(addDays(0)) }))).toBe(true);
  });
  it('data w przyszłości jest nadchodząca', () => {
    expect(isUpcoming(fakeEvent({ date: ymd(addDays(5)) }))).toBe(true);
  });
  it('data w przeszłości nie jest nadchodząca', () => {
    expect(isUpcoming(fakeEvent({ date: ymd(addDays(-1)) }))).toBe(false);
  });
});

describe('isEventJoinable', () => {
  it('mecz po godzinie startu nie jest już do dołączenia', () => {
    expect(isEventJoinable(fakeEvent({ date: ymd(addDays(-1)), time: '18:00' }))).toBe(false);
  });
  it('mecz w przyszłości jest do dołączenia', () => {
    expect(isEventJoinable(fakeEvent({ date: ymd(addDays(3)), time: '18:00' }))).toBe(true);
  });
});

describe('timeUntil', () => {
  it('zwraca null, gdy mecz jest dalej niż 24h', () => {
    expect(timeUntil(ymd(addDays(3)), '18:00')).toBeNull();
  });
  it('zwraca null bez godziny', () => {
    expect(timeUntil(ymd(addDays(0)))).toBeNull();
  });
});

describe('minutesUntilStart', () => {
  it('positive minutes for a future match', () => {
    const inTwoHours = new Date(Date.now() + 2 * 3600_000);
    const minutes = minutesUntilStart(ymd(inTwoHours), `${String(inTwoHours.getHours()).padStart(2, '0')}:${String(inTwoHours.getMinutes()).padStart(2, '0')}`);
    expect(minutes).toBeGreaterThan(110);
    expect(minutes).toBeLessThanOrEqual(120);
  });

  it('negative minutes once the match has started', () => {
    expect(minutesUntilStart(ymd(addDays(-1)), '18:00')).toBeLessThan(0);
  });

  it('returns null on malformed input instead of throwing', () => {
    expect(minutesUntilStart('', '')).toBeNull();
  });
});

describe('matchWhenLabel', () => {
  it('dziś', () => {
    expect(matchWhenLabel(ymd(addDays(0)), '18:00')).toBe('dziś · 18:00');
  });
  it('jutro', () => {
    expect(matchWhenLabel(ymd(addDays(1)), '18:00')).toBe('jutro · 18:00');
  });
  it('w ciągu tygodnia pokazuje dzień tygodnia', () => {
    const label = matchWhenLabel(ymd(addDays(3)), '18:00');
    expect(label).toMatch(/^w [a-ząćęłńóśźż]+ · 18:00$/);
  });
  it('dalej niż tydzień pokazuje datę', () => {
    const label = matchWhenLabel(ymd(addDays(30)), '18:00');
    expect(label).toMatch(/^\d{1,2} [a-ząćęłńóśźż]+ · 18:00$/);
  });
});
