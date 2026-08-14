// Tablica grupy (migracja `093`) — płaska lista wpisów + przypinanie.
// Kształt wzorem `lib/comments.ts` / `lib/fieldComments.ts`, ale kasowanie
// i przypinanie idą przez `zaktualizujJedenWiersz()`: inaczej niż
// `deleteComment()`, przycisk moderacji nie ma prawa udawać sukcesu, gdy RLS
// po cichu nie zmieniło żadnego wiersza.
import { supabase } from './supabase';
import { zaktualizujJedenWiersz } from './zapytania';
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
 *  w `EventDetailClient.tsx`). Zero kosztu po stronie bazy. */
export function nieprzeczytane(posts: GroupPost[], widzianoIso: string | null): number {
  if (!widzianoIso) return posts.length;
  const widziano = new Date(widzianoIso).getTime();
  if (Number.isNaN(widziano)) return posts.length;
  return posts.filter((p) => new Date(p.createdAt).getTime() > widziano).length;
}
