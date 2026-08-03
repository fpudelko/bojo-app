/**
 * Imienne zaproszenia na mecz (`event_player_invites`, migracja 060).
 *
 * Zaproszenie nie zajmuje miejsca w składzie i niczego nie przesądza — jest
 * tylko sposobem, żeby mecz pojawił się u zapraszanego w aplikacji zamiast
 * ginąć w linku wklejonym na czacie. Odpowiedź to zwykłe „Dołączam"
 * / „Obserwuję" / „Odrzucam" na stronie meczu.
 *
 * Nie mylić z `lib/invites.ts` — tamto obsługuje zaproszenia po adresie e-mail
 * z tokenem (tabela `event_invites`, migracja 036) i nie jest dziś używane.
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
