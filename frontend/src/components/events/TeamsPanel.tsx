'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Shuffle, Star, X, Eye, EyeOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { EventParticipant, TeamMode } from '@/types';
import { TEAM_MODE_LABELS } from '@/lib/eventFeatures';

const TEAM_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500', dropBg: 'bg-blue-100/50' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500', dropBg: 'bg-orange-100/50' },
];

// ---------------------------------------------------------------------------
// Draggable player row
// ---------------------------------------------------------------------------
function DraggablePlayer({
  participant,
  isOrganizer,
  showCaptain,
  onToggleCaptain,
  teamColor,
  busy,
}: {
  participant: EventParticipant;
  isOrganizer: boolean;
  showCaptain: boolean;
  onToggleCaptain: (p: EventParticipant) => void;
  teamColor: (typeof TEAM_COLORS)[number];
  busy: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: participant.id,
    disabled: !isOrganizer || busy,
  });

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.35 : 1, cursor: isOrganizer ? 'grab' : 'default' }}
      className={[
        'flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-sm select-none',
        isOrganizer ? 'hover:bg-black/5' : '',
        isDragging ? 'ring-2 ring-primary-300' : '',
      ].join(' ')}
    >
      <span className="flex items-center gap-1.5 text-slate-800 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${teamColor.dot}`} />
        <span className="truncate">{participant.name}</span>
        {participant.isCaptain && <Star className="w-3 h-3 text-amber-500 shrink-0" />}
      </span>
      {showCaptain && isOrganizer && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCaptain(participant); }}
          disabled={busy}
          className={participant.isCaptain ? 'text-amber-500 hover:text-amber-400' : 'text-slate-300 hover:text-amber-400'}
          title={participant.isCaptain ? 'Usuń kapitana' : 'Ustaw kapitana'}
        >
          <Star className="w-3 h-3" />
        </button>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Droppable column
