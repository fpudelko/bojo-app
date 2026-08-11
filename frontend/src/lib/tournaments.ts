import { supabase } from './supabase';
import type {
  Tournament, TournamentTeam, TournamentTeamMember, TournamentGroup, TournamentMatch, TournamentStanding, TournamentVenue, TournamentVenueSlot, PlayerPosition,
} from '@/types';

// ---------------------------------------------------------------------------
// Row → camelCase mappers
// ---------------------------------------------------------------------------

function toTournament(r: any): Tournament {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    sport: r.sport,
    city: r.city,
    status: r.status,
    format: r.format,
    maxTeams: r.max_teams,
    groupSize: r.group_size,
    advancePerGroup: r.advance_per_group,
    minSquad: r.min_squad,
    maxSquad: r.max_squad,
    registrationDeadline: r.registration_deadline ?? undefined,
    startDate: r.start_date ?? undefined,
    finalsDate: r.finals_date ?? undefined,
    finalsVenue: r.finals_venue ?? undefined,
    tagline: r.tagline ?? undefined,
    prizePool: r.prize_pool ?? undefined,
    rules: r.rules ?? undefined,
    entryFeeGrosze: r.entry_fee_grosze ?? 0,
    createdAt: r.created_at,
  };
}

function toMember(r: any): TournamentTeamMember {
  return {
    id: r.id,
    teamId: r.team_id,
    userId: r.user_id ?? undefined,
    name: r.name,
    position: r.position,
    shirtNumber: r.shirt_number ?? undefined,
    isCaptain: r.is_captain,
    isReserve: r.is_reserve,
    createdAt: r.created_at,
  };
}

function toTeam(r: any): TournamentTeam {
  return {
    id: r.id,
    tournamentId: r.tournament_id,
    name: r.name,
    district: r.district ?? undefined,
    captainId: r.captain_id,
    captainName: r.captain_name,
    captainPhone: r.captain_phone ?? undefined,
    captainEmail: r.captain_email ?? undefined,
    status: r.status,
    paidAt: r.paid_at ?? undefined,
    groupId: r.group_id ?? undefined,
    seed: r.seed ?? undefined,
    availabilityDays: r.availability_days ?? [],
    availabilityFrom: r.availability_from ?? undefined,
    availabilityTo: r.availability_to ?? undefined,
    finalsConfirmed: r.finals_confirmed ?? false,
    createdAt: r.created_at,
    members: Array.isArray(r.tournament_team_members)
      ? r.tournament_team_members.map(toMember)
      : undefined,
  };
}

function toGroup(r: any): TournamentGroup {
  return { id: r.id, tournamentId: r.tournament_id, name: r.name, createdAt: r.created_at };
}

function toMatch(r: any): TournamentMatch {
  return {
    id: r.id,
    tournamentId: r.tournament_id,
    stage: r.stage,
    groupId: r.group_id ?? undefined,
    round: r.round ?? undefined,
    bracketPosition: r.bracket_position ?? undefined,
    teamAId: r.team_a_id ?? undefined,
    teamBId: r.team_b_id ?? undefined,
    feedsAMatchId: r.feeds_a_match_id ?? undefined,
    feedsBMatchId: r.feeds_b_match_id ?? undefined,
    proposedByTeamId: r.proposed_by_team_id ?? undefined,
    proposedSlot: r.proposed_slot ?? undefined,
    venueSlotId: r.venue_slot_id ?? undefined,
    venueText: r.venue_text ?? undefined,
    scheduledAt: r.scheduled_at ?? undefined,
    status: r.status,
    scoreA: r.score_a ?? undefined,
    scoreB: r.score_b ?? undefined,
    winnerTeamId: r.winner_team_id ?? undefined,
    reportedByTeamId: r.reported_by_team_id ?? undefined,
    confirmedByTeamId: r.confirmed_by_team_id ?? undefined,
    disputeNote: r.dispute_note ?? undefined,
    proofUrl: r.proof_url ?? undefined,
    deadline: r.deadline ?? undefined,
    playedAt: r.played_at ?? undefined,
    createdAt: r.created_at,
  };
}

function toStanding(r: any): TournamentStanding {
  return {
    teamId: r.team_id,
    tournamentId: r.tournament_id,
    groupId: r.group_id,
    teamName: r.team_name,
    played: r.played,
    won: r.won,
    drawn: r.drawn,
    lost: r.lost,
    goalsFor: r.goals_for,
    goalsAgainst: r.goals_against,
    goalDiff: r.goal_diff,
    points: r.points,
  };
}

