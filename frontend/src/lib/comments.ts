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
/**
 * Nieprzeczytane wiadomości w moich NADCHODZĄCYCH meczach — plus tytuł meczu
 * z najświeższą, do treści dymka „Nowa wiadomość w meczu {tytuł}".
 *
 * TYLKO NADCHODZĄCE, i to jest tu cała rzecz. Wcześniej liczyły się wszystkie
 * mecze, w których kiedykolwiek grałem — także sprzed pół roku. Rozmowa
 * z rozegranego meczu, do której nikt nigdy nie wrócił, zapalała wskaźnik
 * NA ZAWSZE: „Moje" pokazuje wyłącznie nadchodzące, więc nie było jak jej
 * otworzyć, a więc i nie było jak jej odznaczyć. Zgłoszone wprost — „chmurka
 * ciągle się świeci, a wiadomość dawno wyświetlona".
 *
 * Zasada, którą to wprowadza: wskaźnik wolno zapalić wyłącznie za coś, do
 * czego da się dojść z ekranu, na który on wskazuje.
 */
export async function nieprzeczytaneWMeczach(
  userId: string,
): Promise<{ ile: number; tytul: string | null }> {
  const eventIds = await getMyActiveEventIds(userId);
  if (eventIds.length === 0) return { ile: 0, tytul: null };

  const dzis = new Date().toISOString().slice(0, 10);
  const { data: mecze, error } = await supabase
    .from('events')
    .select('id, title, event_date')
    .in('id', eventIds)
    .neq('status', 'cancelled')
    .gte('event_date', dzis);
  if (error || !mecze || mecze.length === 0) return { ile: 0, tytul: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tytuly = new Map((mecze as any[]).map((m) => [m.id as string, m.title as string]));
  // Filtr po `tytuly` ZNOWU, mimo że zapytanie ma już `.in(...)`: bez tego
  // liczba nieprzeczytanych zależy wyłącznie od tego, czy baza odfiltrowała
  // poprawnie. Ta funkcja ma dawać tę samą odpowiedź niezależnie od tego, co
  // wróciło z sieci — wskaźnik zapalony za mecz spoza listy jest dokładnie
  // tym błędem, który tu naprawiamy.
  const comments = (await getCommentsForUnread(Array.from(tytuly.keys())))
    .filter((c) => tytuly.has(c.eventId));
  const widzianoByEvent = (eventId: string) => (
    typeof window !== 'undefined' ? window.localStorage.getItem(kluczRozmowyWidziano(eventId)) : null
  );
  const counts = policzNieprzeczytanePerWydarzenie(comments, userId, widzianoByEvent);
  const zNieprzeczytanymi = Object.keys(counts);
  if (zNieprzeczytanymi.length === 0) return { ile: 0, tytul: null };

  // Tytuł z meczu, w którym padła NAJŚWIEŻSZA nieprzeczytana wiadomość — jeden
  // dymek nie wymieni wszystkich, a najnowsza jest tą, która właśnie zapaliła
  // wskaźnik.
  let najnowsza: { createdAt: string; eventId: string } | null = null;
  for (const c of comments) {
    if (!counts[c.eventId] || c.userId === userId) continue;
    if (!najnowsza || c.createdAt > najnowsza.createdAt) {
      najnowsza = { createdAt: c.createdAt, eventId: c.eventId };
    }
  }
  return {
    ile: zNieprzeczytanymi.length,
    tytul: najnowsza ? tytuly.get(najnowsza.eventId) ?? null : null,
  };
}
