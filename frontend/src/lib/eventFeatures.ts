import { supabase } from './supabase';
import type {
  EventAdvancedSettings,
  MatchResult,
  PlayerGoal,
  PlayerReport,
  PlayerStats,
  ParticipantStatus,
  ReportType,
  TeamMode,
} from '@/types';

// ---------------------------------------------------------------------------
// Advanced settings
// ---------------------------------------------------------------------------

export async function saveEventAdvancedSettings(
  eventId: string,
  s: Partial<EventAdvancedSettings>,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (s.requireSmsConfirmation !== undefined) patch.require_sms_confirmation = s.requireSmsConfirmation;
  if (s.trackAttendance !== undefined) patch.track_attendance = s.trackAttendance;
  if (s.teamMode !== undefined) patch.team_mode = s.teamMode;
  if (s.trackPayments !== undefined) patch.track_payments = s.trackPayments;
  if (s.showPaymentStatus !== undefined) patch.show_payment_status = s.showPaymentStatus;
  if (s.trackResults !== undefined) patch.track_results = s.trackResults;
  if (s.confirmationDeadlineH !== undefined) patch.confirmation_deadline_h = s.confirmationDeadlineH;
  if (s.costGrosze !== undefined) patch.cost_grosz = s.costGrosze;

  const { error } = await supabase.from('events').update(patch).eq('id', eventId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Participant management
// ---------------------------------------------------------------------------

export async function publishTeams(eventId: string): Promise<void> {
  const { data, error } = await supabase
    .from('events')
    .update({ teams_published: true })
    .eq('id', eventId)
    .select('id');
  if (error) throw new Error(`${error.code}: ${error.message}`);
  if (!data || data.length === 0) throw new Error('Brak uprawnień — sprawdź czy jesteś organizatorem meczu');
}

export async function unpublishTeams(eventId: string): Promise<void> {
  const { data, error } = await supabase
    .from('events')
    .update({ teams_published: false })
    .eq('id', eventId)
    .select('id');
  if (error) throw new Error(`${error.code}: ${error.message}`);
  if (!data || data.length === 0) throw new Error('Brak uprawnień — sprawdź czy jesteś organizatorem meczu');
}

export async function updateParticipantStatus(
  participantId: string,
  status: ParticipantStatus,
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === 'potwierdzony') patch.confirmed_at = new Date().toISOString();
  const { error } = await supabase.from('event_participants').update(patch).eq('id', participantId);
  if (error) throw new Error(error.message);
}

export async function updateParticipantTeam(
  participantId: string,
  team: 'A' | 'B' | null,
): Promise<void> {
  const { error } = await supabase
    .from('event_participants')
    .update({ team })
    .eq('id', participantId);
  if (error) throw new Error(error.message);
}

export async function updateParticipantPayment(
  participantId: string,
  hasPaid: boolean,
  paidAmount?: number,
): Promise<void> {
  const { error } = await supabase
    .from('event_participants')
    .update({ has_paid: hasPaid, paid_amount: paidAmount ?? 0 })
    .eq('id', participantId);
  if (error) throw new Error(error.message);
}

export async function updateParticipantPhone(
  participantId: string,
  phone: string,
): Promise<void> {
  const { error } = await supabase
    .from('event_participants')
    .update({ phone })
    .eq('id', participantId);
  if (error) throw new Error(error.message);
}

export async function setCaptain(
  participantId: string,
  isCaptain: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('event_participants')
    .update({ is_captain: isCaptain })
    .eq('id', participantId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// SMS confirmation
// ---------------------------------------------------------------------------

export async function sendConfirmationSms(
  eventId: string,
  participantId: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke('send-event-sms', {
    body: { type: 'confirmation', eventId, participantId },
  });
  if (error) throw new Error(error.message);
}

export async function sendRemovalSms(
  eventId: string,
  participantId: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke('send-event-sms', {
    body: { type: 'removal', eventId, participantId },
  });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Team composition
// ---------------------------------------------------------------------------

export async function assignTeamsRandomly(
  eventId: string,
  participantIds: string[],
): Promise<{ A: string[]; B: string[] }> {
  const shuffled = [...participantIds].sort(() => Math.random() - 0.5);
  const half = Math.ceil(shuffled.length / 2);
  const teamA = shuffled.slice(0, half);
  const teamB = shuffled.slice(half);

  const updates = [
    ...teamA.map((id) => supabase.from('event_participants').update({ team: 'A' }).eq('id', id)),
    ...teamB.map((id) => supabase.from('event_participants').update({ team: 'B' }).eq('id', id)),
  ];

  const results = await Promise.all(updates);
  const err = results.find((r) => r.error);
  if (err?.error) throw new Error(err.error.message);

  return { A: teamA, B: teamB };
}

export async function clearTeams(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('event_participants')
    .update({ team: null, is_captain: false })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Match results
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMatchResult(row: any): MatchResult {
  return {
    id: row.id,
    eventId: row.event_id,
    scoreA: row.score_a,
    scoreB: row.score_b,
    winner: row.winner ?? undefined,
    resultData: row.result_data ?? undefined,
    recordedBy: row.recorded_by ?? undefined,
    recordedAt: row.recorded_at,
  };
}

export async function getMatchResult(eventId: string): Promise<MatchResult | null> {
  const { data, error } = await supabase
    .from('match_results')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toMatchResult(data) : null;
}

export async function saveMatchResult(
  eventId: string,
  scoreA: number,
  scoreB: number,
  recordedBy: string,
  resultData?: import('@/types').MatchResultData,
  winner?: 'A' | 'B' | 'remis',
): Promise<void> {
  const { error } = await supabase.from('match_results').upsert(
    {
      event_id: eventId,
      score_a: scoreA,
      score_b: scoreB,
      winner: winner ?? null,
      result_data: resultData ?? null,
      recorded_by: recordedBy,
      recorded_at: new Date().toISOString(),
    },
    { onConflict: 'event_id' },
  );
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Player goals
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPlayerGoal(row: any): PlayerGoal {
  return {
    id: row.id,
    eventId: row.event_id,
    participantId: row.participant_id,
    participantName: row.event_participants?.name ?? '',
    goals: row.goals,
  };
}

export async function getPlayerGoals(eventId: string): Promise<PlayerGoal[]> {
  const { data, error } = await supabase
    .from('player_goals')
    .select('*, event_participants(name)')
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPlayerGoal);
}

export async function setPlayerGoals(
  eventId: string,
  participantId: string,
  goals: number,
): Promise<void> {
  if (goals <= 0) {
    await supabase
      .from('player_goals')
      .delete()
      .eq('event_id', eventId)
      .eq('participant_id', participantId);
    return;
  }
  const { error } = await supabase.from('player_goals').upsert(
    { event_id: eventId, participant_id: participantId, goals },
    { onConflict: 'event_id,participant_id' },
  );
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Player stats
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPlayerStats(row: any): PlayerStats {
  return {
    id: row.id,
    userId: row.user_id,
    recurringEventId: row.recurring_event_id ?? undefined,
    invitedCount: row.invited_count,
    confirmedCount: row.confirmed_count,
    noShowCount: row.no_show_count,
    goalsTotal: row.goals_total,
    matchesPlayed: row.matches_played,
    updatedAt: row.updated_at,
  };
}

export async function getGroupPlayerStats(
  recurringEventId: string,
): Promise<PlayerStats[]> {
  const { data, error } = await supabase
    .from('player_stats')
    .select('*')
    .eq('recurring_event_id', recurringEventId)
    .order('confirmed_count', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPlayerStats);
}

export function reliabilityPct(stats: PlayerStats): number {
  if (stats.invitedCount === 0) return 100;
  return Math.round(((stats.confirmedCount - stats.noShowCount) / stats.invitedCount) * 100);
}

// ---------------------------------------------------------------------------
// Player reports
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPlayerReport(row: any): PlayerReport {
  return {
    id: row.id,
    eventId: row.event_id,
    reportedParticipantId: row.reported_participant_id,
    reportedName: row.event_participants?.name ?? undefined,
    reporterId: row.reporter_id ?? undefined,
    reportType: row.report_type,
    comment: row.comment ?? undefined,
    createdAt: row.created_at,
  };
}

export async function getEventReports(eventId: string): Promise<PlayerReport[]> {
  const { data, error } = await supabase
    .from('player_reports')
    .select('*, event_participants(name)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPlayerReport);
}

export async function submitReport(
  eventId: string,
  reportedParticipantId: string,
  reportType: ReportType,
  reporterId?: string,
  comment?: string,
): Promise<void> {
  const { error } = await supabase.from('player_reports').insert({
    event_id: eventId,
    reported_participant_id: reportedParticipantId,
    reporter_id: reporterId ?? null,
    report_type: reportType,
    comment: comment ?? null,
  });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Team mode helpers
// ---------------------------------------------------------------------------

export const TEAM_MODE_LABELS: Record<TeamMode, string> = {
  brak: 'Brak',
  reczne: 'Ręczne',
  kapitanowie: 'Kapitanowie (draft)',
  losowe: 'Losowe',
};