// ---------------------------------------------------------------------------
function DroppableColumn({
  teamLabel,
  participants,
  isOrganizer,
  showCaptain,
  canManualAssign,
  onMoveToOther,
  onToggleCaptain,
  teamIndex,
  busy,
}: {
  teamLabel: string;
  participants: EventParticipant[];
  isOrganizer: boolean;
  showCaptain: boolean;
  canManualAssign: boolean;
  onMoveToOther: (id: string) => void;
  onToggleCaptain: (p: EventParticipant) => void;
  teamIndex: number;
  busy: boolean;
}) {
  const c = TEAM_COLORS[teamIndex];
  const { setNodeRef, isOver } = useDroppable({ id: `team-${teamLabel}` });

  return (
    <div
      ref={setNodeRef}
      className={[
        'rounded-xl border p-3 transition-colors duration-150',
        c.bg, c.border,
        isOver && canManualAssign ? c.dropBg : '',
      ].join(' ')}
    >
      <p className={`text-xs font-bold mb-2 uppercase tracking-wide ${c.text}`}>Drużyna {teamLabel}</p>
      <ul className="space-y-0.5 min-h-[32px]">
        {participants.map((p) => (
          <DraggablePlayer
            key={p.id}
            participant={p}
            isOrganizer={isOrganizer && canManualAssign}
            showCaptain={showCaptain}
            onToggleCaptain={onToggleCaptain}
            teamColor={c}
            busy={busy}
          />
        ))}
        {participants.length === 0 && (
          <li className="text-xs text-slate-400 italic py-1 px-2">
            {isOver ? 'Upuść tutaj…' : 'Brak graczy'}
          </li>
        )}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unassigned tray (droppable)
// ---------------------------------------------------------------------------
function UnassignedTray({
  participants,
  isOrganizer,
  busy,
  onAssign,
}: {
  participants: EventParticipant[];
  isOrganizer: boolean;
  busy: boolean;
  onAssign: (id: string, team: 'A' | 'B') => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'team-unassigned' });

  if (participants.length === 0) return null;

  return (
    <div ref={setNodeRef} className={['mt-3 rounded-xl border border-dashed border-slate-300 p-3 transition-colors', isOver ? 'bg-slate-100' : ''].join(' ')}>
      <p className="text-xs text-slate-500 mb-2">Nieprzypisani ({participants.length})</p>
      <div className="flex flex-wrap gap-2">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center gap-1.5 bg-white rounded-xl px-2.5 py-1 text-sm text-slate-700 border border-slate-200">
            <span>{p.name}</span>
            {isOrganizer && (
              <>
                <button onClick={() => onAssign(p.id, 'A')} disabled={busy} className="text-xs text-blue-600 hover:text-blue-800 font-bold">A</button>
                <button onClick={() => onAssign(p.id, 'B')} disabled={busy} className="text-xs text-orange-600 hover:text-orange-800 font-bold">B</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------
export interface TeamsPanelProps {
  teamMode: TeamMode;
  teamA: EventParticipant[];
  teamB: EventParticipant[];
  unassigned: EventParticipant[];
  isOrganizer: boolean;
  teamsPublished: boolean;
  busy: boolean;
  onAssignTeam: (participantId: string, team: 'A' | 'B' | null) => Promise<void>;
  onAssignRandom: () => Promise<void>;
  onClearTeams: () => Promise<void>;
  onToggleCaptain: (p: EventParticipant) => Promise<void>;
  onPublishTeams?: () => Promise<void>;
  onUnpublishTeams?: () => Promise<void>;
}

export default function TeamsPanel({
  teamMode, teamA, teamB, unassigned, isOrganizer, teamsPublished, busy,
  onAssignTeam, onAssignRandom, onClearTeams, onToggleCaptain, onPublishTeams, onUnpublishTeams,
}: TeamsPanelProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const canManualAssign = ['reczne', 'kapitanowie'].includes(teamMode);
  const showCaptain = teamMode === 'kapitanowie';

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  }));

  function handleDragStart({ active }: DragStartEvent) {
    setDraggingId(active.id as string);
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    if (!over) return;

    const targetId = over.id as string;
    const participantId = active.id as string;

    if (targetId === 'team-A') await onAssignTeam(participantId, 'A');
    else if (targetId === 'team-B') await onAssignTeam(participantId, 'B');
    else if (targetId === 'team-unassigned') await onAssignTeam(participantId, null);
  }

  const allParticipants = [...teamA, ...teamB, ...unassigned];
  const draggingParticipant = draggingId ? allParticipants.find((p) => p.id === draggingId) : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Shuffle className="w-4 h-4" />
          Składy
          <span className="text-xs font-normal text-slate-500">({TEAM_MODE_LABELS[teamMode]})</span>
          {teamsPublished
            ? <span className="text-xs font-normal text-green-600 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">opublikowane</span>
            : isOrganizer && <span className="text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">robocze</span>
          }
        </h2>
        {isOrganizer && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onAssignRandom} disabled={busy}>
              <Shuffle className="w-3.5 h-3.5" /> Losuj
            </Button>
            {(teamA.length > 0 || teamB.length > 0) && (
              <Button variant="outline" size="sm" onClick={onClearTeams} disabled={busy}>
                <X className="w-3.5 h-3.5" /> Wyczyść
              </Button>
            )}
            {!teamsPublished && onPublishTeams && (
              <Button size="sm" onClick={onPublishTeams} disabled={busy}>
                <Eye className="w-3.5 h-3.5" /> Opublikuj
              </Button>
            )}
            {teamsPublished && onUnpublishTeams && (
              <Button variant="outline" size="sm" onClick={onUnpublishTeams} disabled={busy}>
                <EyeOff className="w-3.5 h-3.5" /> Ukryj
              </Button>
            )}
          </div>
        )}
      </div>

      {canManualAssign && isOrganizer && (
        <p className="text-xs text-slate-400 mb-3">Przeciągnij gracza między kolumnami, żeby zmienić drużynę.</p>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-2 gap-3">
          <DroppableColumn
            teamLabel="A"
            teamIndex={0}
            participants={teamA}
            isOrganizer={isOrganizer}
            showCaptain={showCaptain}
            canManualAssign={canManualAssign}
            onMoveToOther={(id) => onAssignTeam(id, 'B')}
            onToggleCaptain={onToggleCaptain}
            busy={busy}
          />
          <DroppableColumn
            teamLabel="B"
            teamIndex={1}
            participants={teamB}
            isOrganizer={isOrganizer}
            showCaptain={showCaptain}
            canManualAssign={canManualAssign}
            onMoveToOther={(id) => onAssignTeam(id, 'A')}
            onToggleCaptain={onToggleCaptain}
            busy={busy}
          />
        </div>

        <UnassignedTray
          participants={unassigned}
          isOrganizer={isOrganizer}
          busy={busy}
          onAssign={(id, team) => onAssignTeam(id, team)}
        />

        <DragOverlay>
          {draggingParticipant && (
            <div className="bg-white rounded-lg border border-primary-300 shadow-lg px-3 py-1.5 text-sm font-medium text-slate-800 cursor-grabbing">
              {draggingParticipant.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
