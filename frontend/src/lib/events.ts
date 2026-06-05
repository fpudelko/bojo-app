import { supabase } from './supabase';
import { validateName, sanitizeDescription, sanitizeAddress } from './validation';
import type { EventCreate, EventItem, EventParticipant, Visibility, EventStatus } from '@/types';

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

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
    requireSmsConfirmation: row.require_sms_confirmation ?? false,
    trackAttendance: row.track_attendance ?? false,
    teamMode: row.team_mode ?? 'brak',
    trackPayments: row.track_payments ?? false,
    showPaymentStatus: row.show_payment_status ?? false,
    trackResults: row.track_results ?? false,
    confirmationDeadlineH: row.confirmation_deadline_h ?? 24,
    costGrosze: row.cost_grosz ?? 0,
    status: (row.status ?? 'active') as EventStatus,
    customLocationName: row.custom_location_name ?? undefined,
    customAddress: row.custom_address ?? undefined,
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
    hasPaid: row.has_paid ?? false,
    isReserve: row.is_reserve ?? false,
    createdAt: row.created_at,
    avatarUrl: row.avatarUrl ?? undefined,
    status: row.status ?? 'zaproszony',
    confirmedAt: row.confirmed_at ?? undefined,
    team: row.team ?? undefined,
    paidAmount: row.paid_amount ?? 0,
    phone: row.phone ?? undefined,
    isCaptain: row.is_captain ?? false,
    addedBy: row.added_by ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Events — CRUD
// ---------------------------------------------------------------------------

