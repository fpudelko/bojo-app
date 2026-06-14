'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Calendar, Clock, MapPin, Users, UserPlus, Trash2, Lock, Globe, Share2,
  Check, X, Pencil, Banknote, Phone, Trophy, MessageSquare, Star,
  BanIcon, RotateCcw, AlertTriangle, Copy, ArrowRight, ChevronDown, ChevronRight, Settings,
  ArrowLeft, Navigation, RefreshCw, TrendingUp, Tag,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import MatchResultForm from '@/components/events/MatchResultForm';
import TeamsPanel from '@/components/events/TeamsPanel';
import EventComments from '@/components/events/EventComments';
import { useAuth, displayName } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { useToast } from '@/lib/toast';
import { venueThumbnail } from '@/lib/labels';
import { eventLocation, slugify } from '@/lib/utils';
import {
  getEvent, joinEvent, addGuest, removeParticipant, setVisibility, deleteEvent,
  cancelEvent, restoreEvent, repeatEvent, setAllowGuestAdds,
} from '@/lib/events';
import {
  getEventInvites, deleteInvite, validateInviteToken, acceptInvite,
} from '@/lib/invites';
import type { EventInvite } from '@/lib/invites';
import {
  updateParticipantStatus, updateParticipantTeam, updateParticipantPayment,
  sendConfirmationSms, assignTeamsRandomly, clearTeams as clearTeamsDb, setCaptain,
  getMatchResult, saveMatchResult, getPlayerGoals, setPlayerGoals as savePlayerGoals, submitReport,
  publishTeams, unpublishTeams,
  TEAM_MODE_LABELS,
} from '@/lib/eventFeatures';
import type {
  EventItem, EventParticipant, MatchResult, PlayerGoal, ParticipantStatus, ReportType,
} from '@/types';
import { sportEmoji } from '@/lib/sports';

/** A labelled on/off switch — shows the current state clearly, unlike an
 *  action button whose label flips on every click. */
function SettingSwitch({ icon, title, desc, checked, disabled, onChange }: {
  icon: React.ReactNode; title: string; desc: string;
  checked: boolean; disabled?: boolean; onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={checked}
      className="w-full flex items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-white disabled:opacity-50 transition-colors"
    >
      <span className={['mt-0.5 shrink-0', checked ? 'text-primary-700' : 'text-slate-400'].join(' ')}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="block text-xs text-slate-500 mt-0.5">{desc}</span>
      </span>
      <span
        className={[
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors',
          checked ? 'bg-primary-700' : 'bg-slate-300',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </span>
    </button>
  );
}

const STATUS_LABELS: Record<ParticipantStatus, string> = {
  zaproszony: 'Zaproszony',
  potwierdzony: 'Potwierdzony',
  odrzucony: 'Odrzucił',
  brak_odpowiedzi: 'Brak odp.',
};
const STATUS_CLS: Record<ParticipantStatus, string> = {
  zaproszony: 'bg-yellow-100 text-yellow-700',
  potwierdzony: 'bg-green-100 text-green-700',
  odrzucony: 'bg-red-100 text-red-700',
  brak_odpowiedzi: 'bg-slate-100 text-slate-500',
};
const NEXT_STATUS: Record<ParticipantStatus, ParticipantStatus> = {
  zaproszony: 'potwierdzony',
  potwierdzony: 'brak_odpowiedzi',
  brak_odpowiedzi: 'odrzucony',
  odrzucony: 'zaproszony',
};
const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'nie_przyszedl', label: 'Nie przyszedł' },
  { value: 'niesportowe_zachowanie', label: 'Niesportowe zachowanie' },
  { value: 'inne', label: 'Inne' },
];

