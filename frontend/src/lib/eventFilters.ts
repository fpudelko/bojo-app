// Filtrowanie, grupowanie i sortowanie listy publicznych meczów (/wydarzenia).
//
// Wydzielone z komponentu tak samo jak lib/eventWizard.ts z kreatora: to jest
// logika, którą da się pomylić na kilka sposobów (strefy czasowe, granica
// tygodnia, mecze bez współrzędnych), a w useMemo nie da się jej przetestować.

import { isThisWeek } from 'date-fns';
import type { EventItem } from '@/types';

export type DateFilter = 'wszystkie' | 'dzisiaj' | 'jutro' | 'tydzien' | 'weekend';
export type SortBy = 'termin' | 'odleglosc' | 'miejsca';
export type DayGroup = 'dzisiaj' | 'jutro' | 'tydzien' | 'pozniej';

export const DAY_GROUP_ORDER: DayGroup[] = ['dzisiaj', 'jutro', 'tydzien', 'pozniej'];

export const DAY_GROUP_LABEL: Record<DayGroup, string> = {
  dzisiaj: 'Dzisiaj',
  jutro: 'Jutro',
  tydzien: 'W tym tygodniu',
  pozniej: 'Później',
};

/** Data meczu jako lokalna północ. Bez tego `new Date('2026-08-07')` jest
 *  parsowane jako UTC i w naszej strefie wypada dzień wcześniej. */
export function eventDay(dateStr: string): Date | null {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  } catch { return null; }
}

/** Ile dni dzieli datę od dzisiaj. Ujemne = przeszłość. */
export function daysFromToday(dt: Date, now = new Date()): number {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return Math.round((dt.getTime() - today.getTime()) / 86_400_000);
}

export function matchesDateFilter(dateStr: string, filter: DateFilter, now = new Date()): boolean {
  if (filter === 'wszystkie') return true;
  const dt = eventDay(dateStr);
  if (!dt) return false;
  const diff = daysFromToday(dt, now);

  switch (filter) {
    case 'dzisiaj': return diff === 0;
    case 'jutro':   return diff === 1;
    case 'tydzien': return diff >= 0 && isThisWeek(dt, { weekStartsOn: 1 });
    // Weekend to najbliższa sobota i niedziela, nie „dowolny weekend" — kto
    // filtruje po weekendzie, planuje ten nadchodzący.
    case 'weekend': {
      const dow = dt.getDay(); // 0 = niedziela, 6 = sobota
      return diff >= 0 && diff <= 7 && (dow === 0 || dow === 6);
    }
    default: return true;
  }
}

export function dayGroup(dateStr: string, now = new Date()): DayGroup {
  const dt = eventDay(dateStr);
  if (!dt) return 'pozniej';
  const diff = daysFromToday(dt, now);
  if (diff === 0) return 'dzisiaj';
  if (diff === 1) return 'jutro';
  if (isThisWeek(dt, { weekStartsOn: 1 })) return 'tydzien';
  return 'pozniej';
}

/** Klucz sortowania po realnym starcie meczu.
 *
 *  `getPublicEvents()` sortuje wyłącznie kolumną `event_date`, bez godziny —
 *  mecze tego samego dnia wracały więc w kolejności, jaką akurat dała baza:
 *  ten o 21:00 potrafił stanąć przed tym o 8:00. */
export function startKey(e: Pick<EventItem, 'date' | 'time'>): string {
  return `${e.date}T${(e.time || '23:59').slice(0, 5)}`;
}

export function freeSpots(e: Pick<EventItem, 'maxPlayers' | 'participantsCount'>): number {
  return (e.maxPlayers ?? 0) - (e.participantsCount ?? 0);
}

export interface EventRow {
  event: EventItem;
  /** Kilometry od użytkownika; undefined, gdy mecz nie ma współrzędnych. */
  distance?: number;
}

/**
 * Porządkuje listę. Mecz bez współrzędnych przy sortowaniu po odległości
 * ląduje na końcu — ale nie wypada z wyników, bo brak pinezki nie znaczy,
 * że mecz jest daleko.
 */
export function sortEvents(rows: EventRow[], sortBy: SortBy): EventRow[] {
  const out = [...rows];
  if (sortBy === 'odleglosc') {
    out.sort((a, b) => {
      if (a.distance == null && b.distance == null) {
        return startKey(a.event) < startKey(b.event) ? -1 : 1;
      }
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
  } else if (sortBy === 'miejsca') {
    out.sort((a, b) => freeSpots(b.event) - freeSpots(a.event));
  } else {
    out.sort((a, b) => (startKey(a.event) < startKey(b.event) ? -1 : 1));
  }
  return out;
}

/** Zawęża do wierszy z policzoną odległością ≤ promień. Wiersz bez odległości
 *  (mecz bez współrzędnych albo brak znanej pozycji użytkownika) wypada —
 *  inaczej promień nic by nie znaczył. */
export function filterByRadius(rows: EventRow[], radiusKm: number | null): EventRow[] {
  if (radiusKm == null) return rows;
  return rows.filter((r) => r.distance != null && r.distance <= radiusKm);
}

/** Dzieli listę na sekcje dzienne, zachowując kolejność od dziś w przyszłość. */
export function groupByDay(rows: EventRow[], now = new Date()): { group: DayGroup; rows: EventRow[] }[] {
  const map = new Map<DayGroup, EventRow[]>();
  for (const row of rows) {
    const g = dayGroup(row.event.date, now);
    map.set(g, [...(map.get(g) ?? []), row]);
  }
  return DAY_GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, rows: map.get(g)! }));
}
