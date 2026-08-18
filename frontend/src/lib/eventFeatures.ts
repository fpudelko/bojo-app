import { supabase } from './supabase';
import { zaktualizujJedenWiersz } from './zapytania';
import { withCount } from './plural';
import type {
  EventAdvancedSettings,
  MatchResult,
  PlayerGoal,
  PlayerStats,
  TeamMode,
} from '@/types';

// ---------------------------------------------------------------------------
// Widoczność meczu przypiętego do grupy
// ---------------------------------------------------------------------------

/**
 * Zdanie pod kartą widoczności, gdy mecz jest przypięty do grupy.
 *
 * `events.visibility` ma dwie wartości (`private`/`public`) i to się w tym PR-ze
 * nie zmienia — ale prywatny mecz przypięty do grupy JEST widoczny dla całej
 * ekipy (`getMyGroupEvents()`, `lib/events.ts`), tylko dotąd nikt tego nie mówił
 * wprost. Bez tego zdania „Prywatne" wygląda jak obietnica bez pokrycia: każdy
 * członek grupy i tak zobaczy ten mecz na liście `/grupy/[id]`.
 */
export function opisWidocznosciWGrupie(
  visibility: 'public' | 'private',
  grupaNazwa: string | undefined,
  liczbaCzlonkow: number | undefined,
): string | null {
  if (!grupaNazwa) return null;
  const czlonkowie = liczbaCzlonkow != null
    ? withCount(liczbaCzlonkow, 'członek', 'członkowie', 'członków')
    : 'członkowie';
  if (visibility === 'private') {
    return `Prywatny — na liście ekipy „${grupaNazwa}". Zobaczą go ${czlonkowie} ekipy i każdy, kto dostanie link.`;
  }
  return `Publiczny — widoczny dla wszystkich, a dodatkowo na liście ekipy „${grupaNazwa}".`;
}

// ---------------------------------------------------------------------------
// Advanced settings
// ---------------------------------------------------------------------------

export async function saveEventAdvancedSettings(
  eventId: string,
  s: Partial<EventAdvancedSettings>,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (s.requireSmsConfirmation !== undefined) patch.require_sms_confirmation = s.requireSmsConfirmation;
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
  const { error } = await supabase.rpc('set_event_teams_published', {
    p_event_id: eventId,
    p_published: true,
  });
  if (error) throw new Error(error.message);
}

export async function unpublishTeams(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('set_event_teams_published', {
    p_event_id: eventId,
    p_published: false,
  });
  if (error) throw new Error(error.message);
}


export async function updateParticipantTeam(
  participantId: string,
  team: 'A' | 'B' | null,
): Promise<void> {
  // `zaktualizujJedenWiersz`, nie gołe `.update()`: przy niepasującej polityce
  // RLS Postgres zmienia ZERO wierszy i zwraca sukces. Objaw zgłoszony przez
  // użytkownika: „przesuwam gracza w lewo i w prawo, klikam N i C — nic się
  // nie dzieje". Żadnego błędu, bo formalnie nic się nie zepsuło.
  await zaktualizujJedenWiersz(
    'event_participants',
    participantId,
    { team },
    'Nie udało się przypisać gracza do drużyny',
  );
}

export async function updateParticipantPayment(
  participantId: string,
  hasPaid: boolean,
  paidAmount?: number,
): Promise<void> {
  // Ta sama pułapka co wyżej — „oznaczyłem, że zapłacił, a po odświeżeniu
  // znowu nieopłacony" byłoby nie do zdiagnozowania bez tego.
  await zaktualizujJedenWiersz(
    'event_participants',
    participantId,
    { has_paid: hasPaid, paid_amount: paidAmount ?? 0 },
    'Nie udało się zapisać płatności',
  );
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

/**
 * Kapitan drużyny — JEDEN na drużynę.
 *
 * Nadanie gwiazdki komuś nowemu zdejmuje ją poprzedniemu z tej samej drużyny.
 * Wcześniej był to zwykły przełącznik per osoba, więc dało się mieć pięciu
 * kapitanów w jednym składzie — a od migracji `105` kapitan ustawia taktykę,
 * czyli „pięciu kapitanów" znaczy „pięć osób nadpisujących sobie nawzajem
 * ustawienie". Odebranie gwiazdki (`isCaptain = false`) nie rusza nikogo poza
 * wskazaną osobą.
 *
 * `eventId`/`team` są opcjonalne wyłącznie dla zgodności ze starymi
 * wywołaniami; bez nich zdjęcie poprzedniego kapitana się nie wykona.
 */
export async function setCaptain(
  participantId: string,
  isCaptain: boolean,
  kontekst?: { eventId: string; team?: string | null },
): Promise<void> {
  if (isCaptain && kontekst?.eventId && kontekst.team) {
    const { error: bladZdjecia } = await supabase
      .from('event_participants')
      .update({ is_captain: false })
      .eq('event_id', kontekst.eventId)
      .eq('team', kontekst.team)
      .neq('id', participantId)
      .eq('is_captain', true);
    if (bladZdjecia) throw new Error(bladZdjecia.message);
  }

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
// Team mode helpers
// ---------------------------------------------------------------------------

export const TEAM_MODE_LABELS: Record<TeamMode, string> = {
  brak: 'Brak',
  reczne: 'Ręczne',
  kapitanowie: 'Kapitanowie (draft)',
  losowe: 'Losowe',
};
