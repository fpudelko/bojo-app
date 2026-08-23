// Tablica grupy (migracja `093`) — płaska lista wpisów + przypinanie.
// Kształt wzorem `lib/comments.ts` / `lib/fieldComments.ts`, ale kasowanie
// i przypinanie idą przez `zaktualizujJedenWiersz()`: inaczej niż
// `deleteComment()`, przycisk moderacji nie ma prawa udawać sukcesu, gdy RLS
// po cichu nie zmieniło żadnego wiersza.
import { supabase } from './supabase';
import { zPonowieniemPoOdswiezeniu, zaktualizujJedenWiersz } from './zapytania';
import type { RozmowaNaLiscie, RozmowaNieprzeczytana } from './comments';
import type { GroupPost } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGroupPost(row: any): GroupPost {
  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    userName: row.user_name,
    body: row.body,
    pinnedAt: row.pinned_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    createdAt: row.created_at,
  };
}

/** Wpisy tablicy, przypięty pierwszy, reszta malejąco po dacie. Zamknięte dla
 *  nie-członków przez RLS (`czy_czlonek_grupy`, migracja `092`) — nie-członek
 *  dostaje po prostu pustą listę, nie błąd. */
export async function getGroupPosts(groupId: string, limit = 50): Promise<GroupPost[]> {
  const { data, error } = await supabase
    .from('group_posts')
    .select('*')
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toGroupPost);
}

