'use client';

import { useState } from 'react';
import { ThumbsUp, Check, Trash2, Users } from 'lucide-react';
import Button from '@/components/ui/Button';
import TeamsPanel from './TeamsPanel';
import type { EventParticipant, TeamMode } from '@/types';
import type { TeamProposal } from '@/lib/teamProposals';

/**
 * Propozycje składów.
 *
 * Podział ról jest tu celowy i pilnowany w jednym miejscu:
 *
 *   uczestnik   — układa własną propozycję i popiera cudze; nie widzi kontrolek
 *                 organizatora i NICZEGO nie zmienia w realnym składzie,
 *   organizator — nie proponuje (ustawia składy wprost w panelu obok), za to
 *                 jako jedyny widzi „Zatwierdź" i przenosi wybraną propozycję
 *                 na drużyny.
 */

/** Read-only preview of one proposal's split. */
function ProposalPreview({
  picks, participants,
}: {
  picks: Record<string, 'A' | 'B'>;
  participants: EventParticipant[];
}) {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const teamA = Object.entries(picks).filter(([, t]) => t === 'A').map(([id]) => byId.get(id)).filter(Boolean) as EventParticipant[];
  const teamB = Object.entries(picks).filter(([, t]) => t === 'B').map(([id]) => byId.get(id)).filter(Boolean) as EventParticipant[];

  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {[
        { label: 'Niebiescy', players: teamA, cls: 'bg-blue-50 text-blue-700' },
        { label: 'Czerwoni', players: teamB, cls: 'bg-red-50 text-red-700' },
      ].map(({ label, players, cls }) => (
        <div key={label} className="rounded-xl border border-slate-100 p-2">
          <p className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>
            {label} · {players.length}
          </p>
          <ul className="mt-1 space-y-0.5">
            {players.length === 0
              ? <li className="text-[11px] italic text-slate-400">Brak</li>
              : players.map((p) => (
                <li key={p.id} className="truncate text-xs text-slate-600">{p.name}</li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function TeamProposals({
  proposals,
  participants,
  teamMode,
  isOrganizer,
  canPropose,
  currentUserId,
  busy,
  onSubmit,
  onVote,
  onUnvote,
  onAccept,
  onDelete,
}: {
  proposals: TeamProposal[];
  /** Squad members that can be split — reserves aren't playing, so they're out. */
  participants: EventParticipant[];
  teamMode: TeamMode;
  isOrganizer: boolean;
  /** True only for a signed-in participant while the squad isn't published yet. */
  canPropose: boolean;
  currentUserId?: string;
  busy: boolean;
  onSubmit: (picks: Record<string, 'A' | 'B'>) => Promise<void>;
  onVote: (proposalId: string) => Promise<void>;
  onUnvote: (proposalId: string) => Promise<void>;
  onAccept: (proposalId: string) => Promise<void>;
  onDelete: (proposalId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  // Draft lives in local state on purpose: nothing touches the database until
  // the participant hits "Zaproponuj".
  const [draft, setDraft] = useState<Record<string, 'A' | 'B'>>({});

  if (!isOrganizer && !canPropose && proposals.length === 0) return null;

  const draftTeamA = participants.filter((p) => draft[p.id] === 'A');
  const draftTeamB = participants.filter((p) => draft[p.id] === 'B');
  const draftUnassigned = participants.filter((p) => !draft[p.id]);

  const assignDraft = async (participantId: string, team: 'A' | 'B' | null) => {
    setDraft((cur) => {
      const next = { ...cur };
      if (team === null) delete next[participantId];
      else next[participantId] = team;
      return next;
    });
  };

  const randomDraft = async () => {
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const next: Record<string, 'A' | 'B'> = {};
    shuffled.forEach((p, i) => { next[p.id] = i % 2 === 0 ? 'A' : 'B'; });
    setDraft(next);
  };

  const submit = async () => {
    await onSubmit(draft);
    setDraft({});
    setEditing(false);
  };

  return (
    <div className="space-y-3">
      {editing ? (
        <div className="space-y-3">
          <TeamsPanel
            variant="propose"
            teamMode={teamMode}
            teamA={draftTeamA}
            teamB={draftTeamB}
            unassigned={draftUnassigned}
            // Drag/drop is gated on this flag inside the panel; here it means
            // "you may arrange", not "you are the organizer".
            isOrganizer
            teamsPublished={false}
            busy={busy}
            onAssignTeam={assignDraft}
            onAssignRandom={randomDraft}
            onClearTeams={async () => setDraft({})}
            onToggleCaptain={async () => { /* kapitanów ustala organizator */ }}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setEditing(false); setDraft({}); }} className="flex-1">
              Anuluj
            </Button>
            <Button
              onClick={submit}
              disabled={busy || Object.keys(draft).length === 0}
              className="flex-1"
            >
              Zaproponuj
            </Button>
          </div>
          <p className="text-[11px] text-slate-400">
            To tylko propozycja — składu nie zmienia. Ostatnie słowo ma organizator.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              Propozycje składów
              {proposals.length > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">
                  {proposals.length}
                </span>
              )}
            </h2>
            {canPropose && (
              <button
                onClick={() => setEditing(true)}
                className="shrink-0 rounded-xl bg-primary-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-800 active:scale-95"
              >
                Zaproponuj składy
              </button>
            )}
          </div>

          {proposals.length === 0 ? (
            <p className="text-sm text-slate-500">
              {canPropose
                ? 'Nikt jeszcze nic nie zaproponował — możesz być pierwszy.'
                : 'Brak propozycji.'}
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {proposals.map((pr) => (
                <li
                  key={pr.id}
                  className={`rounded-xl border p-3 ${pr.status === 'accepted' ? 'border-green-200 bg-green-50' : 'border-slate-100'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-ink">
                      {pr.authorName}
                      {pr.status === 'accepted' && (
                        <span className="ml-2 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                          zatwierdzona
                        </span>
                      )}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => (pr.votedByMe ? onUnvote(pr.id) : onVote(pr.id))}
                        disabled={busy}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                          pr.votedByMe
                            ? 'border-primary-200 bg-primary-50 text-primary-700'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                        title={pr.votedByMe ? 'Cofnij poparcie' : 'Popieram'}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> {pr.voteCount}
                      </button>
                      {isOrganizer && pr.status !== 'accepted' && (
                        <button
                          onClick={() => onAccept(pr.id)}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary-700 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-800 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" /> Zatwierdź
                        </button>
                      )}
                      {(isOrganizer || pr.proposedBy === currentUserId) && (
                        <button
                          onClick={() => onDelete(pr.id)}
                          disabled={busy}
                          className="rounded p-1.5 text-slate-400 transition hover:text-red-500"
                          title="Usuń propozycję"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <ProposalPreview picks={pr.picks} participants={participants} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
