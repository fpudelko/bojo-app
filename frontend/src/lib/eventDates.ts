// Date/time helpers for events, extracted from component modules
// (EventCard.tsx, EventListCard.tsx) so lib/ code — dashboard hooks in
// particular — can use them without importing from a component file.
// EventCard.tsx and EventListCard.tsx re-export these for backward
// compatibility; existing imports from those paths keep working unchanged.

import { isFuture, isToday, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { EventItem } from '@/types';

// `format(date, 'EEEE', { locale: pl })` zwraca mianownik ("niedziela",
// "środa", "sobota") — poprawne po polsku jest „w niedzielę", „w środę",
// „w sobotę" (biernik). Pozostałe dni mają tę samą formę w obu przypadkach.
// Zgłoszone wprost z sesji QA: „w niedziela".
const DZIEN_W_BIERNIKU: Record<string, string> = {
  środa: 'środę',
  sobota: 'sobotę',
  niedziela: 'niedzielę',
};

export function dzienTygodniaWBierniku(date: Date): string {
  const mianownik = format(date, 'EEEE', { locale: pl });
  return DZIEN_W_BIERNIKU[mianownik] ?? mianownik;
}

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

/** Minutes until the match starts; negative once it has started. null when the
 *  date/time can't be parsed. Used to gate BLIK-phone visibility (payments.ts). */
export function minutesUntilStart(date: string, time?: string): number | null {
  try {
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = (time ?? '00:00').split(':').map(Number);
    const ms = new Date(y, m - 1, d, h, min).getTime() - Date.now();
    if (Number.isNaN(ms)) return null;
    return Math.round(ms / 60_000);
  } catch { return null; }
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
 *  used by the match cards on /moje-gry, where the date is the primary copy. */
export function matchWhenLabel(date: string, time?: string): string {
  const timeSuffix = time ? ` · ${time.slice(0, 5)}` : '';
  try {
    const [y, m, d] = date.split('-').map(Number);
    const eventDay = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86_400_000);

    if (diffDays === 0) return `dziś${timeSuffix}`;
    if (diffDays === 1) return `jutro${timeSuffix}`;
    if (diffDays > 1 && diffDays < 7) return `w ${dzienTygodniaWBierniku(eventDay)}${timeSuffix}`;
    return `${format(eventDay, 'd MMM', { locale: pl })}${timeSuffix}`;
  } catch {
    return time ? time.slice(0, 5) : '';
  }
}

/**
 * „do 18:30" / „do jutra, 18:30" / „do pojutrza, 18:30" / „do 16.09, 18:30" —
 * kompaktowa etykieta TERMINU (np. oferty zwolnionego miejsca z rezerwy),
 * pomyślana do pokazania KAŻDEMU patrzącemu na kolejkę, nie tylko osobie,
 * której dotyczy — stąd bez nazwy dnia tygodnia: „do niedzieli"/„do środy"
 * wymagałoby mapy odmian jak `dzienTygodniaWBierniku`, a i tak zdarzyłoby się
 * rzadziej niż samo „jutro"/„pojutrze" przy oknie ofert do 72 h.
 */
export function krotkiTermin(d: Date): string {
  const godzina = format(d, 'HH:mm');
  if (d.getTime() <= Date.now()) return 'czas minął';
  const dzis = new Date(); dzis.setHours(0, 0, 0, 0);
  const dzien = new Date(d); dzien.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dzien.getTime() - dzis.getTime()) / 86_400_000);
  if (diffDays <= 0) return `do ${godzina}`;
  if (diffDays === 1) return `do jutra, ${godzina}`;
  if (diffDays === 2) return `do pojutrza, ${godzina}`;
  return `do ${format(d, 'd.MM')}, ${godzina}`;
}

/**
 * „sobota, 30 sierpnia · za 3 dni" — pełny opis wybranej daty, do postawienia
 * POD polem `<input type="date">` w kreatorze i w edycji meczu.
 *
 * PO CO. Natywne pole daty pokazuje samą datę, w formacie zależnym od
 * ustawień telefonu — i nigdy nie mówi, jaki to dzień tygodnia. Organizator
 * rezerwuje boisko na czwartek, wybiera z kalendarza środę i dowiaduje się
 * o tym najwcześniej na kroku 3, z podsumowania przed publikacją. W EDYCJI nie
 * dowiaduje się w ogóle, bo tam podsumowania nie ma. Zła data jest przy tym
 * najczęstszą pomyłką organizatora — i jedyną, którą widać natychmiast, jeśli
 * tylko nazwać dzień po imieniu.
 *
 * DLACZEGO NIE `matchWhenLabel`. Tamta jest etykietą karty i celowo skraca
 * („w piątek · 18:00"). Tutaj potrzebna jest odwrotność: pełna data ROZWINIĘTA,
 * żeby dało się ją porównać z tym, co organizator ma zapisane w telefonie.
 *
 * Zwraca pusty ciąg dla daty, której nie da się sparsować — wywołujący ma
 * wtedy nie renderować nic, zamiast pokazywać „Invalid Date".
 */
export function opisDaty(date: string): string {
  if (!date) return '';
  try {
    const [y, m, d] = date.split('-').map(Number);
    if (!y || !m || !d) return '';
    const dzien = new Date(y, m - 1, d);
    if (Number.isNaN(dzien.getTime())) return '';

    const dzisiaj = new Date(); dzisiaj.setHours(0, 0, 0, 0);
    const roznica = Math.round((dzien.getTime() - dzisiaj.getTime()) / 86_400_000);

    const pelna = format(dzien, 'EEEE, d MMMM', { locale: pl });

    let odleglosc: string;
    if (roznica < 0) odleglosc = 'termin minął';
    else if (roznica === 0) odleglosc = 'dzisiaj';
    else if (roznica === 1) odleglosc = 'jutro';
    else if (roznica < 7) odleglosc = `za ${roznica} dni`;
    else if (roznica < 14) odleglosc = 'za tydzień';
    // Tygodnie liczymy podłogą, nie zaokrągleniem: „za 3 tygodnie" przy 25
    // dniach obiecuje termin bliższy, niż jest naprawdę.
    else odleglosc = `za ${Math.floor(roznica / 7)} tyg.`;

    return `${pelna} · ${odleglosc}`;
  } catch {
    return '';
  }
}
