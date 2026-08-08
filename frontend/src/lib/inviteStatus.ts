// Status imiennego zaproszenia na mecz — widok organizatora „kto odpowiedział"
// (`components/events/EventInvitesStatus.tsx`).
//
// Wydzielone z komponentu po tym, jak przegląd kodu złapał tu błąd: pierwsza
// wersja sprawdzała `dismissedAt` PRZED uczestnictwem, więc ktoś, kto kliknął
// „Nie tym razem" i mimo to dołączył innym kanałem (link, zaproszenie z innej
// ekipy), dostawał etykietę „Nie tym razem" zamiast „Dołączył(a)". Reguła
// biznesowa — uczestnictwo bije wcześniejszą odmowę — jest teraz w jednym
// miejscu i pod testem, żeby ta klasa błędu się nie powtórzyła.

export type InviteStatus = 'waiting' | 'joined' | 'declined';

/** `joinedUserIds` to zbiór user_id z `event_participants` (dowolny status —
 *  skład, rezerwa, oczekujący, obserwujący; strona ma go już wczytanego). */
export function inviteStatus(
  dismissedAt: string | undefined,
  userId: string,
  joinedUserIds: Set<string>,
): InviteStatus {
  if (joinedUserIds.has(userId)) return 'joined';
  if (dismissedAt) return 'declined';
  return 'waiting';
}

const ORDER: Record<InviteStatus, number> = { waiting: 0, joined: 1, declined: 2 };

/** Czekający najpierw (wymagają uwagi organizatora), potem dołączeni, na
 *  końcu ci, którzy odmówili. Do użycia z `Array.prototype.sort`. */
export function compareByInviteStatus(a: InviteStatus, b: InviteStatus): number {
  return ORDER[a] - ORDER[b];
}
