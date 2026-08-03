import { supabase } from './supabase';

/**
 * Propozycje składów od uczestników (migracja 059).
 *
 * Kluczowa zasada: propozycja **nie dotyka** `event_participants.team`.
 * Dopóki organizator jej nie zatwierdzi, realne drużyny zostają nienaruszone —
 * dzięki temu uczestnik nigdy nie zmieni składu przypadkiem, a organizator
 * zachowuje ostatnie słowo.
 */

export interface TeamProposal {
  id: string;
  eventId: string;
  proposedBy: string;
  /** Display name of the author, resolved from the roster. */
  authorName: string;
  createdAt: string;
  status: 'pending' | 'accepted';
  /** participantId → team */
  picks: Record<string, 'A' | 'B'>;
  voteCount: number;
  /** Whether the signed-in user has backed this one. */
  votedByMe: boolean;
}

/** All proposals for an event, most-supported first. */
export async function getTeamProposals(
  eventId: string,
  currentUserId?: string,
): Promise<TeamProposal[]> {
  const { data: rows, error } = await supabase
    .from('team_proposals')
    .select('id, event_id, proposed_by, created_at, status')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return [];

  const ids = rows.map((r) => r.id as string);

  const [{ data: pickRows }, { data: voteRows }, { data: nameRows }] = await Promise.all([
    supabase.from('team_proposal_picks').select('proposal_id, participant_id, team').in('proposal_id', ids),
    supabase.from('team_proposal_votes').select('proposal_id, user_id').in('proposal_id', ids),
    // Author names come from the roster — the same source the squad list uses,
    // so a proposal is signed with the name everyone already recognises.
    supabase.from('event_participants').select('user_id, name').eq('event_id', eventId),
  ]);

  const nameByUser: Record<string, string> = {};
  for (const r of nameRows ?? []) {
    if (r.user_id) nameByUser[r.user_id as string] = r.name as string;
  }

  const picksByProposal: Record<string, Record<string, 'A' | 'B'>> = {};
  for (const r of pickRows ?? []) {
    const pid = r.proposal_id as string;
    (picksByProposal[pid] ??= {})[r.participant_id as string] = r.team as 'A' | 'B';
  }

  const votesByProposal: Record<string, string[]> = {};
  for (const r of voteRows ?? []) {
    (votesByProposal[r.proposal_id as string] ??= []).push(r.user_id as string);
  }

  return rows
    .map((r) => {
      const voters = votesByProposal[r.id as string] ?? [];
      return {
        id: r.id as string,
        eventId: r.event_id as string,
        proposedBy: r.proposed_by as string,
        authorName: nameByUser[r.proposed_by as string] ?? 'Uczestnik',
        createdAt: r.created_at as string,
        status: (r.status ?? 'pending') as 'pending' | 'accepted',
        picks: picksByProposal[r.id as string] ?? {},
        voteCount: voters.length,
        votedByMe: !!currentUserId && voters.includes(currentUserId),
      };
    })
    .sort((a, b) => b.voteCount - a.voteCount || a.createdAt.localeCompare(b.createdAt));
}

/** Submit a proposal. Replaces the author's previous one — one per person per
 *  match, so the list stays readable instead of filling with near-duplicates. */
export async function createTeamProposal(
  eventId: string,
  userId: string,
  picks: Record<string, 'A' | 'B'>,
): Promise<void> {
  if (Object.keys(picks).length === 0) {
    throw new Error('Przypisz choć jednego gracza do drużyny.');
  }

  await supabase.from('team_proposals').delete().eq('event_id', eventId).eq('proposed_by', userId);

  const { data: row, error } = await supabase
    .from('team_proposals')
    .insert({ event_id: eventId, proposed_by: userId })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const rows = Object.entries(picks).map(([participantId, team]) => ({
    proposal_id: row.id,
    participant_id: participantId,
    team,
  }));
  const { error: pickErr } = await supabase.from('team_proposal_picks').insert(rows);
  if (pickErr) throw new Error(pickErr.message);
}

export async function deleteTeamProposal(proposalId: string): Promise<void> {
  const { error } = await supabase.from('team_proposals').delete().eq('id', proposalId);
  if (error) throw new Error(error.message);
}

export async function voteTeamProposal(proposalId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('team_proposal_votes')
    .insert({ proposal_id: proposalId, user_id: userId });
  // Double-tap on an already-backed proposal shouldn't read as a failure.
  if (error && !error.message.toLowerCase().includes('duplicate')) throw new Error(error.message);
}

export async function unvoteTeamProposal(proposalId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('team_proposal_votes')
    .delete()
    .eq('proposal_id', proposalId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** Organizer applies a proposal to the real squad. Permission is enforced in
 *  the SQL function, not here. */
export async function acceptTeamProposal(proposalId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_team_proposal', { p_proposal_id: proposalId });
  if (error) throw new Error(error.message);
}