export async function addGroupPost(
  groupId: string,
  userId: string,
  userName: string,
  body: string,
  opts?: { przypnij?: boolean },
): Promise<GroupPost> {
  // Przycięte tu, nie tylko w bazie — CHECK (1..1000) w SQL-u zwróciłby suchy
  // błąd Postgresa zamiast po prostu skrócić wpis.
  const safe = body.trim().slice(0, 1000);
  if (!safe) throw new Error('Wpis nie może być pusty.');
  // Tablica ekipy to drugi ekran, na którym karta wisi otwarta godzinami —
  // ta sama pułapka co w rozmowie meczu: token wygasa, aplikacja dalej wygląda
  // na zalogowaną, a baza odsyła komunikat o polityce bezpieczeństwa.
  return zPonowieniemPoOdswiezeniu(async () => {
    const { data, error } = await supabase
      .from('group_posts')
      .insert({
        group_id: groupId,
        user_id: userId,
        user_name: userName,
        body: safe,
        pinned_at: opts?.przypnij ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toGroupPost(data);
  });
}

/** Miękkie kasowanie. Autor albo moderator (`can_moderate_wall`) — RLS
 *  (migracja `093`) odmawia reszcie; `zaktualizujJedenWiersz` zamienia tę
 *  odmowę w wyjątek zamiast fałszywego sukcesu. */
export async function deleteGroupPost(postId: string): Promise<void> {
  await zaktualizujJedenWiersz(
    'group_posts',
    postId,
    { deleted_at: new Date().toISOString() },
    'Nie udało się usunąć wpisu',
  );
}

/** Przypina albo odpina wpis. Autor może przypiąć własny wpis (RLS jest
 *  wierszowe), ale powiadomienie do całej ekipy poleci tylko wtedy, gdy
 *  przypina ktoś z `can_moderate_wall` — pilnuje tego wyzwalacz w bazie. */
export async function setGroupPostPinned(postId: string, przypiety: boolean): Promise<void> {
  await zaktualizujJedenWiersz(
    'group_posts',
    postId,
    { pinned_at: przypiety ? new Date().toISOString() : null },
    przypiety ? 'Nie udało się przypiąć wpisu' : 'Nie udało się odpiąć wpisu',
  );
}

/** Ile wpisów jest nowszych niż ostatnio widziano — czysta funkcja, znacznik
 *  „ostatnio widziano" trzyma wywołujący w `localStorage`
 *  (`bojo:tablica-widziano:<groupId>`, wzorem `bojo:goscie-cta-widziano:*`
 *  w `EventDetailClient.tsx`). Zero kosztu po stronie bazy.
 *
 *  Własne wpisy nigdy nie liczą się jako nieprzeczytane — wysyłający już je
 *  widział w momencie wysyłania (zgłoszone wprost: plakietka świeciła się
 *  po własnej wiadomości). `myUserId` opcjonalne, żeby wywołania bez
 *  znajomości tożsamości (np. testy) nie musiały nic filtrować. */
export function nieprzeczytane(
  posts: Pick<GroupPost, 'userId' | 'createdAt'>[],
  widzianoIso: string | null,
  myUserId?: string,
): number {
  const cudze = myUserId ? posts.filter((p) => p.userId !== myUserId) : posts;
  if (!widzianoIso) return cudze.length;
  const widziano = new Date(widzianoIso).getTime();
  if (Number.isNaN(widziano)) return cudze.length;
  return cudze.filter((p) => new Date(p.createdAt).getTime() > widziano).length;
}

/** Klucz w `localStorage` pod którym trzymamy „ostatnio widziano tablicę
 *  grupy X" — jedna definicja, żeby `/grupy/[id]` (zapisuje) i `/grupy`
 *  (czyta, żeby policzyć plakietki na kartach) nie mogły się rozjechać. */
export function kluczTablicaWidziano(groupId: string): string {
  return `bojo:tablica-widziano:${groupId}`;
}

/** Surowe wpisy (bez treści) dla wielu grup naraz — jedno zapytanie zamiast
 *  N, do liczenia plakietek „nieprzeczytane" na kartach ekip na `/grupy`.
 *  RLS i tak zwraca tylko grupy, w których jestem członkiem. */
export async function getGroupPostsForUnread(
  groupIds: string[],
): Promise<Pick<GroupPost, 'id' | 'groupId' | 'userId' | 'createdAt'>[]> {
  if (groupIds.length === 0) return [];
  const { data, error } = await supabase
    .from('group_posts')
    .select('id, group_id, user_id, created_at')
    .in('group_id', groupIds)
    .is('deleted_at', null);
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({ id: r.id, groupId: r.group_id, userId: r.user_id, createdAt: r.created_at }));
}

/** Grupuje wynik `getGroupPostsForUnread()` po grupie i liczy nieprzeczytane
 *  w każdej — czysta funkcja, `widzianoByGroup` to wywołujący czytający
 *  `localStorage` (`kluczTablicaWidziano`), żeby ta funkcja została testowalna
 *  bez DOM-u. Grupy bez nieprzeczytanych nie trafiają do wyniku. */
export function policzNieprzeczytanePerGrupa(
  posts: Pick<GroupPost, 'groupId' | 'userId' | 'createdAt'>[],
  myUserId: string,
  widzianoByGroup: (groupId: string) => string | null,
): Record<string, number> {
  const perGrupa = new Map<string, Pick<GroupPost, 'userId' | 'createdAt'>[]>();
  for (const p of posts) {
    if (!perGrupa.has(p.groupId)) perGrupa.set(p.groupId, []);
    perGrupa.get(p.groupId)!.push(p);
  }
  const wynik: Record<string, number> = {};
  perGrupa.forEach((wpisy, groupId) => {
    const n = nieprzeczytane(wpisy, widzianoByGroup(groupId), myUserId);
    if (n > 0) wynik[groupId] = n;
  });
  return wynik;
}

/** Czy w którejkolwiek mojej ekipie jest nieprzeczytany wpis na tablicy —
 *  zasila różową kropkę „nowe wiadomości" przy „Grupy" na dolnej nawigacji
 *  (patrz `BottomNav.tsx`). `groupIds` — id-ki grup, w których jestem
 *  członkiem (`getMyGroupIds()` z `groups.ts`, tu nie importowane, żeby
 *  uniknąć cyklu `groups.ts` ↔ `groupPosts.ts`). */
export async function hasUnreadGroupMessages(userId: string, groupIds: string[]): Promise<boolean> {
  if (groupIds.length === 0) return false;
  const posts = await getGroupPostsForUnread(groupIds);
  const widzianoByGroup = (groupId: string) => (
    typeof window !== 'undefined' ? window.localStorage.getItem(kluczTablicaWidziano(groupId)) : null
  );
  const counts = policzNieprzeczytanePerGrupa(posts, userId, widzianoByGroup);
  return Object.keys(counts).length > 0;
}

/** Moje ekipy z nieprzeczytanym wpisem na tablicy, od najświeższego —
 *  odpowiednik `rozmowyZNieprzeczytanymi()` z `comments.ts`, dla grup zamiast
 *  meczów. Karmi panel rozmów otwierany przytrzymaniem „Moje" (`BottomNav.tsx`).
 *  Parametr strukturalny, nie `Group` — import typu z `groups.ts` zamknąłby
 *  cykl `groups.ts` ↔ `groupPosts.ts`. */
/** WSZYSTKIE tablice moich ekip, od najświeższej — także przeczytane.
 *  Bliźniak `wszystkieRozmowyMeczow()`; uzasadnienie tam. */
export async function wszystkieRozmowyGrup(
  userId: string,
  groups: { id: string; name: string }[],
): Promise<RozmowaNaLiscie[]> {
  if (groups.length === 0) return [];

  const { data: wiersze } = await supabase
    .from('group_posts')
    .select('group_id, user_id, user_name, body, created_at')
    .in('group_id', groups.map((g) => g.id))
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wpisy = ((wiersze ?? []) as any[]);
  if (wpisy.length === 0) return [];

  const widziano = (groupId: string) => (
    typeof window !== 'undefined' ? window.localStorage.getItem(kluczTablicaWidziano(groupId)) : null
  );
  const counts = policzNieprzeczytanePerGrupa(
    wpisy.map((p) => ({ groupId: p.group_id, userId: p.user_id, createdAt: p.created_at })),
    userId, widziano,
  );

  const ostatnie = new Map<string, (typeof wpisy)[number]>();
  for (const p of wpisy) if (!ostatnie.has(p.group_id)) ostatnie.set(p.group_id, p);

  return Array.from(ostatnie.entries())
    .map(([groupId, p]) => ({
      id: groupId,
      tytul: groups.find((g) => g.id === groupId)?.name ?? '',
      ile: counts[groupId] ?? 0,
      najnowsza: p.created_at as string,
      ostatnia: (p.body as string | null)?.replace(/\s+/g, ' ').trim() ?? '',
      autor: (p.user_name as string | null) ?? 'Ktoś',
      moja: p.user_id === userId,
    }))
    .sort((a, b) => b.najnowsza.localeCompare(a.najnowsza));
}

export async function rozmowyGrupZNieprzeczytanymi(
  userId: string,
  groups: { id: string; name: string }[],
): Promise<RozmowaNieprzeczytana[]> {
  if (groups.length === 0) return [];
  const posts = await getGroupPostsForUnread(groups.map((g) => g.id));
  const widziano = (groupId: string) => (
    typeof window !== 'undefined' ? window.localStorage.getItem(kluczTablicaWidziano(groupId)) : null
  );
  const counts = policzNieprzeczytanePerGrupa(posts, userId, widziano);

  const najnowszaByGroup = new Map<string, string>();
  for (const p of posts) {
    if (!counts[p.groupId] || p.userId === userId) continue;
    const obecna = najnowszaByGroup.get(p.groupId);
    if (!obecna || p.createdAt > obecna) najnowszaByGroup.set(p.groupId, p.createdAt);
  }

  return Object.keys(counts)
    .map((groupId) => ({
      id: groupId,
      tytul: groups.find((g) => g.id === groupId)?.name ?? '',
      ile: counts[groupId],
      najnowsza: najnowszaByGroup.get(groupId) ?? '',
    }))
    .sort((a, b) => b.najnowsza.localeCompare(a.najnowsza));
}

/** Nazwa ekipy z najświeższą nieprzeczytaną wiadomością — treść dymka
 *  „Nowa wiadomość w grupie {nazwa}" na dolnej nawigacji (`BottomNav.tsx`).
 *  Cienka nakładka na `rozmowyGrupZNieprzeczytanymi()`. */
export async function getUnreadGroupName(
  userId: string,
  groups: { id: string; name: string }[],
): Promise<string | null> {
  const lista = await rozmowyGrupZNieprzeczytanymi(userId, groups);
  return lista[0]?.tytul || null;
}
