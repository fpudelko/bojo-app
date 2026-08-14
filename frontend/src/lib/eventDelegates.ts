// Delegowanie uprawnień organizatora — patrz migracja 089/090 i
// docs/domena.md (sekcja o rolach). Trzy niezależne przełączniki: can_edit
// (jak organizator, włącznie z odwołaniem meczu), can_manage_squad (składy,
// wynik, uczestnicy), can_manage_payments (rozliczenia, BLIK).
import { supabase } from './supabase';
import type { PaymentMethod } from '@/types';

export interface DelegateCandidate {
  userId: string;
  name: string;
  avatarUrl?: string;
  source: 'uczestnik' | 'grupa';
}

export interface EventDelegate {
  userId: string;
  name: string;
  avatarUrl?: string;
  canEdit: boolean;
  canManageSquad: boolean;
  canManagePayments: boolean;
}

/** Moje własne uprawnienia delegata na tym meczu — `null`, gdy nie mam żadnych. */
export interface MyDelegatePermissions {
  canEdit: boolean;
  canManageSquad: boolean;
  canManagePayments: boolean;
}

export async function getMyDelegatePermissions(eventId: string, userId: string): Promise<MyDelegatePermissions | null> {
  const { data, error } = await supabase
    .from('event_delegates')
    .select('can_edit, can_manage_squad, can_manage_payments')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    canEdit: data.can_edit,
    canManageSquad: data.can_manage_squad,
    canManagePayments: data.can_manage_payments,
  };
}

/** Kandydaci na delegata: uczestnicy meczu z kontem (nie goście, nie
 *  rezerwowi/oczekujący) + — jeśli mecz jest przypięty do grupy — członkowie
 *  tej grupy, nawet gdy nie grają w tym konkretnym meczu (organizator, który
 *  sam nie gra, i tak musi mieć kogo wybrać). Deduplikacja po user_id. */
export async function getDelegateCandidates(eventId: string, groupId: string | null): Promise<DelegateCandidate[]> {
  const [participantsRes, groupRes] = await Promise.all([
    supabase
      .from('event_participants')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('is_guest', false)
      .not('user_id', 'is', null),
    groupId
      ? supabase.from('group_members').select('user_id').eq('group_id', groupId)
      : Promise.resolve({ data: [] as { user_id: string }[], error: null }),
  ]);
  if (participantsRes.error) throw new Error(participantsRes.error.message);
  if (groupRes.error) throw new Error(groupRes.error.message);

  const bySource = new Map<string, 'uczestnik' | 'grupa'>();
  for (const row of participantsRes.data ?? []) bySource.set(row.user_id as string, 'uczestnik');
  for (const row of (groupRes.data ?? []) as { user_id: string }[]) {
    if (!bySource.has(row.user_id)) bySource.set(row.user_id, 'grupa');
  }
  if (bySource.size === 0) return [];

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', Array.from(bySource.keys()));
  if (profileError) throw new Error(profileError.message);

  return (profileRows ?? []).map((p) => ({
    userId: p.id,
    name: p.display_name ?? 'Gracz',
    avatarUrl: p.avatar_url ?? undefined,
    source: bySource.get(p.id) ?? 'uczestnik',
  }));
}

export async function getEventDelegates(eventId: string): Promise<EventDelegate[]> {
  const { data, error } = await supabase
    .from('event_delegates')
    .select('user_id, can_edit, can_manage_squad, can_manage_payments')
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', data.map((d) => d.user_id));
  if (profileError) throw new Error(profileError.message);
  const profiles = new Map((profileRows ?? []).map((p) => [p.id, p]));

  return data.map((d) => ({
    userId: d.user_id,
    name: profiles.get(d.user_id)?.display_name ?? 'Gracz',
    avatarUrl: profiles.get(d.user_id)?.avatar_url ?? undefined,
    canEdit: d.can_edit,
    canManageSquad: d.can_manage_squad,
    canManagePayments: d.can_manage_payments,
  }));
}

export async function setEventDelegate(
  eventId: string,
  userId: string,
  perms: { canEdit: boolean; canManageSquad: boolean; canManagePayments: boolean },
): Promise<void> {
  const none = !perms.canEdit && !perms.canManageSquad && !perms.canManagePayments;
  if (none) {
    const { error } = await supabase
      .from('event_delegates').delete().eq('event_id', eventId).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('event_delegates').upsert({
    event_id: eventId,
    user_id: userId,
    can_edit: perms.canEdit,
    can_manage_squad: perms.canManageSquad,
    can_manage_payments: perms.canManagePayments,
    granted_by: auth.user?.id,
  });
  if (error) throw new Error(error.message);
}

/** Ustawia zaakceptowane metody płatności i numer BLIK przez dedykowaną RPC —
 *  NIE przez ogólny UPDATE na `events`, żeby delegat z samym can_manage_payments
 *  (bez can_edit) mógł to zrobić bez dostępu do reszty pól wydarzenia
 *  (RLS na `events` nie przepuszcza go — patrz migracja 090). */
export async function setPaymentSettings(
  eventId: string,
  acceptedPaymentMethods: PaymentMethod[],
  blikPhone: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('event_set_payment_settings', {
    p_event_id: eventId,
    p_accepted_payment_methods: acceptedPaymentMethods,
    p_blik_phone: blikPhone,
  });
  if (error) throw new Error(error.message);
}
