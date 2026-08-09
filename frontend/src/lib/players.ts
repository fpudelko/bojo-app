import { supabase } from './supabase';
import type { PlayerAggregateStats, PlayerHistoryItem } from '@/types';

export interface PublicPlayer {
  id: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

/** Public profile header — avatar + display name (from latest participation). */
export async function getPublicPlayer(userId: string): Promise<PublicPlayer | null> {
  const { data: profileRow, error } = await supabase
    .from('profiles')
    .select('id, avatar_url, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error || !profileRow) return null;

  const { data: nameRow } = await supabase
    .from('event_participants')
    .select('name')
    .eq('user_id', userId)
    .eq('is_guest', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    id: profileRow.id,
    displayName: nameRow?.name ?? 'Gracz',
    avatarUrl: profileRow.avatar_url ?? undefined,
    createdAt: profileRow.created_at,
  };
}

/** Aggregated stats across every event the player has touched (via RPC). */
export async function getPlayerStats(userId: string): Promise<PlayerAggregateStats> {
  const { data, error } = await supabase.rpc('get_player_stats', { p_user_id: userId });
  if (error) throw new Error(error.message);
  // RPC returns a single row (TABLE function → array)
  const row = Array.isArray(data) ? data[0] : data;
  return {
    eventsJoined: row?.events_joined ?? 0,
    eventsOrganized: row?.events_organized ?? 0,
    matchesPlayed: row?.matches_played ?? 0,
    goalsTotal: row?.goals_total ?? 0,
    noShows: row?.no_shows ?? 0,
  };
}

/**
 * Recent game history — events the player participated in, newest first.
 * Includes goals scored per event and whether a result was recorded.
 */
export async function getPlayerHistory(
  userId: string,
  limit = 20,
): Promise<PlayerHistoryItem[]> {
  // 1. Participations (carry participant id → goals, reserve flag).
  // Observing ("maybe") is not participation — it never belongs in match history.
  const { data: partRows, error: pErr } = await supabase
    .from('event_participants')
    .select('id, event_id, is_reserve')
    .eq('user_id', userId)
    .eq('is_guest', false)
    .neq('rsvp', 'maybe');
  if (pErr) throw new Error(pErr.message);
  if (!partRows || partRows.length === 0) return [];

  const eventIds = partRows.map((r) => r.event_id as string);
  const participantIds = partRows.map((r) => r.id as string);
  const reserveByEvent: Record<string, boolean> = {};
  for (const r of partRows) reserveByEvent[r.event_id] = r.is_reserve ?? false;

  // 2. Events
  const { data: eventRows, error: eErr } = await supabase
    .from('events')
    .select('id, sport, title, field_name, event_date, organizer_id')
    .in('id', eventIds)
    .order('event_date', { ascending: false })
    .limit(limit);
  if (eErr) throw new Error(eErr.message);
  if (!eventRows) return [];

  const shownEventIds = eventRows.map((e) => e.id as string);

  // 3. Goals for this player's participant rows
  const { data: goalRows } = await supabase
    .from('player_goals')
    .select('event_id, goals, participant_id')
    .in('participant_id', participantIds);
  const goalsByEvent: Record<string, number> = {};
  for (const g of goalRows ?? []) goalsByEvent[g.event_id] = (goalsByEvent[g.event_id] ?? 0) + (g.goals ?? 0);

  // 4. Which events have a recorded result
  const { data: resultRows } = await supabase
    .from('match_results')
    .select('event_id')
    .in('event_id', shownEventIds);
  const hasResult = new Set((resultRows ?? []).map((r) => r.event_id as string));

  return eventRows.map((e) => ({
    eventId: e.id,
    sport: e.sport,
    title: e.title ?? undefined,
    fieldName: e.field_name,
    date: e.event_date,
    isOrganizer: e.organizer_id === userId,
    isReserve: reserveByEvent[e.id] ?? false,
    goals: goalsByEvent[e.id] ?? 0,
    hasResult: hasResult.has(e.id),
  }));
}
