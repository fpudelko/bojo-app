// Filtrowanie, grupowanie i sortowanie listy publicznych meczów (/wydarzenia).
//
// Wydzielone z komponentu tak samo jak lib/eventWizard.ts z kreatora: to jest
// logika, którą da się pomylić na kilka sposobów (strefy czasowe, granica
// tygodnia, mecze bez współrzędnych), a w useMemo nie da się jej przetestować.

import { isSameWeek, isSameMonth } from 'date-fns';
import type { EventItem } from '@/types';

export type DateFilter = 'wszystkie' | 'dzisiaj' | 'jutro' | 'tydzien' | 'miesiac';
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
    case 'tydzien': return diff >= 0 && isSameWeek(dt, now, { weekStartsOn: 1 });
    case 'miesiac': return diff >= 0 && isSameMonth(dt, now);
    default: return true;
  }
}

/** `isSameWeek(dt, now, …)`, nie `isThisWeek(dt, …)`.
 *
 *  `isThisWeek` porównuje z PRAWDZIWĄ dzisiejszą datą i ignoruje `now`, które
 *  te funkcje przyjmują właśnie po to, żeby dało się je wywołać dla dowolnego
 *  punktu w czasie. W produkcji różnicy nie widać (tam `now` to i tak dziś),
 *  ale test na ustalonej środzie 2026-08-05 zaczął padać sam z siebie, gdy ta
 *  środa minęła — i taki sam rozjazd wyszedłby wszędzie, gdzie chcielibyśmy
 *  filtrować względem innej daty niż bieżąca. */
export function dayGroup(dateStr: string, now = new Date()): DayGroup {
  const dt = eventDay(dateStr);
  if (!dt) return 'pozniej';
  const diff = daysFromToday(dt, now);
  if (diff === 0) return 'dzisiaj';
  if (diff === 1) return 'jutro';
  if (isSameWeek(dt, now, { weekStartsOn: 1 })) return 'tydzien';
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

/** Cena w groszach; null = bez limitu. */
export function filterByMaxPrice(rows: EventRow[], maxPriceGrosze: number | null): EventRow[] {
  if (maxPriceGrosze == null) return rows;
  return rows.filter((r) => (r.event.costGrosze ?? 0) <= maxPriceGrosze);
}

/** Minimalna liczba wolnych miejsc; 0 = brak ograniczenia. */
export function filterByMinFreeSpots(rows: EventRow[], minSpots: number): EventRow[] {
  if (minSpots <= 0) return rows;
  return rows.filter((r) => freeSpots(r.event) >= minSpots);
}

/** 0 → allLabel; 1 → etykieta jedynej wybranej opcji; >1 → „N wybrane". */
export function multiLabel<T extends string>(
  selected: T[],
  allLabel: string,
  options: { value: T; label: string }[],
): string {
  if (selected.length === 0) return allLabel;
  if (selected.length === 1) return options.find((o) => o.value === selected[0])?.label ?? allLabel;
  return `${selected.length} wybrane`;
}

export function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
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

/** Który mecz pokazać po swipe w panelu szczegółów na mapie — ta sama
 *  kolejność co pinezki (`rows`), zawija się na końcach listy. `null`, gdy
 *  bieżący mecz już nie jest w zbiorze (np. filtr go wyrzucił). */
export function swipeEventId(rows: EventRow[], currentId: string, direction: 1 | -1): string | null {
  if (rows.length === 0) return null;
  const idx = rows.findIndex((r) => r.event.id === currentId);
  if (idx === -1) return null;
  const next = (idx + direction + rows.length) % rows.length;
  return rows[next].event.id;
}
