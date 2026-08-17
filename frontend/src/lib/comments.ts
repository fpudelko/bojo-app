import { supabase } from './supabase';
import { zaktualizujJedenWiersz, zPonowieniemPoOdswiezeniu } from './zapytania';
import { getMyActiveEventIds } from './events';
import type { EventComment } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toComment(row: any): EventComment {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    userName: row.user_name,
    body: row.body,
    deletedAt: row.deleted_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function getComments(eventId: string): Promise<EventComment[]> {
  const { data, error } = await supabase
    .from('event_comments')
    .select('*')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toComment);
}

export async function addComment(
  eventId: string,
  userId: string,
  userName: string,
  body: string,
): Promise<EventComment> {
  const safe = body.trim().slice(0, 1000);
  if (!safe) throw new Error('Komentarz nie może być pusty.');

  // Przez `zPonowieniemPoOdswiezeniu`, bo to jest ekran, na którym karta bywa
  // otwarta godzinami: ktoś zagląda do rozmowy rano, pisze wieczorem. Po
  // wygaśnięciu tokenu polityka `auth.uid() = user_id` przestaje pasować
  // i Postgres odsyła komunikat o „row-level security policy" — o czymś, z czym
  // piszący nie ma nic wspólnego. Patrz `lib/zapytania.ts`.
  return zPonowieniemPoOdswiezeniu(async () => {
    const { data, error } = await supabase
      .from('event_comments')
      .insert({ event_id: eventId, user_id: userId, user_name: userName, body: safe })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toComment(data);
  });
}

export async function deleteComment(commentId: string): Promise<void> {
  // `zaktualizujJedenWiersz`, nie gołe `.update()`: kasowanie jest MIĘKKIE
  // (ustawia `deleted_at`), więc niepasująca polityka RLS dałaby zero zmienionych
  // wierszy i sukces — wiadomość zniknęłaby z ekranu, a po odświeżeniu wróciła.
  await zPonowieniemPoOdswiezeniu(() => zaktualizujJedenWiersz(
    'event_comments',
    commentId,
    { deleted_at: new Date().toISOString() },
    'Nie udało się usunąć wiadomości',
  ));
}

/** Klucz w `localStorage` pod którym trzymamy „ostatnio widziano rozmowę
 *  meczu X" — wzorem `kluczTablicaWidziano()` z `groupPosts.ts`. */
export function kluczRozmowyWidziano(eventId: string): string {
  return `bojo:rozmowa-widziano:${eventId}`;
}

/** Ile komentarzy jest nowszych niż ostatnio widziano — jak
 *  `nieprzeczytane()` w `groupPosts.ts`: własne komentarze nigdy nie liczą
 *  się jako nieprzeczytane, bo autor już je widział w momencie wysyłania. */
export function nieprzeczytaneKomentarze(
  comments: Pick<EventComment, 'userId' | 'createdAt'>[],
  widzianoIso: string | null,
  myUserId?: string,
): number {
  const cudze = myUserId ? comments.filter((c) => c.userId !== myUserId) : comments;
  if (!widzianoIso) return cudze.length;
  const widziano = new Date(widzianoIso).getTime();
  if (Number.isNaN(widziano)) return cudze.length;
  return cudze.filter((c) => new Date(c.createdAt).getTime() > widziano).length;
}

/** Surowe komentarze (bez treści) dla wielu meczów naraz — jedno zapytanie
 *  zamiast N, do liczenia plakietek „nieprzeczytane" na kartach meczów
 *  (`/moje-gry`, mecze ekipy) i kropki na dolnej nawigacji. */
export async function getCommentsForUnread(
  eventIds: string[],
): Promise<Pick<EventComment, 'eventId' | 'userId' | 'createdAt'>[]> {
  if (eventIds.length === 0) return [];
  const { data, error } = await supabase
    .from('event_comments')
    .select('event_id, user_id, created_at')
    .in('event_id', eventIds)
    .is('deleted_at', null);
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({ eventId: r.event_id, userId: r.user_id, createdAt: r.created_at }));
}

/** Grupuje wynik `getCommentsForUnread()` po meczu i liczy nieprzeczytane
 *  w każdym — czysta funkcja, `widzianoByEvent` to wywołujący czytający
 *  `localStorage`, żeby zostać testowalną bez DOM-u. Mecze bez
 *  nieprzeczytanych nie trafiają do wyniku. */
export function policzNieprzeczytanePerWydarzenie(
  comments: Pick<EventComment, 'eventId' | 'userId' | 'createdAt'>[],
  myUserId: string,
  widzianoByEvent: (eventId: string) => string | null,
): Record<string, number> {
  const perEvent = new Map<string, Pick<EventComment, 'userId' | 'createdAt'>[]>();
  for (const c of comments) {
    if (!perEvent.has(c.eventId)) perEvent.set(c.eventId, []);
    perEvent.get(c.eventId)!.push(c);
  }
  const wynik: Record<string, number> = {};
  perEvent.forEach((wpisy, eventId) => {
    const n = nieprzeczytaneKomentarze(wpisy, widzianoByEvent(eventId), myUserId);
    if (n > 0) wynik[eventId] = n;
  });
  return wynik;
}

/** Czy w którymkolwiek meczu, w którym gram / jestem na rezerwie / organizuję,
 *  jest nieprzeczytana wiadomość — zasila różową kropkę „nowe wiadomości"
 *  przy „Moje" na dolnej nawigacji (patrz `BottomNav.tsx`). */
export async function hasUnreadEventMessages(userId: string): Promise<boolean> {
  const eventIds = await getMyActiveEventIds(userId);
  if (eventIds.length === 0) return false;
  const comments = await getCommentsForUnread(eventIds);
  const widzianoByEvent = (eventId: string) => (
    typeof window !== 'undefined' ? window.localStorage.getItem(kluczRozmowyWidziano(eventId)) : null
  );
  const counts = policzNieprzeczytanePerWydarzenie(comments, userId, widzianoByEvent);
  return Object.keys(counts).length > 0;
}