function toVenueSlot(r: any): TournamentVenueSlot {
  return {
    id: r.id,
    venueId: r.venue_id,
    startsAt: r.starts_at,
    durationMin: r.duration_min,
    status: r.status,
    matchId: r.match_id ?? undefined,
    createdAt: r.created_at,
  };
}

function toVenue(r: any): TournamentVenue {
  return {
    id: r.id,
    tournamentId: r.tournament_id,
    fieldId: r.field_id ?? undefined,
    name: r.name,
    address: r.address ?? undefined,
    district: r.district ?? undefined,
    isPartner: r.is_partner,
    createdAt: r.created_at,
    slots: Array.isArray(r.tournament_venue_slots)
      ? r.tournament_venue_slots.map(toVenueSlot)
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Tournament
// ---------------------------------------------------------------------------

/** The active/featured tournament (newest non-draft, else newest). */
export async function getActiveTournament(): Promise<Tournament | null> {
  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toTournament(data) : null;
}

export async function getTournamentBySlug(slug: string): Promise<Tournament | null> {
  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return data ? toTournament(data) : null;
}

/** Number of registered (non-withdrawn) teams — drives the "X/Y miejsc" counter. */
export async function getTeamCount(tournamentId: string): Promise<number> {
  const { data } = await supabase.rpc('tournament_team_count', { p_tournament: tournamentId });
  return (data as number) ?? 0;
}

// ---------------------------------------------------------------------------
// Teams + squad
// ---------------------------------------------------------------------------

// Public-safe columns: captain_phone / captain_email are RODO-restricted at the
// DB level (migration 030), so we must NOT select '*' — list columns explicitly.
const TEAM_COLS =
  'id,tournament_id,name,district,captain_id,captain_name,status,paid_at,' +
  'group_id,seed,availability_days,availability_from,availability_to,' +
  'finals_confirmed,created_at';

export async function getTeams(tournamentId: string): Promise<TournamentTeam[]> {
  const { data } = await supabase
    .from('tournament_teams')
    .select(`${TEAM_COLS}, tournament_team_members(*)`)
    .eq('tournament_id', tournamentId)
    .neq('status', 'withdrawn')
    .order('created_at', { ascending: true });
  return (data ?? []).map(toTeam);
}

export async function getTeam(teamId: string): Promise<TournamentTeam | null> {
  const { data } = await supabase
    .from('tournament_teams')
    .select(`${TEAM_COLS}, tournament_team_members(*)`)
    .eq('id', teamId)
    .maybeSingle();
  return data ? toTeam(data) : null;
}

/** The team captained by the current user in a given tournament, if any. */
export async function getMyTeam(tournamentId: string, userId: string): Promise<TournamentTeam | null> {
  const { data } = await supabase
    .from('tournament_teams')
    .select(`${TEAM_COLS}, tournament_team_members(*)`)
    .eq('tournament_id', tournamentId)
    .eq('captain_id', userId)
    .maybeSingle();
  return data ? toTeam(data) : null;
}

export interface SquadMemberInput {
  name: string;
  position: PlayerPosition;
  shirtNumber?: number;
  isCaptain?: boolean;
  isReserve?: boolean;
}

export interface TeamRegistration {
  name: string;
  district?: string;
  captainName: string;
  captainPhone?: string;
  captainEmail?: string;
  availabilityDays: number[];
  availabilityFrom?: string;
  availabilityTo?: string;
  finalsConfirmed: boolean;
  squad: SquadMemberInput[];
}

/** Register a team. The captain is auto-added as the first member. Returns the team id. */
export async function registerTeam(
  tournamentId: string,
  captainId: string,
  reg: TeamRegistration,
): Promise<string> {
  const { data: team, error } = await supabase
    .from('tournament_teams')
    .insert({
      tournament_id: tournamentId,
      name: reg.name.trim(),
      district: reg.district ?? null,
      captain_id: captainId,
      captain_name: reg.captainName.trim(),
      captain_phone: reg.captainPhone ?? null,
      captain_email: reg.captainEmail ?? null,
      availability_days: reg.availabilityDays,
      availability_from: reg.availabilityFrom || null,
      availability_to: reg.availabilityTo || null,
      finals_confirmed: reg.finalsConfirmed,
    })
    .select('id')
    .single();
  if (error) throw error;

  const teamId = team.id as string;

  // Captain is always the first member — no manual entry needed.
  await supabase.from('tournament_team_members').insert({
    team_id: teamId,
    user_id: captainId,
    name: reg.captainName.trim(),
    position: 'pomocnik',
    is_captain: true,
    is_reserve: false,
  });

  return teamId;
}

/** Join an existing team as a player (called from the invite link page). */
export async function joinTeam(
  teamId: string,
  userId: string,
  name: string,
  position: PlayerPosition,
  shirtNumber?: number,
): Promise<void> {
  // Prevent duplicate membership.
  const { data: existing } = await supabase
    .from('tournament_team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) throw new Error('Jesteś już w tej drużynie.');

  const { error } = await supabase.from('tournament_team_members').insert({
    team_id: teamId,
    user_id: userId,
    name: name.trim(),
    position,
    shirt_number: shirtNumber ?? null,
    is_captain: false,
    is_reserve: false,
  });
  if (error) throw error;
}

export async function withdrawTeam(teamId: string): Promise<void> {
  const { error } = await supabase
    .from('tournament_teams')
    .update({ status: 'withdrawn' })
    .eq('id', teamId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Groups, standings, matches
// ---------------------------------------------------------------------------

export async function getGroups(tournamentId: string): Promise<TournamentGroup[]> {
  const { data } = await supabase
    .from('tournament_groups')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('name', { ascending: true });
  return (data ?? []).map(toGroup);
}

export async function getStandings(tournamentId: string): Promise<TournamentStanding[]> {
  const { data } = await supabase
    .from('tournament_standings')
    .select('*')
    .eq('tournament_id', tournamentId);
  return (data ?? []).map(toStanding);
}

export async function getMatches(tournamentId: string): Promise<TournamentMatch[]> {
  const { data } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('bracket_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  return (data ?? []).map(toMatch);
}

/** Days both teams marked as available (ISO 1=Mon…7=Sun) — proposed first when scheduling. */
export async function getSharedDays(teamA: string, teamB: string): Promise<number[]> {
  const { data } = await supabase.rpc('shared_availability_days', {
    p_team_a: teamA,
    p_team_b: teamB,
  });
  return (data as number[]) ?? [];
}

/** Captain proposes a date/time (+ optional venue) for a match. */
export async function proposeMatchSlot(
  matchId: string,
  proposedByTeamId: string,
  slotIso: string,
  venueText?: string,
  venueSlotId?: string,
): Promise<void> {
  const { error } = await supabase
    .from('tournament_matches')
    .update({
      proposed_by_team_id: proposedByTeamId,
      proposed_slot: slotIso,
      venue_text: venueText ?? null,
      venue_slot_id: venueSlotId ?? null,
      status: 'proposed',
    })
    .eq('id', matchId);
  if (error) throw error;
}

/** Opponent accepts the proposed slot → match becomes scheduled. */
export async function acceptMatchSlot(matchId: string, slotIso: string): Promise<void> {
  const { error } = await supabase
    .from('tournament_matches')
    .update({ scheduled_at: slotIso, status: 'scheduled' })
    .eq('id', matchId);
  if (error) throw error;
}

/** Report a result (by one captain). Opponent confirms separately. */
export async function reportResult(
  matchId: string,
  reportedByTeamId: string,
  scoreA: number,
  scoreB: number,
): Promise<void> {
  const { error } = await supabase
    .from('tournament_matches')
    .update({
      score_a: scoreA,
      score_b: scoreB,
      reported_by_team_id: reportedByTeamId,
    })
    .eq('id', matchId);
  if (error) throw error;
}

/** Opponent confirms the reported result → match played, winner set. */
export async function confirmResult(
  matchId: string,
  confirmedByTeamId: string,
  scoreA: number,
  scoreB: number,
  teamAId?: string,
  teamBId?: string,
): Promise<void> {
  const winner =
    scoreA > scoreB ? teamAId : scoreB > scoreA ? teamBId : null;
  const { error } = await supabase
    .from('tournament_matches')
    .update({
      confirmed_by_team_id: confirmedByTeamId,
      winner_team_id: winner ?? null,
      status: 'played',
      played_at: new Date().toISOString(),
    })
    .eq('id', matchId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Partner venues + slots
// ---------------------------------------------------------------------------

export async function getVenues(tournamentId: string): Promise<TournamentVenue[]> {
  const { data } = await supabase
    .from('tournament_venues')
    .select('*, tournament_venue_slots(*)')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });
  return (data ?? []).map(toVenue);
}
