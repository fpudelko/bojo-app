// Date/time helpers for events, extracted from component modules
// (EventCard.tsx, EventListCard.tsx) so lib/ code — dashboard hooks in
// particular — can use them without importing from a component file.
// EventCard.tsx and EventListCard.tsx re-export these for backward
// compatibility; existing imports from those paths keep working unchanged.

import { isFuture, isToday, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { EventItem } from '@/types';

export function isUpcoming(event: EventItem): boolean {
  try {
    const [y, m, d] = event.date.split('-').map(Number);
    const eventDate = new Date(y, m - 1, d);
    return isFuture(eventDate) || isToday(eventDate);
  } catch { return false; }
}

/** True when the event's start time hasn't passed yet (used for open-games listings). */
export function isEventJoinable(event: EventItem): boolean {
  try {
    const [y, m, d] = event.date.split('-').map(Number);
    const [h, min] = (event.time ?? '23:59').split(':').map(Number);
    return Date.now() < new Date(y, m - 1, d, h, min).getTime();
  } catch { return false; }
}

/** "za 2 h" / "za 30 min" within 24h, else null */
export function timeUntil(date: string, time?: string): string | null {
  if (!time) return null;
  try {
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    const ms = new Date(y, m - 1, d, h, min).getTime() - Date.now();
    if (ms <= 0 || ms > 24 * 3600_000) return null;
    const hours = ms / 3600_000;
    if (hours < 1) return `za ${Math.round(hours * 60)} min`;
    return `za ${Math.round(hours)} h`;
  } catch { return null; }
}

/** "dziś · 18:00" / "jutro · 18:00" / "w piątek · 18:00" / "12 wrz · 18:00" —
 *  used by NextMatchCard, where the match's date is the primary piece of copy. */
export function matchWhenLabel(date: string, time?: string): string {
  const timeSuffix = time ? ` · ${time.slice(0, 5)}` : '';
  try {
    const [y, m, d] = date.split('-').map(Number);
    const eventDay = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86_400_000);

    if (diffDays === 0) return `dziś${timeSuffix}`;
    if (diffDays === 1) return `jutro${timeSuffix}`;
    if (diffDays > 1 && diffDays < 7) return `w ${format(eventDay, 'EEEE', { locale: pl })}${timeSuffix}`;
    return `${format(eventDay, 'd MMM', { locale: pl })}${timeSuffix}`;
  } catch {
    return time ? time.slice(0, 5) : '';
  }
}
