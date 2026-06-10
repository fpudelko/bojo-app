import { supabase } from './supabase';

export interface EventInvite {
  id: string;
  eventId: string;
  email: string;
  invitedBy?: string;
  token: string;
  note?: string;
  acceptedAt?: string;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toInvite(row: any): EventInvite {
  return {
    id: row.id,
    eventId: row.event_id,
    email: row.email,
    invitedBy: row.invited_by ?? undefined,
    token: row.token,
    note: row.note ?? undefined,
    acceptedAt: row.accepted_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function getEventInvites(eventId: string): Promise<EventInvite[]> {
  const { data, error } = await supabase
    .from('event_invites')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toInvite);
}

export async function createInvite(
  eventId: string,
  email: string,
  invitedBy: string,
): Promise<EventInvite> {
  const { data, error } = await supabase
    .from('event_invites')
    .insert({ event_id: eventId, email: email.trim().toLowerCase(), invited_by: invitedBy })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toInvite(data);
}

export async function deleteInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from('event_invites').delete().eq('id', inviteId);
  if (error) throw new Error(error.message);
}

export async function validateInviteToken(token: string): Promise<EventInvite | null> {
  const { data } = await supabase
    .from('event_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  return data ? toInvite(data) : null;
}

export async function acceptInvite(token: string): Promise<void> {
  const { error } = await supabase
    .from('event_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('token', token);
  if (error) throw new Error(error.message);
}

/** Opens the user's mail client with a pre-filled invite message. */
export function openInviteMailto(
  email: string,
  eventTitle: string,
  inviterName: string,
  inviteUrl: string,
): void {
  const subject = encodeURIComponent(`Zaproszenie na mecz: ${eventTitle}`);
  const body = encodeURIComponent(
    `Hej!\n\n${inviterName} zaprasza Cię na mecz — ${eventTitle}.\n\nDołącz tutaj:\n${inviteUrl}\n\nDo zobaczenia na boisku!`,
  );
  window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
}
