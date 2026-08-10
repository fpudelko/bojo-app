/**
 * Imienne zaproszenia na mecz (`event_player_invites`, migracja 060).
 *
 * Zaproszenie nie zajmuje miejsca w składzie i niczego nie przesądza — jest
 * tylko sposobem, żeby mecz pojawił się u zapraszanego w aplikacji zamiast
 * ginąć w linku wklejonym na czacie. Odpowiedź to zwykłe „Dołączam"
 * / „Obserwuję" / „Odrzucam" na stronie meczu.
 *
 * Nie mylić z tabelą `event_invites` (migracja 036, zaproszenia po adresie
 * e-mail z tokenem) — ten model danych zostaje niewykorzystany, kod, który go
 * obsługiwał (`lib/invites.ts`), usunięto jako martwy (audyt O-26).
 */

import { supabase } from './supabase';
import { toEvent } from './events';
import type { EventItem } from '@/types';

export interface PlayerInvite {
  id: string;
  eventId: string;
  userId: string;
  invitedBy?: string;
  groupId?: string;
  createdAt: string;
  dismissedAt?: string;
}

export interface InviteWithEvent {
  invite: PlayerInvite;
  event: EventItem;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPlayerInvite(row: any): PlayerInvite {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    invitedBy: row.invited_by ?? undefined,
    groupId: row.group_id ?? undefined,
    createdAt: row.created_at,
    dismissedAt: row.dismissed_at ?? undefined,
  };
}

/** Aktywne zaproszenia użytkownika — tylko na nadchodzące, nieodwołane mecze. */
export async function getMyInvites(userId: string): Promise<InviteWithEvent[]> {
  const { data, error } = await supabase
    .from('event_player_invites')
    .select('*, events(*, event_participants(id, is_reserve, pending_approval))')
    .eq('user_id', userId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const today = new Date().toISOString().slice(0, 10);
  return (
    (data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => r.events?.status === 'active' && r.events.event_date >= today)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => ({ invite: toPlayerInvite(r), event: toEvent(r.events) }))
  );
}

/** Kto już dostał zaproszenie na ten mecz — żeby nie proponować go drugi raz. */
export async function getEventPlayerInvites(eventId: string): Promise<PlayerInvite[]> {
  const { data, error } = await supabase
    .from('event_player_invites')
    .select('*')
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPlayerInvite);
}

export interface InviteWithName extends PlayerInvite {
  name: string;
  avatarUrl?: string;
}

/**
 * Zaproszenia na mecz razem z nazwą i awatarem zaproszonego — dla widoku
 * organizatora „kogo zaprosiłem, kto odpowiedział". Bez tego `dismissed_at`
 * istniał w bazie od migracji 060, ale nigdzie się go nie pokazywało.
 *
 * Dwa zapytania, nie jeden `select` z zagnieżdżeniem: `event_player_invites`
 * ma klucz obcy do `auth.users`, nie do `profiles`, więc PostgREST nie potrafi
 * tego wbudować jednym joinem. `profiles` jest publicznie czytelne (migracja
 * `005`), więc drugie zapytanie nie wymaga żadnych dodatkowych uprawnień.
 *
 * Widoczność jest i tak ograniczona politykami RLS z migracji `060` — SELECT
 * na `event_player_invites` widzi tylko sam zaproszony, organizator meczu
 * i admin, więc funkcja zwraca pełną listę wyłącznie tym, komu wolno ją
 * zobaczyć.
 */
export async function getEventInvitesWithNames(eventId: string): Promise<InviteWithName[]> {
  const invites = await getEventPlayerInvites(eventId);
  if (invites.length === 0) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', invites.map((i) => i.userId));
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map((data ?? []).map((p: any) => [p.id as string, p]));

  return invites.map((inv) => {
    const p = byId.get(inv.userId);
    return {
      ...inv,
      name: (p?.display_name as string | undefined)?.trim() || 'Gracz',
      avatarUrl: (p?.avatar_url as string | undefined) ?? undefined,
    };
  });
}

/**
 * Zaprasza wskazane osoby i zwraca liczbę faktycznie dodanych zaproszeń.
 *
 * Duplikaty są pomijane po stronie bazy (`UNIQUE (event_id, user_id)`), więc
 * powtórne „zaproś grupę" po dojściu nowego członka nie wskrzesza zaproszenia,
 * które ktoś wcześniej świadomie odrzucił.
 */
export async function invitePlayers(
  eventId: string,
  userIds: string[],
  opts: { invitedBy: string; groupId?: string },
): Promise<number> {
  if (userIds.length === 0) return 0;
  const rows = userIds.map((userId) => ({
    event_id: eventId,
    user_id: userId,
    invited_by: opts.invitedBy,
    group_id: opts.groupId ?? null,
  }));
  const { data, error } = await supabase
    .from('event_player_invites')
    .upsert(rows, { onConflict: 'event_id,user_id', ignoreDuplicates: true })
    .select('id');
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/** Zaproszony chowa zaproszenie. Wiersz zostaje, żeby nie wróciło. */
export async function dismissInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('event_player_invites')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', inviteId);
  if (error) throw new Error(error.message);
}
