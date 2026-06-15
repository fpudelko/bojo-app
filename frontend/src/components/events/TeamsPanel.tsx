'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { Shuffle, Star, X, Eye, EyeOff, GripVertical } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { EventParticipant, TeamMode } from '@/types';
import { TEAM_MODE_LABELS } from '@/lib/eventFeatures';

const TEAMS = {
  A: {
    label: 'Niebiescy',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    borderDrop: 'border-blue-400',
    text: 'text-blue-700',
    badge: 'bg-blue-600 text-white',
    dot: 'bg-blue-500',
    dropBg: 'bg-blue-100/60',
    btnBg: 'bg-blue-600 hover:bg-blue-700 text-white',
    pill: 'bg-blue-100 text-blue-700',
  },
  B: {
    label: 'Czerwoni',
    bg: 'bg-red-50',
    border: 'border-red-200',
    borderDrop: 'border-red-400',
    text: 'text-red-700',
    badge: 'bg-red-600 text-white',
    dot: 'bg-red-500',
    dropBg: 'bg-red-100/60',
    btnBg: 'bg-red-600 hover:bg-red-700 text-white',
    pill: 'bg-red-100 text-red-700',
  },
} as const;

// ---------------------------------------------------------------------------
// Draggable player row
// ---------------------------------------------------------------------------
function DraggablePlayer({
  participant,
  isOrganizer,
  showCaptain,
  onToggleCaptain,
  team,
  busy,
}: {
  participant: EventParticipant;
  isOrganizer: boolean;
  showCaptain: boolean;
  onToggleCaptain: (p: EventParticipant) => void;
  team: keyof typeof TEAMS;
  busy: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: participant.id,
    disabled: !isOrganizer || busy,
  });

  const c = TEAMS[team];

  return (
    <li
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      className={[
        'flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm select-none transition-colors',
        isOrganizer ? 'hover:bg-black/5' : '',
        isDragging ? 'shadow-lg' : '',
      ].join(' ')}
    >
      {isOrganizer && (
        <span
          {...listeners}
          {...attributes}
          className="cursor-grab text-slate-300 hover:text-slate-500 shrink-0 touch-none"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
      )}
      <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
      <span className="flex-1 text-slate-800 truncate">{participant.name}</span>
      {participant.isCaptain && <Star className="w-3 h-3 text-amber-500 shrink-0" />}
      {showCaptain && isOrganizer && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCaptain(participant); }}
          disabled={busy}
          className={`shrink-0 transition-colors ${participant.isCaptain ? 'text-amber-500 hover:text-amber-400' : 'text-slate-200 hover:text-amber-400'}`}
          title={participant.isCaptain ? 'Usuń kapitana' : 'Ustaw kapitana'}
        >
          <Star className="w-3.5 h-3.5" />
        </button>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Droppable column
