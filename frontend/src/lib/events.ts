import { supabase } from './supabase';
import type { EventCreate, EventItem, EventParticipant, Visibility } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEvent(row: any): EventItem {
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
    date: row.event_date,
    time: row.event_time,
    endTime: row.end_time ?? undefined,
    maxPlayers: row.max_players,
    visibility: row.visibility,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toParticipant(row: any): EventParticipant {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id ?? undefined,
    name: row.name,
    isGuest: row.is_guest,
    createdAt: row.created_at,
  };
}

export async function createEvent(
  data: EventCreate,
  organizerId: string,
  organizerName: string,
): Promise<string> {
  const { data: row, error } = await supabase
    .from('events')
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
      event_date: data.date,
      event_time: data.time,
      end_time: data.endTime ?? null,
      max_players: data.maxPlayers,
      visibility: data.visibility,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  // Organiser automatically joins their own event.
  await supabase.from('event_participants').insert({
    event_id: row.id,
    user_id: organizerId,
    name: organizerName,
    is_guest: false,
  });

  return row.id as string;
}

export async function getEvent(
  id: string,
): Promise<{ event: EventItem; participants: EventParticipant[] }> {
  const { data: eventRow, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);

  const { data: partRows, error: pErr } = await supabase
    .from('event_participants')
    .select('*')
    .eq('event_id', id)
    .order('created_at', { ascending: true });
  if (pErr) throw new Error(pErr.message);

  return {
    event: toEvent(eventRow),
    participants: (partRows ?? []).map(toParticipant),
  };
}

export async function getMyEvents(userId: string): Promise<EventItem[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('organizer_id', userId)
    .order('event_date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toEvent);
}

export async function getPublicEvents(): Promise<EventItem[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('visibility', 'public')
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toEvent);
}

export async function joinEvent(eventId: string, userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('event_participants').insert({
    event_id: eventId,
    user_id: userId,
    name,
    is_guest: false,
  });
  if (error) throw new Error(error.message);
}

export async function addGuest(eventId: string, name: string): Promise<void> {
  const { error } = await supabase.from('event_participants').insert({
    event_id: eventId,
    user_id: null,
    name,
    is_guest: true,
  });
  if (error) throw new Error(error.message);
}

export async function removeParticipant(participantId: string): Promise<void> {
  const { error } = await supabase.from('event_participants').delete().eq('id', participantId);
  if (error) throw new Error(error.message);
}

export async function setVisibility(eventId: string, visibility: Visibility): Promise<void> {
  const { error } = await supabase.from('events').update({ visibility }).eq('id', eventId);
  if (error) throw new Error(error.message);
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw new Error(error.message);
}
