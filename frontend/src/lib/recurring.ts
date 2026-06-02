import { supabase } from './supabase';
import { createEvent } from './events';
import type { RecurringEvent, RecurringEventInvite, Visibility } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRecurringEvent(row: any): RecurringEvent {
  return {
    id: row.id,
    organizerId: row.organizer_id,
    organizerName: row.organizer_name,
    sport: row.sport,
    fieldId: row.field_id ?? undefined,
    fieldName: row.field_name,
    lat: row.lat != null ? Number(row.lat) : undefined,
    lng: row.lng != null ? Number(row.lng) : undefined,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    dayOfWeek: row.day_of_week,
    eventTime: row.event_time,
    endTime: row.end_time ?? undefined,
    maxPlayers: row.max_players,
    visibility: row.visibility,
    notifyDaysBefore: row.notify_days_before,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toInvite(row: any): RecurringEventInvite {
  return {
    id: row.id,
    recurringEventId: row.recurring_event_id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    createdAt: row.created_at,
  };
}

interface RecurringEventData {
  sport: string;
  fieldId?: string;
  fieldName: string;
  lat?: number;
  lng?: number;
  title?: string;
  description?: string;
  dayOfWeek: number;
  eventTime: string;
  endTime?: string;
  maxPlayers: number;
  visibility: Visibility;
  notifyDaysBefore: number;
}

export async function createRecurringEvent(
  data: RecurringEventData,
  organizerId: string,
  organizerName: string,
): Promise<string> {
  const { data: row, error } = await supabase
    .from('recurring_events')
    .insert({
      organizer_id: organizerId,
      organizer_name: organizerName,
      sport: data.sport,
      field_id: data.fieldId ?? null,
      field_name: data.fieldName,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      title: data.title ?? null,
      description: data.description ?? null,
      day_of_week: data.dayOfWeek,
      event_time: data.eventTime,
      end_time: data.endTime ?? null,
      max_players: data.maxPlayers,
      visibility: data.visibility,
      notify_days_before: data.notifyDaysBefore,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return row.id as string;
}

export async function updateRecurringEvent(id: string, data: RecurringEventData): Promise<void> {
  const { error } = await supabase
    .from('recurring_events')
    .update({
      sport: data.sport,
      field_id: data.fieldId ?? null,
      field_name: data.fieldName,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      title: data.title ?? null,
      description: data.description ?? null,
      day_of_week: data.dayOfWeek,
      event_time: data.eventTime,
      end_time: data.endTime ?? null,
      max_players: data.maxPlayers,
      visibility: data.visibility,
      notify_days_before: data.notifyDaysBefore,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function getRecurringEvent(
  id: string,
): Promise<{ event: RecurringEvent; invites: RecurringEventInvite[] }> {
  const { data: eventRow, error } = await supabase
    .from('recurring_events')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);

  const { data: inviteRows, error: iErr } = await supabase
    .from('recurring_event_invites')
    .select('*')
    .eq('recurring_event_id', id)
    .order('created_at', { ascending: true });
  if (iErr) throw new Error(iErr.message);

  return {
    event: toRecurringEvent(eventRow),
    invites: (inviteRows ?? []).map(toInvite),
  };
}

export async function getMyRecurringEvents(userId: string): Promise<RecurringEvent[]> {
  const { data, error } = await supabase
    .from('recurring_events')
    .select('*')
    .eq('organizer_id', userId)
    .order('day_of_week', { ascending: true })
    .order('event_time', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toRecurringEvent);
}

export async function addInvite(
  recurringEventId: string,
  name: string,
  email?: string,
  phone?: string,
): Promise<void> {
  const { error } = await supabase.from('recurring_event_invites').insert({
    recurring_event_id: recurringEventId,
    name,
    email: email ?? null,
    phone: phone ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function removeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('recurring_event_invites')
    .delete()
    .eq('id', inviteId);
  if (error) throw new Error(error.message);
}

export async function toggleActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('recurring_events')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteRecurringEvent(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_events').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function spawnEventInstance(
  recurringEventId: string,
  targetDate: string,
): Promise<string> {
  const { data: row, error } = await supabase
    .from('recurring_events')
    .select('*')
    .eq('id', recurringEventId)
    .single();
  if (error) throw new Error(error.message);

  const eventId = await createEvent(
    {
      sport: row.sport,
      fieldId: row.field_id ?? undefined,
      fieldName: row.field_name,
      lat: row.lat != null ? Number(row.lat) : undefined,
      lng: row.lng != null ? Number(row.lng) : undefined,
      title: row.title ?? undefined,
      description: row.description ?? undefined,
      date: targetDate,
      time: row.event_time,
      endTime: row.end_time ?? undefined,
      maxPlayers: row.max_players,
      visibility: row.visibility,
    },
    row.organizer_id,
    row.organizer_name,
  );

  return eventId;
}

export async function sendInvites(
  recurringEventId: string,
  eventId: string,
  eventDate: string,
  eventUrl: string,
): Promise<{ emailsSent: number; smsSent: number; errors: string[] }> {
  const { data, error } = await supabase.functions.invoke('send-invites', {
    body: { recurringEventId, eventId, eventDate, eventUrl },
  });
  if (error) throw new Error(error.message);
  return data as { emailsSent: number; smsSent: number; errors: string[] };
}