// ---------------------------------------------------------------------------
function DroppableColumn({
  team,
  participants,
  isOrganizer,
  showCaptain,
  canManualAssign,
  onToggleCaptain,
  busy,
}: {
  team: keyof typeof TEAMS;
  participants: EventParticipant[];
  isOrganizer: boolean;
  showCaptain: boolean;
  canManualAssign: boolean;
  onToggleCaptain: (p: EventParticipant) => void;
  busy: boolean;
}) {
  const c = TEAMS[team];
  const { setNodeRef, isOver } = useDroppable({ id: `team-${team}` });

  return (
    <div
      ref={setNodeRef}
      className={[
        'rounded-2xl border-2 p-3 transition-all duration-150 min-h-[120px]',
        c.bg,
        isOver && canManualAssign ? `${c.borderDrop} ${c.dropBg}` : c.border,
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className={`text-xs font-bold uppercase tracking-wide ${c.text}`}>{c.label}</span>
        <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${c.badge}`}>
          {participants.length}
        </span>
      </div>
      <ul className="space-y-0.5">
        {participants.map((p) => (
          <DraggablePlayer
            key={p.id}
            participant={p}
            isOrganizer={isOrganizer && canManualAssign}
            showCaptain={showCaptain}
            onToggleCaptain={onToggleCaptain}
            team={team}
            busy={busy}
          />
        ))}
        {participants.length === 0 && (
          <li className={`text-xs italic py-2 px-2.5 ${isOver ? c.text : 'text-slate-400'}`}>
            {isOver ? 'Upuść tutaj…' : 'Brak graczy'}
          </li>
        )}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unassigned tray
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
    <div
      ref={setNodeRef}
      className={[
        'mt-3 rounded-2xl border-2 border-dashed p-3 transition-colors',
        isOver ? 'border-slate-400 bg-slate-50' : 'border-slate-200',
      ].join(' ')}
    >
      <p className="text-xs font-semibold text-slate-500 mb-2.5">
        Nieprzypisani — {participants.length}
      </p>
      <div className="space-y-1.5">
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 text-sm text-slate-700 border border-slate-200"
          >
            <span className="flex-1 truncate">{p.name}</span>
            {isOrganizer && (
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => onAssign(p.id, 'A')}
                  disabled={busy}
                  className="rounded-lg px-2.5 py-0.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                >
                  N
                </button>
                <button
                  onClick={() => onAssign(p.id, 'B')}
                  disabled={busy}
                  className="rounded-lg px-2.5 py-0.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                >
                  C
                </button>
              </div>
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
  onDisableTeams?: () => Promise<void>;
}

export default function TeamsPanel({
  teamMode, teamA, teamB, unassigned, isOrganizer, teamsPublished, busy,
  onAssignTeam, onAssignRandom, onClearTeams, onToggleCaptain, onPublishTeams, onUnpublishTeams, onDisableTeams,
}: TeamsPanelProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const canManualAssign = ['reczne', 'kapitanowie'].includes(teamMode);
  const showCaptain = teamMode === 'kapitanowie';
  const hasTeams = teamA.length > 0 || teamB.length > 0;
  const isBalanced = teamA.length === teamB.length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  function handleDragStart({ active }: DragStartEvent) {
    setDraggingId(active.id as string);
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    if (!over) return;
    const target = over.id as string;
    const id = active.id as string;
    if (target === 'team-A') await onAssignTeam(id, 'A');
    else if (target === 'team-B') await onAssignTeam(id, 'B');
    else if (target === 'team-unassigned') await onAssignTeam(id, null);
  }

  const allParticipants = [...teamA, ...teamB, ...unassigned];
  const draggingParticipant = draggingId ? allParticipants.find((p) => p.id === draggingId) : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <Shuffle className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Składy</h2>
          <span className="text-xs text-slate-400">({TEAM_MODE_LABELS[teamMode]})</span>
          {teamsPublished ? (
            <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">opublikowane</span>
          ) : isOrganizer ? (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">robocze</span>
          ) : null}
        </div>

        {/* Balance badge */}
        {hasTeams && (
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${isBalanced ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
            <span className="text-blue-600">{teamA.length}</span>
            <span className="text-slate-400">vs</span>
            <span className="text-red-600">{teamB.length}</span>
            {!isBalanced && <span className="ml-0.5">⚠</span>}
          </div>
        )}
      </div>

      {/* Organizer actions */}
      {isOrganizer && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={onAssignRandom} disabled={busy}>
            <Shuffle className="w-3.5 h-3.5" /> Losuj skład
          </Button>
          {hasTeams && (
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
              <EyeOff className="w-3.5 h-3.5" /> Ukryj składy
            </Button>
          )}
          {onDisableTeams && (
            <Button variant="outline" size="sm" onClick={onDisableTeams} disabled={busy}>
              <X className="w-3.5 h-3.5" /> Wyłącz skład
            </Button>
          )}
        </div>
      )}

      {canManualAssign && isOrganizer && (
        <p className="text-xs text-slate-400 mb-3 flex items-center gap-1">
          <GripVertical className="w-3 h-3" />
          Przeciągnij gracza do drużyny lub kliknij <strong className="text-blue-600 mx-0.5">N</strong> / <strong className="text-red-600 mx-0.5">C</strong> przy nieprzypisanym.
        </p>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Nieprzypisani — na górze żeby nie szukać */}
        <UnassignedTray
          participants={unassigned}
          isOrganizer={isOrganizer}
          busy={busy}
          onAssign={(id, team) => onAssignTeam(id, team)}
        />

        <div className={`grid grid-cols-2 gap-3 ${unassigned.length > 0 ? 'mt-3' : ''}`}>
          <DroppableColumn
            team="A"
            participants={teamA}
            isOrganizer={isOrganizer}
            showCaptain={showCaptain}
            canManualAssign={canManualAssign}
            onToggleCaptain={onToggleCaptain}
            busy={busy}
          />
          <DroppableColumn
            team="B"
            participants={teamB}
            isOrganizer={isOrganizer}
            showCaptain={showCaptain}
            canManualAssign={canManualAssign}
            onToggleCaptain={onToggleCaptain}
            busy={busy}
          />
        </div>

        <DragOverlay>
          {draggingParticipant && (
            <div className="bg-white rounded-xl border-2 border-slate-300 shadow-xl px-3 py-2 text-sm font-semibold text-slate-800 cursor-grabbing flex items-center gap-2">
              <GripVertical className="w-3.5 h-3.5 text-slate-400" />
              {draggingParticipant.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