export async function createEvent(
  data: EventCreate,
  organizerId: string,
  organizerName: string,
  organizerParticipates = true,
): Promise<string> {
  // Rate limit: max 10 events per hour per user
  const { data: allowed } = await supabase.rpc('check_rate_limit', {
    p_action: 'create_event',
    p_max_per_hour: 10,
  });
  if (allowed === false) throw new Error('Tworzysz zbyt wiele wydarzeń. Spróbuj za chwilę.');

  // Validate & sanitize inputs
  const safeOrganizerName = validateName(organizerName, 'Nazwa organizatora', 80);
  const safeFieldName = validateName(data.fieldName, 'Nazwa miejsca', 100);
  const safeTitle = data.title ? sanitizeDescription(data.title).slice(0, 80) : undefined;
  const safeDesc = data.description ? sanitizeDescription(data.description) : undefined;
  const safeCustomName = data.customLocationName ? sanitizeAddress(data.customLocationName) : undefined;
  const safeCustomAddress = data.customAddress ? sanitizeAddress(data.customAddress) : undefined;

  const { data: row, error } = await supabase
    .from('events')
    .insert({
      organizer_id: organizerId,
      organizer_name: safeOrganizerName,
      sport: data.sport,
      field_id: data.fieldId ?? null,
      field_name: safeFieldName,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      title: safeTitle ?? null,
      description: safeDesc ?? null,
      event_date: data.date,
      event_time: data.time,
      end_time: data.endTime ?? null,
      max_players: data.maxPlayers,
      visibility: data.visibility,
      require_sms_confirmation: data.requireSmsConfirmation ?? false,
      track_attendance: data.trackAttendance ?? false,
      team_mode: data.teamMode ?? 'brak',
      track_payments: data.trackPayments ?? false,
      show_payment_status: data.showPaymentStatus ?? false,
      track_results: data.trackResults ?? false,
      confirmation_deadline_h: data.confirmationDeadlineH ?? 24,
      cost_grosz: data.costGrosze ?? 0,
      custom_location_name: safeCustomName ?? null,
      custom_address: safeCustomAddress ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  if (organizerParticipates) {
    await supabase.from('event_participants').insert({
      event_id: row.id,
      user_id: organizerId,
      name: safeOrganizerName,
      is_guest: false,
      is_reserve: false,
    });
  }

  const id = row.id as string;

  // Fire-and-forget: notify users with matching game alerts
  if (data.visibility === 'public') {
    supabase.functions.invoke('notify-game-alert', { body: { eventId: id } }).catch(() => {});
  }

  return id;
}

export async function updateEvent(id: string, data: EventCreate): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({
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
      require_sms_confirmation: data.requireSmsConfirmation ?? false,
      track_attendance: data.trackAttendance ?? false,
      team_mode: data.teamMode ?? 'brak',
      track_payments: data.trackPayments ?? false,
      show_payment_status: data.showPaymentStatus ?? false,
      track_results: data.trackResults ?? false,
      confirmation_deadline_h: data.confirmationDeadlineH ?? 24,
      cost_grosz: data.costGrosze ?? 0,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
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
    .order('is_reserve', { ascending: true })
    .order('created_at', { ascending: true });
  if (pErr) throw new Error(pErr.message);

  // Batch-fetch avatar URLs for logged-in participants
  const userIds = (partRows ?? []).filter((p) => p.user_id).map((p) => p.user_id as string);
  let avatarMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .in('id', userIds);
    avatarMap = Object.fromEntries(
      (profileRows ?? [])
        .filter((p) => p.avatar_url)
        .map((p) => [p.id, p.avatar_url as string]),
    );
  }

  return {
    event: toEvent(eventRow),
    participants: (partRows ?? []).map((row) => ({
      ...toParticipant(row),
      avatarUrl: row.user_id ? avatarMap[row.user_id] : undefined,
    })),
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

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export async function joinEvent(eventId: string, userId: string, name: string): Promise<void> {
  // Rate limit: max 20 joins per hour
  const { data: allowed } = await supabase.rpc('check_rate_limit', {
    p_action: 'join_event',
    p_max_per_hour: 20,
  });
  if (allowed === false) throw new Error('Zbyt wiele prób dołączenia. Spróbuj za chwilę.');

  const safeName = validateName(name, 'Imię', 80);

  // Check if event is full (non-reserve count vs max_players)
  const [{ data: ev }, { count }] = await Promise.all([
    supabase.from('events').select('max_players').eq('id', eventId).single(),
    supabase
      .from('event_participants')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('is_reserve', false),
  ]);

  const isReserve = (count ?? 0) >= (ev?.max_players ?? 999);

  const { error } = await supabase.from('event_participants').insert({
    event_id: eventId,
    user_id: userId,
    name: safeName,
    is_guest: false,
    is_reserve: isReserve,
  });
  if (error) throw new Error(error.message);
}

export async function addGuest(
  eventId: string,
  name: string,
  isReserve = false,
  addedByUserId?: string,
): Promise<void> {
  const safeName = validateName(name, 'Imię gościa', 80);
  const { error } = await supabase.from('event_participants').insert({
    event_id: eventId,
    user_id: null,
    name: safeName,
    is_guest: true,
    is_reserve: isReserve,
    added_by: addedByUserId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function removeParticipant(participantId: string): Promise<void> {
  // Fetch before delete to know if we should promote a reserve
  const { data: p } = await supabase
    .from('event_participants')
    .select('event_id, is_reserve')
    .eq('id', participantId)
    .single();

  const { error } = await supabase.from('event_participants').delete().eq('id', participantId);
  if (error) throw new Error(error.message);

  // Promote first reserve when a non-reserve slot opens up
  if (p && !p.is_reserve) {
    const { data: first } = await supabase
      .from('event_participants')
      .select('id')
      .eq('event_id', p.event_id)
      .eq('is_reserve', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (first) {
      await supabase.from('event_participants').update({ is_reserve: false }).eq('id', first.id);
    }
  }
}

export async function togglePayment(participantId: string, hasPaid: boolean): Promise<void> {
  const { error } = await supabase
    .from('event_participants')
    .update({ has_paid: hasPaid })
    .eq('id', participantId);
  if (error) throw new Error(error.message);
}

export async function setVisibility(eventId: string, visibility: Visibility): Promise<void> {
  const { error } = await supabase.from('events').update({ visibility }).eq('id', eventId);
  if (error) throw new Error(error.message);
  if (visibility === 'public') {
    supabase.functions.invoke('notify-game-alert', { body: { eventId } }).catch(() => {});
  }
}

export async function getNearbyEvents(lat: number, lng: number, radiusKm = 5, limit = 6): Promise<EventItem[]> {
  const { data, error } = await supabase.rpc('get_nearby_events', {
    p_lat: lat, p_lng: lng, p_radius_km: radiusKm, p_limit: limit,
  });
  if (error) return [];
  return (data ?? []).map(toEvent);
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw new Error(error.message);
}

export async function cancelEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').update({ status: 'cancelled' }).eq('id', eventId);
  if (error) throw new Error(error.message);
}

export async function restoreEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').update({ status: 'active' }).eq('id', eventId);
  if (error) throw new Error(error.message);
}

export async function getMyParticipatedEvents(
  userId: string,
): Promise<{ event: EventItem; isOrganizer: boolean }[]> {
  const { data: partRows, error: pErr } = await supabase
    .from('event_participants')
    .select('event_id')
    .eq('user_id', userId);
  if (pErr) throw new Error(pErr.message);

  const eventIds = (partRows ?? []).map((r) => r.event_id as string);
  if (eventIds.length === 0) return [];

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .in('id', eventIds)
    .order('event_date', { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    event: toEvent(row),
    isOrganizer: row.organizer_id === userId,
  }));
}