/** Collapsible participants list — visible to all (names only), teams + publish for organizer. */
function ParticipantsList({
  regulars, reserves, takenSpots, maxPlayers, isOrganizer,
  showTeams, teamsPublished, onPublishTeams, onUnpublishTeams, busy,
}: {
  regulars: EventParticipant[];
  reserves: EventParticipant[];
  takenSpots: number;
  maxPlayers: number;
  isOrganizer: boolean;
  showTeams: boolean;
  teamsPublished: boolean;
  onPublishTeams: () => void;
  onUnpublishTeams: () => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? regulars : regulars.slice(0, 4);
  const teamA = regulars.filter((p) => p.team === 'A');
  const teamB = regulars.filter((p) => p.team === 'B');
  const canSeeTeams = isOrganizer || teamsPublished;

  return (
    <div className="px-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Skład</p>
        {isOrganizer && showTeams && (
          <button
            type="button"
            onClick={teamsPublished ? onUnpublishTeams : onPublishTeams}
            disabled={busy}
            className={`text-xs font-bold rounded-full px-3 py-1 transition-colors ${
              teamsPublished
                ? 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            {teamsPublished ? '✓ Składy opublikowane' : 'Upublicznij składy'}
          </button>
        )}
      </div>
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
        {/* Team columns (when teams assigned and visible) */}
        {canSeeTeams && showTeams && teamA.length > 0 ? (
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            {[{ label: 'Drużyna A', players: teamA, color: 'bg-blue-100 text-blue-700' },
              { label: 'Drużyna B', players: teamB, color: 'bg-orange-100 text-orange-700' }]
              .map(({ label, players, color }) => (
                <div key={label} className="p-4">
                  <p className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold mb-3 ${color}`}>{label}</p>
                  <div className="space-y-2">
                    {players.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-ink truncate">{p.name}</span>
                        {p.isGoalkeeper && <span className="text-[10px]">🧤</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          /* Flat list */
          <div className="divide-y divide-slate-50">
            {shown.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium text-ink">{p.name}</span>
                {p.isGoalkeeper && <span className="text-xs text-primary-600 font-semibold">🧤 BR</span>}
              </div>
            ))}
          </div>
        )}

        {/* Expand toggle */}
        {regulars.length > 4 && !canSeeTeams && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full py-2.5 text-xs font-semibold text-primary-700 hover:bg-slate-50 border-t border-slate-100 transition-colors"
          >
            {expanded ? 'Zwiń ↑' : `Pokaż wszystkich (${regulars.length}) ↓`}
          </button>
        )}

        {/* Reserve note */}
        {reserves.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100">
            <p className="text-[11px] text-slate-400">
              Lista rezerwowa: <span className="font-semibold text-slate-600">{reserves.length} os.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = useAdmin();
  const { toast } = useToast();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [smsBusy, setSmsBusy] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [copied, setCopied] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joinAsReserve, setJoinAsReserve] = useState(false);
  const [joinRole, setJoinRole] = useState<'player' | 'goalkeeper'>('player');
  // Legacy client-side teams (teamMode === 'brak' only)
  // Match data
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [playerGoals, setPlayerGoals] = useState<PlayerGoal[]>([]);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [savingResult, setSavingResult] = useState(false);
  // Report
  const [reportTarget, setReportTarget] = useState<EventParticipant | null>(null);
  const [reportType, setReportType] = useState<ReportType>('nie_przyszedl');
  const [reportComment, setReportComment] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  // Repeat game dialog
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatDate, setRepeatDate] = useState('');
  const [repeatTime, setRepeatTime] = useState('');
  const [repeatBusy, setRepeatBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  // Invites
  const [invites, setInvites] = useState<EventInvite[]>([]);
  const [validInviteToken, setValidInviteToken] = useState<EventInvite | null>(null);

  const loadMatchData = useCallback(async (ev: EventItem) => {
    if (!ev.trackResults) return;
    const [result, goals] = await Promise.all([getMatchResult(ev.id), getPlayerGoals(ev.id)]);
    setMatchResult(result);
    if (result) { setScoreA(String(result.scoreA)); setScoreB(String(result.scoreB)); }
    setPlayerGoals(goals);
  }, []);

  const load = useCallback(async () => {
    try {
      const { event: ev, participants: parts } = await getEvent(id);
      setEvent(ev);
      setParticipants(parts);
      await loadMatchData(ev);
      // Load invites for organizer
      if (ev.organizerId) {
        getEventInvites(id).then(setInvites).catch(() => {});
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id, loadMatchData]);

  // Validate invite token from URL (?token=...)
  useEffect(() => {
    const token = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('token')
      : null;
    if (token) {
      validateInviteToken(token).then((inv) => {
        if (inv && inv.eventId === id) {
          setValidInviteToken(inv);
          acceptInvite(token).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
        </main>
      </div>
    );
  }
  if (notFound || !event) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center text-slate-500">
          <div>
            <X className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Nie znaleziono wydarzenia</p>
          </div>
        </main>
      </div>
    );
  }

  const isOrganizer = !!user && (user.id === event.organizerId || isAdmin);
  // Strict ownership — only the actual creator, never admins. Drives the inline
  // "Edytuj" link so admins don't see an edit shortcut on other people's events.
  const isOwner = !!user && user.id === event.organizerId;
  const regulars = participants.filter((p) => !p.isReserve);
  const reserves = participants.filter((p) => p.isReserve);
  const myParticipation = participants.find((p) => p.userId && p.userId === user?.id);
  const externalCount = event.externalCount ?? 0;
  const takenSpots = regulars.length + externalCount;
  const isFull = takenSpots >= event.maxPlayers;
  const eventLoc = eventLocation(event);
  const showStatus = event.trackAttendance || event.requireSmsConfirmation;
  const showTeams = event.teamMode !== 'brak';
  const isFootball = event.sport === 'piłka nożna';
  const hasGoalkeeper = regulars.some((p) => p.isGoalkeeper);
  const costPln = event.costGrosze > 0 ? (event.costGrosze / 100).toFixed(2) : null;
  const goalsMap: Record<string, number> = {};
  for (const g of playerGoals) goalsMap[g.participantId] = g.goals;
  const teamA = regulars.filter((p) => p.team === 'A');
  const teamB = regulars.filter((p) => p.team === 'B');
  const unassigned = regulars.filter((p) => !p.team);

  let dateShort = event.date;
  try {
    dateShort = format(parseISO(event.date), 'EEE d MMM', { locale: pl });
  } catch {}
  const timeStr = `${event.time?.slice(0, 5) ?? ''}${event.endTime ? `–${event.endTime.slice(0, 5)}` : ''}`;

  // Handlers
  const handleJoin = async (asGoalkeeper = false) => {
    if (!user) return;
    setBusy(true);
    try {
      await joinEvent(event.id, user.id, displayName(user), asGoalkeeper);
      await load();
      toast(asGoalkeeper ? 'Dołączyłeś jako bramkarz! 🧤' : 'Dołączyłeś do meczu!');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleAddGuest = async () => {
    if (!guestName.trim()) return;
    setBusy(true);
    try {
      await addGuest(event.id, guestName.trim(), false, user?.id ?? undefined);
      setGuestName('');
      await load();
      toast('Gość dodany');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleRemove = async (participantId: string) => {
    setBusy(true);
    try {
      await removeParticipant(participantId);
      await load();
      toast('Uczestnik usunięty');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleTogglePayment = async (p: EventParticipant) => {
    if (!isOrganizer) return;
    setBusy(true);
    try {
      await updateParticipantPayment(p.id, !p.hasPaid, !p.hasPaid ? event.costGrosze : 0);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleStatusCycle = async (p: EventParticipant) => {
    if (!isOrganizer) return;
    setBusy(true);
    try { await updateParticipantStatus(p.id, NEXT_STATUS[p.status]); await load(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); }
    finally { setBusy(false); }
  };

  const handleSendSms = async (p: EventParticipant) => {
    setSmsBusy(p.id);
    try { await sendConfirmationSms(event.id, p.id); toast(`SMS wysłany do ${p.name}`); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd SMS', 'error'); }
    finally { setSmsBusy(null); }
  };

  const handleAssignTeam = async (participantId: string, team: 'A' | 'B' | null) => {
    setBusy(true);
    try { await updateParticipantTeam(participantId, team); await load(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); }
    finally { setBusy(false); }
  };

  const handleAssignRandom = async () => {
    setBusy(true);
    try { await assignTeamsRandomly(event.id, regulars.map((p) => p.id)); await load(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); }
    finally { setBusy(false); }
  };

  const handleClearTeams = async () => {
    setBusy(true);
    try { await clearTeamsDb(event.id); await load(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); }
    finally { setBusy(false); }
  };

  const handleToggleCaptain = async (p: EventParticipant) => {
    setBusy(true);
    try { await setCaptain(p.id, !p.isCaptain); await load(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); }
    finally { setBusy(false); }
  };

  const handleToggleVisibility = async () => {
    setBusy(true);
    try {
      const next = event.visibility === 'public' ? 'private' : 'public';
      await setVisibility(event.id, next, user?.id, displayName(user ?? null));
      await load();
      toast(next === 'public' ? 'Mecz jest teraz publiczny' : 'Mecz jest teraz prywatny');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };


  const handleDeleteInvite = async (inviteId: string) => {
    try {
      await deleteInvite(inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const handleCopyInviteLink = (invite: EventInvite) => {
    const url = `${window.location.origin}/wydarzenia/${event.id}?token=${invite.token}`;
    navigator.clipboard.writeText(url)
      .then(() => toast('Link zaproszenia skopiowany!'))
      .catch(() => toast('Nie udało się skopiować — użyj przycisku "Skopiuj link"', 'error'));
  };

  const handleToggleAllowGuestAdds = async () => {
    setBusy(true);
    try {
      await setAllowGuestAdds(event.id, !event.allowGuestAdds);
      await load();
      toast(event.allowGuestAdds ? 'Uczestnicy nie mogą już zapraszać gości' : 'Uczestnicy mogą teraz dodawać gości');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: event.title || event.sport, url }); }
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); toast('Link skopiowany!'); }
    } catch { /* user cancelled */ }
  };

  const handleDelete = async () => {
    if (!confirm('Na pewno usunąć to wydarzenie? Tej operacji nie można cofnąć.')) return;
    setBusy(true);
    try { await deleteEvent(event.id); router.push('/wydarzenia'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); setBusy(false); }
  };

  const handleCancel = async () => {
    if (!confirm('Odwołać mecz? Uczestnicy zobaczą że mecz jest odwołany.')) return;
    setBusy(true);
    try {
      await cancelEvent(event.id, user?.id, displayName(user ?? null));
      await load();
      toast('Mecz odwołany');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleRestore = async () => {
    setBusy(true);
    try {
      await restoreEvent(event.id, user?.id, displayName(user ?? null));
      await load();
      toast('Mecz przywrócony');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handlePublishTeams = async () => {
    setBusy(true);
    try {
      await publishTeams(event.id);
      await load();
      toast('Składy opublikowane — uczestnicy mogą je teraz zobaczyć');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleUnpublishTeams = async () => {
    setBusy(true);
    try {
      await unpublishTeams(event.id);
      await load();
      toast('Składy ukryte');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleRepeat = async () => {
    if (!user || !repeatDate || !repeatTime) return;
    setRepeatBusy(true);
    try {
      const newId = await repeatEvent(event, repeatDate, repeatTime, user.id, displayName(user));
      setRepeatOpen(false);
      toast('Wydarzenie skopiowane!');
      router.push(`/wydarzenia/${newId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setRepeatBusy(false); }
  };

  const handleSaveResult = async () => {
    if (!user) return;
    const a = parseInt(scoreA, 10);
    const b = parseInt(scoreB, 10);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) return;
    setSavingResult(true);
    try {
      await saveMatchResult(event.id, a, b, user.id);
      await loadMatchData(event);
      toast('Wynik zapisany');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setSavingResult(false); }
  };

  const handleSetGoals = async (participantId: string, goals: number) => {
    const g = Math.max(0, goals);
    try {
      await savePlayerGoals(event.id, participantId, g);
      setPlayerGoals((prev) => {
        if (g <= 0) return prev.filter((x) => x.participantId !== participantId);
        const existing = prev.find((x) => x.participantId === participantId);
        if (existing) return prev.map((x) => x.participantId === participantId ? { ...x, goals: g } : x);
        return [...prev, { id: '', eventId: event.id, participantId, participantName: '', goals: g }];
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const handleSubmitReport = async () => {
    if (!reportTarget) return;
    setReportBusy(true);
    try {
      await submitReport(event.id, reportTarget.id, reportType, user?.id, reportComment || undefined);
      setReportTarget(null);
      setReportComment('');
      toast('Zgłoszenie wysłane');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setReportBusy(false); }
  };

  const canManualAssign = ['reczne', 'kapitanowie'].includes(event.teamMode);

  const isCancelled = event.status === 'cancelled';
  // eventStarted: event time has passed
  const eventStarted = (() => {
    try {
      const [y, m, d] = event.date.split('-').map(Number);
      const [h, min] = (event.time ?? '00:00').split(':').map(Number);
      return Date.now() >= new Date(y, m - 1, d, h, min).getTime();
    } catch { return true; }
  })();
  // resultsAvailable: event started + 30 min buffer before result form is shown
  const resultsAvailable = (() => {
    try {
      const [y, m, d] = event.date.split('-').map(Number);
      const [h, min] = (event.time ?? '00:00').split(':').map(Number);
      return Date.now() >= new Date(y, m - 1, d, h, min).getTime() + 30 * 60 * 1000;
    } catch { return true; }
  })();

  /** Helper — initials from "Imię N." */
  function initials(name: string) {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const freeSpots = event.maxPlayers - takenSpots;

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto pb-32 space-y-4">

        {/* ── HERO ── */}
        <div className="relative px-3 pt-3">
          {/* floating back + share */}
          <div className="absolute inset-x-0 top-6 z-10 flex items-center justify-between px-6">
            <button
              type="button"
              aria-label="Wróć"
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              aria-label="Udostępnij"
              onClick={handleShare}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition active:scale-95"
            >
              <Share2 className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </button>
          </div>

          <div className="relative h-[200px] overflow-hidden rounded-[20px]">
            {venueThumbnail(event.lat, event.lng, 800, 400, 17) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={venueThumbnail(event.lat, event.lng, 800, 400, 17)!}
                alt={event.fieldName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary-700 to-primary-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-primary-950/80 via-primary-900/25 to-primary-900/30" />
            <div className="absolute bottom-4 left-5">
              <span className="text-[44px] leading-none opacity-90 drop-shadow-lg" aria-hidden="true">
                {sportEmoji(event.sport)}
              </span>
            </div>
          </div>
        </div>

        {/* ── CANCELLED BANNER ── */}
        {isCancelled && (
          <div className="mx-3 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">Mecz odwołany</p>
              <p className="text-xs text-red-500">Ten mecz został odwołany przez organizatora.</p>
            </div>
            {isOwner && (
              <Button variant="outline" size="sm" onClick={handleRestore} disabled={busy}
                className="shrink-0 border-red-200 text-red-600 hover:bg-red-50">
                <RotateCcw className="w-3.5 h-3.5" /> Przywróć
              </Button>
            )}
          </div>
        )}

        {/* ── HEADER: title + meta chips ── */}
        <div className="px-4">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {event.title || event.sport}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {/* date */}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-slate-500" strokeWidth={2.25} />
              <span className="capitalize">{dateShort}</span> · {timeStr}
            </span>
            {/* duration */}
            {event.endTime && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                <Clock className="h-3.5 w-3.5 text-slate-500" strokeWidth={2.25} />
                {(() => {
                  try {
                    const [h1, m1] = (event.time ?? '00:00').split(':').map(Number);
                    const [h2, m2] = event.endTime.split(':').map(Number);
                    const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                    return diff > 0 ? `${diff} min` : null;
                  } catch { return null; }
                })()}
              </span>
            )}
            {/* venue */}
            {eventLoc.primary && (() => {
              const href = event.fieldId
                ? `/boisko/${event.fieldId}`
                : event.fieldName ? `/boisko/${slugify(event.fieldName)}` : null;
              return href ? (
                <Link
                  href={href}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                >
                  <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" strokeWidth={2.25} />
                  {eventLoc.primary}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                  <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" strokeWidth={2.25} />
                  {eventLoc.primary}
                </span>
              );
            })()}
            {/* price */}
            {event.costGrosze > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                <Tag className="h-3.5 w-3.5" strokeWidth={2.25} />
                {(event.costGrosze / 100).toFixed(0)} zł / os.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                <Tag className="h-3.5 w-3.5" strokeWidth={2.25} /> Za darmo
              </span>
            )}
            {/* visibility */}
            <span className={[
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
              event.visibility === 'public' ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-600',
            ].join(' ')}>
              {event.visibility === 'public'
                ? <><Globe className="h-3.5 w-3.5" strokeWidth={2.25} /> Publiczne</>
                : <><Lock className="h-3.5 w-3.5" strokeWidth={2.25} /> Prywatne</>}
            </span>
          </div>
        </div>

        {/* ── PLAYER COUNT BLOCK ── */}
        <div className="px-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="text-center">
              <span className="text-3xl font-extrabold tracking-tight text-primary-700">
                {takenSpots} / {event.maxPlayers}
              </span>
            </div>

            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.round((takenSpots / event.maxPlayers) * 100))}%`,
                  backgroundColor: isFull ? '#ef4444' : takenSpots / event.maxPlayers >= 0.8 ? '#f59e0b' : '#15663E',
                }}
              />
            </div>

            <p className="mt-3 text-center text-sm font-bold text-amber-500">
              {isFull
                ? 'Komplet — dołącz do rezerwy'
                : `Zostało ${freeSpots} ${freeSpots === 1 ? 'wolne miejsce' : freeSpots < 5 ? 'wolne miejsca' : 'wolnych miejsc'}`}
            </p>

            {/* Avatar stack */}
            {regulars.length > 0 && (
              <div className="mt-5 flex items-center justify-center">
                <div className="flex">
                  {regulars.slice(0, 8).map((p, i) => (
                    p.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        key={p.id}
                        src={p.avatarUrl}
                        alt={p.name}
                        title={p.name}
                        className="h-8 w-8 rounded-full ring-2 ring-white object-cover"
                        style={{ marginLeft: i === 0 ? 0 : -8, zIndex: regulars.length - i }}
                      />
                    ) : (
                      <div
                        key={p.id}
                        title={p.name}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700 ring-2 ring-white"
                        style={{ marginLeft: i === 0 ? 0 : -8, zIndex: regulars.length - i }}
                      >
                        {initials(p.name)}
                      </div>
                    )
                  ))}
                  {freeSpots > 0 && (
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-400 ring-2 ring-white"
                      style={{ marginLeft: -8 }}
                    >
                      +{freeSpots}
                    </div>
                  )}
                </div>
              </div>
            )}
            {regulars.length === 0 && (
              <p className="mt-5 text-center text-sm text-slate-400">Nikt jeszcze nie dołączył — bądź pierwszy!</p>
            )}

            {isFootball && hasGoalkeeper && (
              <p className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-center text-xs font-semibold text-green-600">
                🧤 Bramkarz jest
              </p>
            )}
          </div>
        </div>

        {/* ── UCZESTNICY — collapsible, visible to all ── */}
        {regulars.length > 0 && (
          <ParticipantsList
            regulars={regulars}
            reserves={reserves}
            takenSpots={takenSpots}
            maxPlayers={event.maxPlayers}
            isOrganizer={isOrganizer}
            showTeams={showTeams}
            teamsPublished={event.teamsPublished}
            onPublishTeams={handlePublishTeams}
            onUnpublishTeams={handleUnpublishTeams}
            busy={busy}
          />
        )}

        {/* ── BOISKO CARD ── */}
        {(eventLoc.primary || (event.lat && event.lng)) && (() => {
          const venueHref = event.fieldId
            ? `/boisko/${event.fieldId}`
            : event.fieldName ? `/boisko/${slugify(event.fieldName)}` : null;
          return (
            <div className="px-4">
              <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Boisko</p>
              <div
                className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 ${venueHref ? 'cursor-pointer transition hover:shadow-md hover:ring-primary-200' : ''}`}
                onClick={() => venueHref && router.push(venueHref)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink">{event.fieldName}</p>
                    {eventLoc.secondary && (
                      <p className="mt-0.5 text-xs text-slate-500">{eventLoc.secondary}</p>
                    )}
                    {event.lat && event.lng && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary-700 transition active:scale-95"
                      >
                        <Navigation className="h-4 w-4" strokeWidth={2.25} /> Nawiguj →
                      </a>
                    )}
                  </div>
                  {venueThumbnail(event.lat, event.lng, 160, 160) && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={venueThumbnail(event.lat, event.lng, 160, 160)!}
                      alt="Miniatura boiska"
                      className="h-20 w-20 shrink-0 rounded-xl object-cover"
                    />
                  )}
                  {venueHref && <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── "WYPISZ SIĘ" — inline, nie w sticky ── */}
        {user && myParticipation && (
          <div className="px-4">
            {!isOrganizer && !myParticipation.isReserve && event.allowGuestAdds && (
              <div className="mb-3 flex gap-2">
                <input
                  type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
                  placeholder="Dodaj znajomego bez konta…"
                  className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <Button variant="outline" onClick={handleAddGuest} disabled={busy || !guestName.trim()} className="shrink-0">
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            )}
            <button
              onClick={() => setLeaveConfirmOpen(true)} disabled={busy}
              className="w-full h-11 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
            >
              Wypisz się z meczu
            </button>
          </div>
        )}

        {/* ── STICKY JOIN BAR — tylko gdy nie jesteś zapisany ── */}
        {!(user && myParticipation) && (
          <div className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-100 bg-canvas/90 px-4 pb-6 pt-3 backdrop-blur-md">
            <div className="mx-auto max-w-2xl">
              {event.inviteOnly && !isOrganizer && !validInviteToken ? (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-ink">Mecz tylko dla zaproszonych</p>
                    <p className="text-xs text-slate-500 mt-0.5">Poproś organizatora o link z zaproszeniem.</p>
                  </div>
                </div>
              ) : !authLoading && !user ? (
                <>
                  <button
                    onClick={() => { window.location.href = `/logowanie?next=${encodeURIComponent(window.location.pathname + window.location.search)}`; }}
                    className="flex h-12 w-full items-center justify-center rounded-2xl bg-accent-500 text-[15px] font-bold text-primary-950 transition active:scale-[0.99]"
                  >
                    Zaloguj się, aby dołączyć
                  </button>
                  <p className="mt-2 text-center text-[11px] text-slate-500">Logowanie przez Google · za darmo</p>
                </>
              ) : user && !isFull ? (
                <>
                  <button
                    onClick={() => { setJoinRole('player'); setJoinAsReserve(false); setJoinDialogOpen(true); }}
                    className="flex h-12 w-full items-center justify-center rounded-2xl bg-accent-500 text-[15px] font-bold text-primary-950 transition active:scale-[0.99]"
                  >
                    Dołącz do meczu →
                  </button>
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    Dołączysz jako gracz · możesz zrezygnować do 2h przed
                  </p>
                </>
              ) : user && isFull ? (
                <>
                  <button
                    onClick={() => { setJoinRole('player'); setJoinAsReserve(true); setJoinDialogOpen(true); }}
                    className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-200 text-[15px] font-bold text-slate-600 transition active:scale-[0.99]"
                  >
                    Komplet — zapisz się na rezerwę
                  </button>
                  <p className="mt-2 text-center text-[11px] text-slate-500">Zostaniesz powiadomiony jeśli zwolni się miejsce</p>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* ── DETAILED ROSTER (organizer only) ── */}
        {isOwner && !eventStarted && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" /> Zarządzaj składem
            </h2>
            <span className={[
              'text-sm font-medium px-2.5 py-1 rounded-full',
              isFull ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700',
            ].join(' ')}>
              {takenSpots} / {event.maxPlayers}
            </span>
          </div>

          {externalCount > 0 && (
            <p className="-mt-2 mb-3 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{externalCount}</span>{' '}
              {externalCount === 1 ? 'gracz dodany' : 'graczy dodanych'} z własnej ekipy
              {event.organizerName && <> przez <span className="font-medium text-slate-700">{event.organizerName}</span></>}.
              {!isFull && (
                <span className="text-primary-700 font-medium">
                  {' '}Szukamy jeszcze {event.maxPlayers - takenSpots}.
                </span>
              )}
            </p>
          )}

          <ul className="divide-y divide-slate-100">
            {regulars.map((p) => (
              <li key={p.id} className="py-2.5">
                <div className="flex items-center gap-2">
                  {/* Avatar */}
                  {p.avatarUrl
                    ? <img src={p.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    : <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold shrink-0">{p.name.charAt(0).toUpperCase()}</span>
                  }

                  {/* Name + badges */}
                  <span className="flex-1 flex items-center gap-1 text-sm text-ink min-w-0 overflow-hidden">
                    <span className="truncate min-w-0 max-w-[100px] sm:max-w-[160px]">{p.name}</span>
                    {p.isGuest && (
                      <span className="text-xs text-slate-400 shrink-0">
                        (gość{isOrganizer && p.addedBy && p.addedBy !== user?.id
                          ? ` · dodany przez: ${
                              participants.find((x) => x.userId === p.addedBy)?.name ?? 'innego użytkownika'
                            }`
                          : ''})
                      </span>
                    )}
                    {p.isGoalkeeper && (
                      <span title="Bramkarz" className="text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-100 rounded-full px-1.5 py-0.5 shrink-0">
                        🧤 BR
                      </span>
                    )}
                    {p.userId === event.organizerId && <span className="text-xs text-primary-600 shrink-0">• org.</span>}
                    {p.isCaptain && <span title="Kapitan"><Star className="w-3 h-3 text-amber-500 shrink-0" /></span>}
                    {showTeams && p.team && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-bold shrink-0 ${p.team === 'A' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {p.team}
                      </span>
                    )}
                  </span>

                  {/* Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Status badge (organizer clicks to cycle) */}
                    {showStatus && (
                      <button
                        onClick={() => handleStatusCycle(p)}
                        disabled={busy || !isOrganizer}
                        className={`text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_CLS[p.status]} ${isOrganizer ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                        title={isOrganizer ? 'Kliknij aby zmienić status' : STATUS_LABELS[p.status]}
                      >
                        {STATUS_LABELS[p.status]}
                      </button>
                    )}

                    {/* SMS button */}
                    {event.requireSmsConfirmation && isOrganizer && p.phone && (
                      <button
                        onClick={() => handleSendSms(p)}
                        disabled={smsBusy === p.id}
                        className="p-1.5 text-slate-400 hover:text-blue-500 rounded"
                        title="Wyślij SMS z potwierdzeniem"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    )}

                    {/* Payment (trackPayments on) */}
                    {event.trackPayments && (isOrganizer || event.showPaymentStatus) && (
                      <button
                        onClick={() => isOrganizer && handleTogglePayment(p)}
                        disabled={busy || !isOrganizer}
                        aria-label={p.hasPaid ? 'Oznacz jako nieopłacone' : 'Oznacz jako opłacone'}
                        className={[
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors select-none',
                          p.hasPaid
                            ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                            : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100',
                          !isOrganizer ? 'cursor-default' : 'cursor-pointer',
                        ].join(' ')}
                      >
                        {p.hasPaid ? '✓ Zapłacił' : '✗ Nie zapłacił'}
                      </button>
                    )}

                    {/* Report button (for other logged-in participants) */}
                    {user && !isOrganizer && p.userId !== user.id && (
                      <button
                        onClick={() => setReportTarget(p)}
                        className="p-1.5 text-slate-200 hover:text-red-400 rounded"
                        title="Zgłoś uczestnika"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    )}

                    {/* Remove */}
                    {(isOrganizer || p.userId === user?.id) && p.userId !== event.organizerId && (
                      <button
                        onClick={() => handleRemove(p.id)} disabled={busy}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded"
                        aria-label="Usuń uczestnika"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {regulars.length === 0 && (
              <li className="py-4 text-sm text-slate-400 text-center">Nikt jeszcze nie dołączył</li>
            )}
          </ul>

          {/* Add guest */}
          {isOrganizer && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
              <input
                type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
                placeholder="Imię znajomego (bez konta)"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Button variant="outline" onClick={handleAddGuest} disabled={busy || !guestName.trim()}>
                <UserPlus className="w-4 h-4" /> Dodaj
              </Button>
            </div>
          )}
        </div>
        )}

        {/* Reserve list — organizer only (squad info is private) */}
        {reserves.length > 0 && isOwner && !eventStarted && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-ink flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-slate-400" />
              Lista rezerwowa
              <span className="text-xs font-normal text-slate-400 ml-1">{reserves.length} os.</span>
            </h2>
            <ul className="divide-y divide-slate-100">
              {reserves.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-medium shrink-0">{i + 1}</span>
                    <span className="truncate max-w-[160px]">{p.name}</span>
                    {p.isGuest && <span className="text-xs text-slate-400 shrink-0">(gość)</span>}
                  </span>
                  {(isOrganizer || p.userId === user?.id) && (
                    <button onClick={() => handleRemove(p.id)} disabled={busy} className="p-1.5 text-slate-400 hover:text-red-500 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* DB-persisted teams (when teamMode !== 'brak') — organizer manages privately, visible to all after publishing */}
        {showTeams && (isOrganizer || event.teamsPublished) && (
          <TeamsPanel
            teamMode={event.teamMode}
            teamA={teamA}
            teamB={teamB}
            unassigned={unassigned}
            isOrganizer={isOrganizer}
            teamsPublished={event.teamsPublished}
            busy={busy}
            onAssignTeam={handleAssignTeam}
            onAssignRandom={handleAssignRandom}
            onClearTeams={handleClearTeams}
            onToggleCaptain={handleToggleCaptain}
            onPublishTeams={handlePublishTeams}
            onUnpublishTeams={handleUnpublishTeams}
          />
        )}

        {/* Match results — only visible to participants */}
        {myParticipation && event.trackResults && !resultsAvailable && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-3 text-sm text-slate-400">
            <Trophy className="w-4 h-4 shrink-0" />
            Wynik można wpisać po rozpoczęciu meczu ({event.date} {event.time?.slice(0, 5)})
          </div>
        )}
        {myParticipation && event.trackResults && resultsAvailable && (
          <MatchResultForm
            sport={event.sport}
            eventId={event.id}
            organizerId={event.organizerId}
            currentUserId={user?.id ?? ''}
            isOrganizer={isOrganizer}
            participants={participants}
            initialResult={matchResult}
            initialGoals={playerGoals.map((g) => ({ participantId: g.participantId, goals: g.goals }))}
            onSaved={(result) => setMatchResult(result)}
          />
        )}

        {/* ZAPROSZENIA */}
        {isOwner && !eventStarted && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink flex items-center gap-2">
                <Share2 className="w-4 h-4" /> Zaproszenia
              </h2>
              <Button onClick={handleShare} variant="outline" size="sm">
                {copied ? <><Check className="w-3.5 h-3.5" /> Skopiowano</> : <><Share2 className="w-3.5 h-3.5" /> Skopiuj link</>}
              </Button>
            </div>

            <p className="text-xs text-slate-500">
              Udostępnij link do meczu — każdy z linkiem może dołączyć.
            </p>

            {/* Invite list */}
            {invites.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {invites.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 py-2.5">
                    <span className={[
                      'w-2 h-2 rounded-full shrink-0',
                      inv.acceptedAt ? 'bg-green-500' : 'bg-amber-400',
                    ].join(' ')} title={inv.acceptedAt ? 'Zaakceptowane' : 'Oczekuje'} />
                    <span className="flex-1 text-sm text-slate-700 truncate">{inv.email}</span>
                    {inv.acceptedAt && (
                      <span className="text-xs text-green-600 font-medium shrink-0">Dołączył/a</span>
                    )}
                    <button
                      onClick={() => handleCopyInviteLink(inv)}
                      className="p-1.5 text-slate-300 hover:text-primary-600 rounded shrink-0"
                      title="Kopiuj link zaproszenia"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteInvite(inv.id)}
                      className="p-1.5 text-slate-300 hover:text-red-400 rounded shrink-0"
                      title="Usuń zaproszenie"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Cost split summary */}
        {event.trackPayments && event.costGrosze > 0 && isOwner && !eventStarted && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-ink flex items-center gap-2 mb-4">
              <Banknote className="w-4 h-4" /> Podział kosztów
            </h2>
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-slate-500">Koszt / os.</span>
              <span className="font-semibold text-ink">{(event.costGrosze / 100).toFixed(2)} PLN</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-slate-500">Opłaconych</span>
              <span className="font-semibold text-green-700">
                {regulars.filter((p) => p.hasPaid).length} / {regulars.length}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Zebrano</span>
              <span className="font-semibold text-ink">
                {((regulars.filter((p) => p.hasPaid).length * event.costGrosze) / 100).toFixed(2)} PLN
                {' '}<span className="text-slate-400 font-normal">z {((regulars.length * event.costGrosze) / 100).toFixed(2)} PLN</span>
              </span>
            </div>
            {regulars.some((p) => !p.hasPaid) && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2">Czekamy na wpłatę od:</p>
                <div className="flex flex-wrap gap-1.5">
                  {regulars.filter((p) => !p.hasPaid).map((p) => (
                    <span key={p.id} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comments — only for participants */}
        {myParticipation && <EventComments eventId={event.id} />}

        {/* Organizer controls — hidden until "Edytuj" so they don't clutter the
            page or invite accidental clicks on cancel/delete. */}
        {isOwner && !eventStarted && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-3">
            <button
              onClick={() => setEditMode((o) => !o)}
              className="w-full flex items-center gap-2"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-ink text-sm">Zarządzaj wydarzeniem</h2>
              <span className="ml-auto flex items-center gap-2 text-xs font-medium text-primary-600">
                {!editMode && event.inviteOnly && (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Tylko zaproszeni</span>
                )}
                {!editMode && event.visibility !== 'public' && !event.inviteOnly && (
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">Prywatne</span>
                )}
                {editMode ? 'Zamknij' : 'Edytuj'}
                <ChevronDown className={['w-4 h-4 transition-transform', editMode ? 'rotate-180' : ''].join(' ')} />
              </span>
            </button>

            {editMode && (
              <div className="space-y-3 pt-1">
                {/* Settings switches */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-1 divide-y divide-slate-100">
                  <SettingSwitch
                    icon={<Globe className="w-4 h-4" />}
                    title="Widoczne publicznie"
                    desc="Mecz pojawia się w Otwarte mecze i może do niego dołączyć każdy. Wyłączone = prywatny, tylko przez link."
                    checked={event.visibility === 'public'}
                    disabled={busy}
                    onChange={handleToggleVisibility}
                  />
                  <SettingSwitch
                    icon={<UserPlus className="w-4 h-4" />}
                    title="Uczestnicy mogą dodawać gości"
                    desc="Każdy zapisany może dopisać osobę bez konta."
                    checked={event.allowGuestAdds}
                    disabled={busy}
                    onChange={handleToggleAllowGuestAdds}
                  />
                </div>

                {/* Edit event details (separate form page) */}
                <Link
                  href={`/wydarzenia/${event.id}/edytuj`}
                  className="w-full flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg px-3 py-2"
                >
                  <Pencil className="w-4 h-4" /> Edytuj szczegóły (data, miejsce, liczba graczy)
                </Link>

                <button
                  onClick={() => { setRepeatDate(''); setRepeatTime(event.time?.slice(0, 5) ?? ''); setRepeatOpen(true); }}
                  disabled={busy}
                  className="w-full flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg px-3 py-2"
                >
                  <Copy className="w-4 h-4" /> Powtórz mecz (skopiuj)
                </button>
                {!isCancelled ? (
                  <button
                    onClick={handleCancel} disabled={busy}
                    className="w-full flex items-center gap-2 text-sm text-amber-600 hover:bg-amber-50 rounded-lg px-3 py-2"
                  >
                    <BanIcon className="w-4 h-4" /> Odwołaj mecz
                  </button>
                ) : (
                  <button
                    onClick={handleRestore} disabled={busy}
                    className="w-full flex items-center gap-2 text-sm text-green-700 hover:bg-green-50 rounded-lg px-3 py-2"
                  >
                    <RotateCcw className="w-4 h-4" /> Przywróć mecz
                  </button>
                )}
                <button
                  onClick={handleDelete} disabled={busy}
                  className="w-full flex items-center gap-2 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Usuń na stałe
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Leave confirmation */}
      {leaveConfirmOpen && myParticipation && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setLeaveConfirmOpen(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-1">Wypisać się z meczu?</h3>
            <p className="text-sm text-slate-500 mb-5">
              Twoje miejsce zwolni się i może je zająć ktoś z listy rezerwowej.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLeaveConfirmOpen(false)} className="flex-1">
                Zostań
              </Button>
              <Button
                onClick={() => { setLeaveConfirmOpen(false); handleRemove(myParticipation.id); }}
                isLoading={busy}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Wypisz mnie
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Join confirmation — role choice + explicit confirm so nobody signs up by accident */}
      {joinDialogOpen && user && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setJoinDialogOpen(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-1">
              {joinAsReserve ? 'Zapisać się na listę rezerwową?' : 'Zapisać się na mecz?'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {sportEmoji(event.sport)} {event.title || event.sport}
              {eventLoc.primary ? ` · ${eventLoc.primary}` : ''}
            </p>

            {/* Role chooser — football only */}
            {event.sport === 'piłka nożna' && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Twoja rola</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setJoinRole('player')}
                    className={[
                      'h-12 rounded-xl border text-sm font-semibold transition-colors',
                      joinRole === 'player'
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300',
                    ].join(' ')}
                  >
                    ⚽ Zawodnik
                  </button>
                  <button
                    onClick={() => setJoinRole('goalkeeper')}
                    className={[
                      'h-12 rounded-xl border text-sm font-semibold transition-colors',
                      joinRole === 'goalkeeper'
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300',
                    ].join(' ')}
                  >
                    🧤 Bramkarz
                  </button>
                </div>
              </div>
            )}

            {/* Cost */}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 mb-5 text-sm">
              <span className="text-slate-500">Koszt</span>
              <span className="font-semibold text-ink">{costPln ? `${costPln} zł` : 'Za darmo'}</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setJoinDialogOpen(false)} className="flex-1">
                Anuluj
              </Button>
              <Button
                onClick={() => { setJoinDialogOpen(false); handleJoin(joinRole === 'goalkeeper'); }}
                isLoading={busy}
                className="flex-1 bg-primary-700 hover:bg-primary-800"
              >
                Zapisz mnie
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Repeat game dialog */}
      {repeatOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setRepeatOpen(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-1">Powtórz mecz</h3>
            <p className="text-sm text-slate-500 mb-4">
              Skopiuje wszystkie ustawienia do nowego wydarzenia. Wybierz nową datę i godzinę.
            </p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data</label>
                <input
                  type="date"
                  value={repeatDate}
                  onChange={(e) => setRepeatDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Godzina</label>
                <input
                  type="time"
                  value={repeatTime}
                  onChange={(e) => setRepeatTime(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRepeatOpen(false)} className="flex-1">Anuluj</Button>
              <Button
                onClick={handleRepeat}
                isLoading={repeatBusy}
                disabled={!repeatDate || !repeatTime}
                className="flex-1"
              >
                Stwórz kopię
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Report modal */}
      {reportTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setReportTarget(null)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-1">Zgłoś uczestnika</h3>
            <p className="text-sm text-slate-500 mb-4">{reportTarget.name}</p>
            <div className="space-y-2 mb-4">
              {REPORT_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  onClick={() => setReportType(rt.value)}
                  className={[
                    'w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors',
                    reportType === rt.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300',
                  ].join(' ')}
                >
                  {rt.label}
                </button>
              ))}
            </div>
            <textarea
              value={reportComment}
              onChange={(e) => setReportComment(e.target.value)}
              placeholder="Opcjonalny komentarz…"
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setReportTarget(null)} className="flex-1">Anuluj</Button>
              <Button onClick={handleSubmitReport} isLoading={reportBusy} className="flex-1">Wyślij zgłoszenie</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
