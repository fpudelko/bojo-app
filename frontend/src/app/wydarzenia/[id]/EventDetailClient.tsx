'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Calendar, Clock, MapPin, Users, UserPlus, Trash2, Lock, Globe, Share2,
  Check, X, Pencil, Banknote, Phone, Trophy, Star,
  BanIcon, RotateCcw, AlertTriangle, Copy, ArrowRight, ChevronDown, ChevronRight, Settings,
  ArrowLeft, Navigation, RefreshCw, TrendingUp, Tag,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import TimeSelect from '@/components/ui/TimeSelect';
import CoverUpload from '@/components/ui/CoverUpload';
import MatchResultForm from '@/components/events/MatchResultForm';
import TeamsPanel from '@/components/events/TeamsPanel';
import EventComments from '@/components/events/EventComments';
import { useAuth, displayName } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { useToast } from '@/lib/toast';
import { venueThumbnail } from '@/lib/labels';
import { eventLocation } from '@/lib/utils';
import {
  getEvent, joinEvent, joinEventMaybe, confirmFromMaybe, addGuest, removeParticipant, setVisibility, deleteEvent,
  cancelEvent, restoreEvent, repeatEvent, setAllowGuestAdds,
  approveParticipant, rejectParticipant,
} from '@/lib/events';
import {
  updateParticipantStatus, updateParticipantTeam, updateParticipantPayment,
  sendConfirmationSms, assignTeamsRandomly, clearTeams as clearTeamsDb, setCaptain,
  getMatchResult, saveMatchResult, getPlayerGoals, setPlayerGoals as savePlayerGoals, submitReport,
  publishTeams, unpublishTeams, saveEventAdvancedSettings,
  TEAM_MODE_LABELS,
} from '@/lib/eventFeatures';
import type {
  EventItem, EventParticipant, MatchResult, PlayerGoal, ParticipantStatus, ReportType,
  PaymentMethod, SportsCardProvider,
} from '@/types';
import { sportEmoji } from '@/lib/sports';
import { PAYMENT_METHOD_LABELS, sportsCardLabel, priceForParticipant } from '@/lib/payments';

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
const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'nie_przyszedl', label: 'Nie przyszedł' },
  { value: 'niesportowe_zachowanie', label: 'Niesportowe zachowanie' },
  { value: 'inne', label: 'Inne' },
];

/** Player avatar — real photo when available, initials otherwise. */
function PlayerAvatar({ p }: { p: EventParticipant }) {
  return p.avatarUrl ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={p.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-bold text-primary-700">
      {p.name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Wraps a participant row in a link to their public profile — but only for
 *  real accounts (guests have no profile page). */
function PlayerLink({ p, className, children }: {
  p: EventParticipant; className?: string; children: React.ReactNode;
}) {
  if (p.userId && !p.isGuest) {
    return (
      <Link href={`/gracz/${p.userId}`} className={className}>
        {children}
      </Link>
    );
  }
  return <div className={className}>{children}</div>;
}

/** Inline roster — rendered INSIDE the player-count card when the avatar stack
 *  is expanded. Always shows flat lists: regulars then reserves. */
function ParticipantsList({
  regulars, reserves,
}: {
  regulars: EventParticipant[];
  reserves: EventParticipant[];
}) {
  return (
    <div className="space-y-3 text-left">
      <div className="divide-y divide-slate-50 dark:divide-slate-700">
        {regulars.map((p) => (
          <PlayerLink key={p.id} p={p} className="flex items-center gap-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <PlayerAvatar p={p} />
            <span className="flex-1 text-sm font-medium text-ink truncate">{p.name}</span>
            {p.isGoalkeeper && <span className="text-xs text-primary-600 font-semibold">🧤 BR</span>}
          </PlayerLink>
        ))}
      </div>

      {reserves.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1 border-t border-slate-100 dark:border-slate-700" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rezerwa</span>
            <div className="flex-1 border-t border-slate-100 dark:border-slate-700" />
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
            {reserves.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-400">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Public read-only teams view — shown when teams are published, separate from the participant list. */
function PublishedTeamsCard({
  teamA, teamB, unassigned,
}: {
  teamA: EventParticipant[];
  teamB: EventParticipant[];
  unassigned: EventParticipant[];
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">Składy</p>
      <div className="grid grid-cols-2 gap-4">
        {[{ label: 'Niebiescy', players: teamA, color: 'bg-blue-100 text-blue-700' },
          { label: 'Czerwoni',  players: teamB, color: 'bg-red-100 text-red-700'  }]
          .map(({ label, players, color }) => (
            <div key={label}>
              <p className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold mb-2 ${color}`}>
                {label} · {players.length}
              </p>
              <div className="space-y-1.5">
                {players.length === 0
                  ? <p className="text-xs italic text-slate-400">Brak graczy</p>
                  : players.map((p) => (
                    <PlayerLink key={p.id} p={p} className="flex items-center gap-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <PlayerAvatar p={p} />
                      <span className="text-sm font-medium text-ink truncate">{p.name}</span>
                      {p.isGoalkeeper && <span className="text-[10px]">🧤</span>}
                      {p.isCaptain && <span className="text-[10px]">⭐</span>}
                    </PlayerLink>
                  ))}
              </div>
            </div>
          ))}
      </div>
      {unassigned.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Nieprzypisani — {unassigned.length}
          </p>
          <div className="space-y-1">
            {unassigned.map((p) => (
              <PlayerLink key={p.id} p={p} className="flex items-center gap-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <PlayerAvatar p={p} />
                <span className="text-sm font-medium text-ink truncate">{p.name}</span>
              </PlayerLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Real track+thumb switch — same visual language as "Biorę udział" etc.
 *  elsewhere in the app, so it unmistakably reads as clickable. */
function Switch({ checked, onChange, disabled, label }: {
  checked: boolean; onChange: () => void; disabled?: boolean; label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-label={label}
      aria-checked={checked}
      role="switch"
      className={[
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-50',
        checked ? 'bg-green-600' : 'bg-slate-300',
      ].join(' ')}
    >
      <span className={[
        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-5' : 'translate-x-0',
      ].join(' ')} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// JoinCodePanel — visible to all participants
// ---------------------------------------------------------------------------
function JoinCodePanel({ joinCode, eventId }: { joinCode: string; eventId: string }) {
  const [copied, setCopied] = useState(false);

  const link = typeof window !== 'undefined'
    ? `${window.location.origin}/d/${joinCode}`
    : `https://bojo.pl/d/${joinCode}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ url: link }).catch(() => {});
    } else {
      copyLink();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 flex items-center gap-3">
      <Share2 className="w-4 h-4 text-slate-400 shrink-0" />
      <p className="flex-1 text-sm font-semibold text-slate-800">Zaproś znajomych</p>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={share}
          className="flex items-center gap-1.5 rounded-xl bg-primary-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-800 active:scale-95"
        >
          <Share2 className="w-3.5 h-3.5" /> Udostępnij
        </button>
        <button
          onClick={copyLink}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
        >
          {copied ? <><Check className="w-3.5 h-3.5 text-green-600" /> OK</> : <><Copy className="w-3.5 h-3.5" /> Kopiuj</>}
        </button>
      </div>
    </div>
  );
}

export default function EventDetailClient() {
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
  const [guestIsGk, setGuestIsGk] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joinAsReserve, setJoinAsReserve] = useState(false);
  const [joinRole, setJoinRole] = useState<'player' | 'goalkeeper'>('player');
  const [joinHasSportsCard, setJoinHasSportsCard] = useState(false);
  const [joinSportsCardProvider, setJoinSportsCardProvider] = useState<SportsCardProvider | undefined>(undefined);
  const [joinPaymentMethod, setJoinPaymentMethod] = useState<PaymentMethod | undefined>(undefined);
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatDate, setRepeatDate] = useState('');
  const [repeatTime, setRepeatTime] = useState('');
  const [repeatBusy, setRepeatBusy] = useState(false);
  const [repeatJoin, setRepeatJoin] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [groupInfo, setGroupInfo] = useState<{ id: string; name: string } | null>(null);
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
      if (ev.groupId) {
        import('@/lib/groups').then(({ getGroup }) =>
          getGroup(ev.groupId!).then((g) => g && setGroupInfo({ id: g.id, name: g.name })).catch(() => {}),
        );
      } else {
        setGroupInfo(null);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id, loadMatchData]);

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
  // Pending requests don't count toward the roster or capacity.
  const confirmed = participants.filter((p) => !p.pendingApproval);
  const pendingRequests = participants.filter((p) => p.pendingApproval);
  const regulars = confirmed.filter((p) => !p.isReserve);
  const reserves = confirmed.filter((p) => p.isReserve);
  const myConfirmed = confirmed.find((p) => p.userId && p.userId === user?.id && p.rsvp !== 'maybe');
  const myMaybe = confirmed.find((p) => p.userId && p.userId === user?.id && p.rsvp === 'maybe');
  const myPendingRequest = pendingRequests.find((p) => p.userId && p.userId === user?.id);
  // "myParticipation" = I'm in the roster (confirmed). Pending is handled separately.
  const myParticipation = myConfirmed;
  // My row whichever way I'm in — confirmed or "maybe" (used by the leave dialog).
  const myEntry = myConfirmed ?? myMaybe;
  const takenSpots = regulars.length;
  const isFull = takenSpots >= event.maxPlayers;
  const eventLoc = eventLocation(event);
  const showStatus = event.trackAttendance || event.requireSmsConfirmation;
  const showTeams = event.teamMode !== 'brak';
  // Goalkeeper distinction is an explicit per-event setting now.
  const gkEnabled = event.goalkeepersEnabled;
  const gkCount = regulars.filter((p) => p.isGoalkeeper).length;
  const gkFull = gkCount >= (event.maxGoalkeepers ?? 2);
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
  const handleMaybe = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await joinEventMaybe(event.id, user.id, displayName(user));
      await load();
      toast('Obserwujesz ten mecz — znajdziesz go w Twoich meczach');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleConfirmMaybe = async () => {
    if (!user || !myMaybe) return;
    setBusy(true);
    try {
      await confirmFromMaybe(myMaybe.id, event.id);
      await load();
      toast('Potwierdzono udział!');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleJoin = async (asGoalkeeper = false) => {
    if (!user) return;
    setBusy(true);
    try {
      await joinEvent(event.id, user.id, displayName(user), asGoalkeeper, {
        method: joinPaymentMethod,
        hasSportsCard: joinHasSportsCard,
        sportsCardProvider: joinSportsCardProvider,
      });
      await load();
      if (event.requireApproval) {
        toast('Wysłano prośbę o dołączenie — czekaj na akceptację organizatora');
      } else {
        toast(asGoalkeeper ? 'Dołączyłeś jako bramkarz! 🧤' : 'Dołączyłeś do meczu!');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleApprove = async (participantId: string) => {
    setBusy(true);
    try {
      await approveParticipant(participantId);
      await load();
      toast('Zaakceptowano gracza');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleReject = async (participantId: string) => {
    setBusy(true);
    try {
      await rejectParticipant(participantId);
      await load();
      toast('Odrzucono prośbę');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleAddGuest = async () => {
    if (!guestName.trim()) return;
    setBusy(true);
    try {
      const { isReserve: onReserve } = await addGuest(event.id, guestName.trim(), false, user?.id ?? undefined, guestIsGk);
      setGuestName('');
      setGuestIsGk(false);
      await load();
      toast(onReserve ? 'Komplet — gość dodany na rezerwę' : 'Gość dodany');
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

  /** Organizer removing someone else — always confirmed, so a misplaced tap in
   *  a dense list never silently kicks a player. Self-leave has its own
   *  confirm dialog already and calls handleRemove directly. */
  const handleRemovePlayer = (p: EventParticipant) => {
    if (!confirm(`Usunąć ${p.name} ze składu?`)) return;
    handleRemove(p.id);
  };

  const handleTogglePayment = async (p: EventParticipant) => {
    if (!isOrganizer) return;
    setBusy(true);
    try {
      // Use the discounted amount when the player holds a sports card and the
      // organizer specified a fixed discount — otherwise fall back to full price.
      const owed = priceForParticipant(event.costGrosze, event.sportsCardDiscountGrosze, p.hasSportsCard).priceGrosze;
      await updateParticipantPayment(p.id, !p.hasPaid, !p.hasPaid ? owed : 0);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  /** Explicit set from a dropdown of named options — no ambiguity about what
   *  will change (unlike the old click-to-cycle pill). */
  const handleSetStatus = async (p: EventParticipant, status: ParticipantStatus) => {
    if (!isOrganizer || status === p.status) return;
    setBusy(true);
    try { await updateParticipantStatus(p.id, status); await load(); }
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

  const handleEnableTeams = async () => {
    setBusy(true);
    try { await saveEventAdvancedSettings(event.id, { teamMode: 'reczne' }); await load(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); }
    finally { setBusy(false); }
  };

  const handleDisableTeams = async () => {
    setBusy(true);
    try {
      await clearTeamsDb(event.id);
      await saveEventAdvancedSettings(event.id, { teamMode: 'brak' });
      await load();
    }
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
      const newId = await repeatEvent(event, repeatDate, repeatTime, user.id, displayName(user), repeatJoin);
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
            {event.coverImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={event.coverImageUrl} alt="" className="h-full w-full object-cover" />
            ) : venueThumbnail(event.lat, event.lng, 800, 400, 17) ? (
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
            {isOwner && (
              <div className="absolute bottom-3 right-3">
                <CoverUpload
                  currentUrl={event.coverImageUrl}
                  path={`events/${event.id}/cover`}
                  onSaved={async (url) => {
                    const { supabase } = await import('@/lib/supabase');
                    const { error } = await supabase
                      .from('events')
                      .update({ cover_image_url: url })
                      .eq('id', event.id);
                    if (!error) setEvent((e) => e ? { ...e, coverImageUrl: url ?? undefined } : e);
                  }}
                />
              </div>
            )}
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
          {event.description && (
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-400">
              {event.description}
            </p>
          )}
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
              // Only link to a venue page for real fields (have a fieldId).
              // Custom addresses have no venue page → linking would 404.
              const href = event.fieldId ? `/boisko/${event.fieldId}` : null;
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
            {/* group */}
            {groupInfo && (
              <Link
                href={`/grupy/${groupInfo.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 transition hover:bg-primary-100"
              >
                <Users className="h-3.5 w-3.5" strokeWidth={2.25} /> {groupInfo.name}
              </Link>
            )}
          </div>
          {/* Payment info — how to pay + sports-card discount, at a glance. Shown
              generally on the event page, not just at join time. */}
          {event.costGrosze > 0 && (event.acceptedPaymentMethods.length > 0 || event.acceptedSportsCards.length > 0) && (
            <p className="mt-2 text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5">
              {event.acceptedPaymentMethods.length > 0 && (
                <span>
                  Płatność: {event.acceptedPaymentMethods.map((m) => PAYMENT_METHOD_LABELS[m]).join(', ')}
                  {event.acceptedPaymentMethods.includes('blik') && event.blikPhone && (
                    <> — BLIK na numer <span className="font-semibold text-ink">{event.blikPhone}</span></>
                  )}
                </span>
              )}
              {event.acceptedSportsCards.length > 0 && (
                <span>
                  {event.acceptedPaymentMethods.length > 0 && '· '}
                  Karty sportowe: {event.acceptedSportsCards.map((c) => sportsCardLabel(c, event.sportsCardOtherName)).join(', ')}
                  {event.sportsCardDiscountGrosze != null && ` (−${(event.sportsCardDiscountGrosze / 100).toFixed(0)} zł)`}
                </span>
              )}
            </p>
          )}
        </div>

        {/* ── PROŚBY O DOŁĄCZENIE — tylko organizator, gdy są oczekujące ── */}
        {/* Shown whenever the organizer requires approval — even with zero
            pending requests — so it's clear the feature is there and working,
            rather than the whole card vanishing (which read as "broken/missing"). */}
        {isOwner && event.requireApproval && (
          <div className="px-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-semibold text-amber-800">
                  Prośby o dołączenie
                  {pendingRequests.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-amber-200 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">{pendingRequests.length}</span>
                  )}
                </p>
              </div>
              {pendingRequests.length === 0 && (
                <p className="text-sm text-amber-700/80">Na razie nikt nie czeka na akceptację.</p>
              )}
              <ul className="space-y-2">
                {pendingRequests.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 border border-amber-100">
                    {p.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                        <UserPlus className="w-4 h-4" />
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-ink truncate">{p.name}</span>
                      {p.isGoalkeeper && <span className="text-[11px] text-slate-500">Bramkarz 🧤</span>}
                    </span>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleApprove(p.id)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-800 active:scale-95 transition disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" /> Akceptuj
                      </button>
                      <button
                        onClick={() => handleReject(p.id)}
                        disabled={busy}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-95 transition disabled:opacity-50"
                        title="Odrzuć"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

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

            {/* Avatar stack — tap to expand. Hidden when roster is open. */}
            {regulars.length > 0 && !rosterOpen && (
              <button
                type="button"
                onClick={() => setRosterOpen(true)}
                className="mt-5 flex w-full items-center justify-center gap-2"
              >
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
                  {regulars.length > 8 && (
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 ring-2 ring-white"
                      style={{ marginLeft: -8 }}
                    >
                      +{regulars.length - 8}
                    </div>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
            )}
            {regulars.length === 0 && (
              <p className="mt-5 text-center text-sm text-slate-400">Nikt jeszcze nie dołączył — bądź pierwszy!</p>
            )}

            {/* Roster — replaces avatar row when open */}
            {regulars.length > 0 && rosterOpen && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {regulars.length} {regulars.length === 1 ? 'gracz' : regulars.length < 5 ? 'gracze' : 'graczy'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRosterOpen(false)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <ChevronDown className="h-3.5 w-3.5 rotate-180" /> Zwiń
                  </button>
                </div>
                <ParticipantsList
                  regulars={regulars}
                  reserves={reserves}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── BOISKO CARD ── */}
        {(eventLoc.primary || (event.lat && event.lng)) && (() => {
          // Real venues (with a fieldId) link to their page; custom addresses
          // have no page, so we render a plain non-clickable card (no 404).
          const venueHref = event.fieldId ? `/boisko/${event.fieldId}` : null;
          return (
            <div className="px-4">
              <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Boisko</p>
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
              <div className="mb-3">
                <div className="flex gap-2">
                  <input
                    type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
                    placeholder="Dopisz znajomego bez konta…"
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <Button variant="outline" onClick={handleAddGuest} disabled={busy || !guestName.trim()} className="shrink-0">
                    <UserPlus className="w-4 h-4" /> Dopisz
                  </Button>
                </div>
                {gkEnabled && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 select-none cursor-pointer">
                    <input type="checkbox" checked={guestIsGk} onChange={(e) => setGuestIsGk(e.target.checked)} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                    🧤 Dodaj jako bramkarza
                  </label>
                )}
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

        {/* ── OCZEKUJESZ NA AKCEPTACJĘ — gdy wysłałeś prośbę o dołączenie ── */}
        {user && myPendingRequest && !eventStarted && (
          <div className="px-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800">Oczekujesz na akceptację</p>
                  <p className="text-xs text-amber-600">Organizator musi zatwierdzić Twoją prośbę o dołączenie.</p>
                </div>
                <button
                  onClick={() => handleReject(myPendingRequest.id)}
                  disabled={busy}
                  className="shrink-0 rounded-xl border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── OBSERVING BANNER — RSVP "maybe": watching, not signed up ── */}
        {user && myMaybe && !eventStarted && (
          <div className="px-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Obserwujesz ten mecz</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">Nie masz zajętego miejsca — dołącz, gdy będziesz pewny.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleConfirmMaybe}
                  disabled={busy}
                  className="rounded-xl bg-primary-700 px-3 py-2 text-xs font-bold text-white hover:bg-primary-800 transition disabled:opacity-50"
                >
                  Dołącz
                </button>
                <button
                  onClick={() => { setLeaveConfirmOpen(true); }}
                  disabled={busy}
                  className="rounded-xl border border-amber-200 dark:border-amber-700 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition"
                >
                  Przestań obserwować
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STICKY JOIN BAR — tylko gdy nie jesteś zapisany i mecz się nie zaczął ── */}
        {!(user && (myParticipation || myPendingRequest || myMaybe)) && !eventStarted && (
          <div className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-100 dark:border-slate-700 bg-canvas/90 px-4 pb-6 pt-3 backdrop-blur-md">
            <div className="mx-auto max-w-2xl">
              {!authLoading && !user ? (
                <button
                  onClick={() => { window.location.href = `/logowanie?next=${encodeURIComponent(window.location.pathname + window.location.search)}`; }}
                  className="flex h-12 w-full items-center justify-center rounded-2xl bg-accent-500 text-[15px] font-bold text-primary-950 transition active:scale-[0.99]"
                >
                  Zaloguj się, aby dołączyć
                </button>
              ) : user && !isFull ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setJoinRole('player'); setJoinAsReserve(false); setJoinDialogOpen(true); }}
                    className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-accent-500 text-[15px] font-bold text-primary-950 transition active:scale-[0.99]"
                  >
                    Dołącz →
                  </button>
                  <button
                    onClick={handleMaybe}
                    disabled={busy}
                    className="flex h-12 items-center justify-center rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-5 text-[14px] font-semibold text-slate-600 dark:text-slate-300 transition active:scale-[0.99] disabled:opacity-50"
                  >
                    Obserwuj
                  </button>
                </div>
              ) : user && isFull ? (
                <>
                  <button
                    onClick={() => { setJoinRole('player'); setJoinAsReserve(true); setJoinDialogOpen(true); }}
                    className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-200 dark:bg-slate-700 text-[15px] font-bold text-slate-600 dark:text-slate-300 transition active:scale-[0.99]"
                  >
                    Komplet — zapisz się na rezerwę
                  </button>
                  <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">Zostaniesz powiadomiony jeśli zwolni się miejsce</p>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* ── MECZ JUŻ TRWA / PO MECZU — komunikat zamiast przycisku dołączania ── */}
        {!(user && myParticipation) && eventStarted && (
          <div className="px-4">
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3.5 text-sm font-medium text-slate-500 dark:text-slate-400">
              <Clock className="w-4 h-4 shrink-0" />
              {event.status === 'cancelled'
                ? 'Mecz został odwołany'
                : resultsAvailable
                  ? 'Mecz już się odbył — zapisy zamknięte'
                  : 'Mecz już się rozpoczął — zapisy zamknięte'}
            </div>
          </div>
        )}

        {/* ── SKŁAD (organizer only) — kto gra, bez kontrolek zarządzania ── */}
        {isOwner && !eventStarted && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" /> Skład
            </h2>
            <span className={[
              'text-sm font-medium px-2.5 py-1 rounded-full',
              isFull ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700',
            ].join(' ')}>
              {takenSpots} / {event.maxPlayers}
            </span>
          </div>

          <ul className="divide-y divide-slate-100">
            {regulars.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-2.5">
                {/* Avatar */}
                {p.avatarUrl
                  ? <img src={p.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                  : <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold shrink-0">{p.name.charAt(0).toUpperCase()}</span>
                }

                {/* Name + attribution */}
                <div className="flex-1 min-w-0">
                  <span className="flex items-center gap-1 text-sm text-ink overflow-hidden">
                    {p.userId && !p.isGuest ? (
                      <Link href={`/gracz/${p.userId}`} className="truncate min-w-0 max-w-[140px] sm:max-w-[220px] hover:text-primary-700 hover:underline">
                        {p.name}
                      </Link>
                    ) : (
                      <span className="truncate min-w-0 max-w-[140px] sm:max-w-[220px]">{p.name}</span>
                    )}
                    {p.isGuest && (
                      <span
                        title="Gość bez konta — dopisany ręcznie"
                        className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 shrink-0"
                      >
                        gość
                      </span>
                    )}
                    {gkEnabled && p.isGoalkeeper && (
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
                  {/* "Brought by" line — who added this guest (visible to everyone) */}
                  {p.isGuest && p.addedBy && (() => {
                    const adderName = participants.find((x) => x.userId === p.addedBy)?.name
                      ?? (p.addedBy === event.organizerId ? event.organizerName : undefined)
                      ?? 'innego gracza';
                    return (
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-200 text-[8px] font-bold text-slate-600 shrink-0">
                          {adderName.charAt(0).toUpperCase()}
                        </span>
                        dodał(a): <span className="font-medium text-slate-500 truncate">{adderName}</span>
                      </span>
                    );
                  })()}
                </div>
              </li>
            ))}
            {regulars.length === 0 && (
              <li className="py-4 text-sm text-slate-400 text-center">Nikt jeszcze nie dołączył</li>
            )}
          </ul>

          {/* Add guest — dopisuje osobę bez konta wprost do składu (to NIE wysyła zaproszenia) */}
          {isOrganizer && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-600 mb-1.5">Dopisz osobę bez konta</p>
              <div className="flex gap-2">
                <input
                  type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
                  placeholder="Imię znajomego"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <Button variant="outline" onClick={handleAddGuest} disabled={busy || !guestName.trim()}>
                  <UserPlus className="w-4 h-4" /> Dopisz do składu
                </Button>
              </div>
              {gkEnabled && (
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 select-none cursor-pointer">
                  <input type="checkbox" checked={guestIsGk} onChange={(e) => setGuestIsGk(e.target.checked)} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                  🧤 Dodaj jako bramkarza
                </label>
              )}
              <p className="mt-2 text-[11px] text-slate-400">
                Dopisujesz gracza ręcznie. Aby ktoś dołączył sam — użyj „Zaproś / wyślij link" niżej.
              </p>
            </div>
          )}
        </div>
        )}

        {/* ── POTWIERDZENIA (organizer only) — osobno od reszty, bo klik-cykl na
            pillu nie byl czytelny jako kontrolka. Select = jawny wybor. ── */}
        {isOwner && !eventStarted && showStatus && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h2 className="font-semibold text-ink flex items-center gap-2 mb-3">
              <Check className="w-4 h-4 text-slate-400" /> Potwierdzenia
            </h2>
            <ul className="divide-y divide-slate-100">
              {regulars.map((p) => (
                <li key={p.id} className="flex items-center gap-2 py-2.5">
                  {p.avatarUrl
                    ? <img src={p.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    : <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold shrink-0">{p.name.charAt(0).toUpperCase()}</span>
                  }
                  <span className="flex-1 min-w-0 text-sm text-ink truncate">{p.name}</span>
                  {event.requireSmsConfirmation && p.phone && (
                    <button
                      onClick={() => handleSendSms(p)}
                      disabled={smsBusy === p.id}
                      className="p-1.5 text-slate-400 hover:text-blue-500 rounded shrink-0"
                      title="Wyślij SMS z potwierdzeniem"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  )}
                  <select
                    value={p.status}
                    onChange={(e) => handleSetStatus(p, e.target.value as ParticipantStatus)}
                    disabled={busy}
                    className={`text-xs font-medium rounded-lg border px-2 py-1.5 shrink-0 ${STATUS_CLS[p.status]} border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500`}
                  >
                    {(Object.keys(STATUS_LABELS) as ParticipantStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </li>
              ))}
              {regulars.length === 0 && (
                <li className="py-4 text-sm text-slate-400 text-center">Nikt jeszcze nie dołączył</li>
              )}
            </ul>
          </div>
        )}

        {/* ── ZARZĄDZANIE GRACZAMI (organizer only) — usuwanie, celowo osobno
            od reszty i zawsze z potwierdzeniem, zeby nic nie znikneło przez
            przypadkowe klikniecie w gestej liscie. ── */}
        {isOwner && !eventStarted && regulars.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h2 className="font-semibold text-ink flex items-center gap-2 mb-1">
              <Trash2 className="w-4 h-4 text-slate-400" /> Zarządzanie graczami
            </h2>
            <p className="text-xs text-slate-500 mb-3">Usuwanie zawsze wymaga potwierdzenia.</p>
            <ul className="divide-y divide-slate-100">
              {regulars.filter((p) => p.userId !== event.organizerId).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  {p.avatarUrl
                    ? <img src={p.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    : <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold shrink-0">{p.name.charAt(0).toUpperCase()}</span>
                  }
                  <span className="flex-1 min-w-0 text-sm text-ink truncate">{p.name}</span>
                  <button
                    onClick={() => handleRemovePlayer(p)}
                    disabled={busy}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Usuń
                  </button>
                </li>
              ))}
              {regulars.filter((p) => p.userId !== event.organizerId).length === 0 && (
                <li className="py-4 text-sm text-slate-400 text-center">Nikt poza Tobą jeszcze nie dołączył</li>
              )}
            </ul>
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
                  {p.userId === user?.id ? (
                    <button onClick={() => handleRemove(p.id)} disabled={busy} className="p-1.5 text-slate-400 hover:text-red-500 rounded" title="Zrezygnuj z rezerwy">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : isOrganizer && (
                    <button onClick={() => handleRemovePlayer(p)} disabled={busy} className="p-1.5 text-slate-400 hover:text-red-500 rounded" title="Usuń z rezerwy">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Published teams — visible to all participants (separate from roster) */}
        {showTeams && event.teamsPublished && !isOwner && (
          <div className="px-4">
            <PublishedTeamsCard teamA={teamA} teamB={teamB} unassigned={unassigned} />
          </div>
        )}

        {/* Quick enable teams for organizer */}
        {!showTeams && isOwner && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Podział na drużyny</p>
              <p className="text-xs text-slate-500 mt-0.5">Niebiescy vs Czerwoni — przypisz graczy ręcznie lub losuj</p>
            </div>
            <button
              onClick={handleEnableTeams}
              disabled={busy}
              className="shrink-0 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-800 active:scale-95 disabled:opacity-60"
            >
              Utwórz skład
            </button>
          </div>
        )}

        {/* DB-persisted teams (when teamMode !== 'brak') — organizer manages privately, visible to all after publishing */}
        {showTeams && isOwner && (
          <TeamsPanel
            teamMode={event.teamMode}
            teamA={teamA}
            teamB={teamB}
            unassigned={unassigned}
            isOrganizer={isOwner}
            teamsPublished={event.teamsPublished}
            busy={busy}
            onAssignTeam={handleAssignTeam}
            onAssignRandom={handleAssignRandom}
            onClearTeams={handleClearTeams}
            onToggleCaptain={handleToggleCaptain}
            onPublishTeams={handlePublishTeams}
            onUnpublishTeams={handleUnpublishTeams}
            onDisableTeams={handleDisableTeams}
          />
        )}

        {/* Pre-match "result coming" note — only the organizer enters results */}
        {isOwner && event.trackResults && !resultsAvailable && (
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


        {/* Cost split summary — same automatic rule as the per-participant toggle */}
        {event.costGrosze > 0 && isOwner && !eventStarted && (
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
            {(() => {
              // Sports-card discounts mean not everyone owes the same amount.
              const owed = (p: EventParticipant) =>
                priceForParticipant(event.costGrosze, event.sportsCardDiscountGrosze, p.hasSportsCard).priceGrosze;
              const collected = regulars.filter((p) => p.hasPaid).reduce((sum, p) => sum + owed(p), 0);
              const expected = regulars.reduce((sum, p) => sum + owed(p), 0);
              return (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Zebrano</span>
                  <span className="font-semibold text-ink">
                    {(collected / 100).toFixed(2)} PLN
                    {' '}<span className="text-slate-400 font-normal">z {(expected / 100).toFixed(2)} PLN</span>
                  </span>
                </div>
              );
            })()}
            {/* Per-participant toggle — a real switch, not a colored pill, so
                it's unmistakable that clicking it changes something. */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <ul className="divide-y divide-slate-100">
                {regulars.map((p) => {
                  const price = priceForParticipant(event.costGrosze, event.sportsCardDiscountGrosze, p.hasSportsCard);
                  return (
                    <li key={p.id} className="flex items-center gap-2.5 py-2.5">
                      {p.avatarUrl
                        ? <img src={p.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                        : <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold shrink-0">{p.name.charAt(0).toUpperCase()}</span>
                      }
                      <div className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5 text-sm text-ink">
                          <span className="truncate">{p.name}</span>
                          {p.hasSportsCard && (
                            <span title={p.sportsCardProvider ? sportsCardLabel(p.sportsCardProvider, event.sportsCardOtherName) : 'Karta sportowa'} className="text-xs shrink-0">💳</span>
                          )}
                        </span>
                        <span className="text-xs text-slate-400">
                          {price.discountUnspecified
                            ? 'Zniżka z karty — ustal kwotę'
                            : `${(price.priceGrosze / 100).toFixed(2)} PLN`}
                          {p.paymentMethod && <> · {PAYMENT_METHOD_LABELS[p.paymentMethod]}</>}
                        </span>
                      </div>
                      <Switch
                        checked={p.hasPaid}
                        onChange={() => handleTogglePayment(p)}
                        disabled={busy}
                        label={p.hasPaid ? `Oznacz ${p.name} jako nieopłacone` : `Oznacz ${p.name} jako opłacone`}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Comments — only for participants */}
        {myParticipation && <EventComments eventId={event.id} />}

        {/* Organizer controls — hidden until "Edytuj" so they don't clutter the
            page or invite accidental clicks on cancel/delete. */}
        {isOwner && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-3">
            <button
              onClick={() => setEditMode((o) => !o)}
              className="w-full flex items-center gap-2"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-ink text-sm">Zarządzaj wydarzeniem</h2>
              <span className="ml-auto flex items-center gap-2 text-xs font-medium text-primary-600">
                {!editMode && event.visibility !== 'public' && (
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
                {!eventStarted && (!isCancelled ? (
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
                ))}
                <button
                  onClick={() => setDeleteConfirmOpen(true)} disabled={busy}
                  className="w-full flex items-center gap-2 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Usuń na stałe
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Zaproś znajomych — tylko dla uczestników ── */}
        {event.joinCode && !isCancelled && (myParticipation || isOwner) && (
          <div className="px-4">
            <JoinCodePanel joinCode={event.joinCode} eventId={event.id} />
          </div>
        )}

        {/* ── Organizator (zawsze na dole, widoczne dla wszystkich) ── */}
        {(() => {
          const organizerParticipant = participants.find((p) => p.userId && p.userId === event.organizerId);
          const organizerAvatar = organizerParticipant?.avatarUrl;
          const organizerLabel = event.organizerName || organizerParticipant?.name || 'Organizator';
          const inner = (
            <>
              {organizerAvatar ? (
                <img src={organizerAvatar} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-950 text-sm font-bold text-primary-700">
                  {initials(organizerLabel)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Organizator</p>
                <p className="font-semibold text-ink truncate">{organizerLabel}</p>
              </div>
              {event.organizerId && <ChevronRight className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" />}
            </>
          );
          return (
            <div className="px-4">
              {event.organizerId ? (
                <Link
                  href={`/gracz/${event.organizerId}`}
                  className="flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm border border-slate-100 dark:border-slate-700 hover:border-primary-200 dark:hover:border-primary-800 transition-colors"
                >
                  {inner}
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                  {inner}
                </div>
              )}
            </div>
          );
        })()}
      </main>

      {/* Leave confirmation */}
      {leaveConfirmOpen && myEntry && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setLeaveConfirmOpen(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-1">
              {myMaybe ? 'Przestać obserwować?' : 'Wypisać się z meczu?'}
            </h3>
            <p className="text-sm text-slate-500 mb-5">
              {myMaybe
                ? 'Mecz zniknie z Twoich meczów. Możesz zacząć obserwować ponownie.'
                : 'Twoje miejsce zwolni się i może je zająć ktoś z listy rezerwowej.'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLeaveConfirmOpen(false)} className="flex-1">
                Zostań
              </Button>
              <Button
                onClick={() => { setLeaveConfirmOpen(false); handleRemove(myEntry.id); }}
                isLoading={busy}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {myMaybe ? 'Przestań obserwować' : 'Wypisz mnie'}
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

            {/* Role chooser — only when the event distinguishes goalkeepers */}
            {gkEnabled && (
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
                {joinRole === 'goalkeeper' && gkFull && !joinAsReserve && (
                  <p className="mt-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Jest już {gkCount} bramkarzy — dołączysz jako rezerwa.
                  </p>
                )}
              </div>
            )}

            {/* Sports card — only when the event actually offers a discount for one */}
            {event.costGrosze > 0 && event.acceptedSportsCards.length > 0 && (
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm text-ink select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={joinHasSportsCard}
                    onChange={(e) => {
                      setJoinHasSportsCard(e.target.checked);
                      // Auto-pick when there's only one accepted card — nothing to choose.
                      setJoinSportsCardProvider(
                        e.target.checked && event.acceptedSportsCards.length === 1
                          ? event.acceptedSportsCards[0]
                          : undefined,
                      );
                    }}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  Mam kartę sportową
                </label>
                <p className="mt-1 ml-6 text-xs text-slate-500">
                  Akceptowane: {event.acceptedSportsCards.map((c) => sportsCardLabel(c, event.sportsCardOtherName)).join(', ')}
                </p>
                {joinHasSportsCard && event.acceptedSportsCards.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {event.acceptedSportsCards.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setJoinSportsCardProvider(c)}
                        className={[
                          'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                          joinSportsCardProvider === c
                            ? 'border-primary-600 bg-primary-50 text-primary-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300',
                        ].join(' ')}
                      >
                        {sportsCardLabel(c, event.sportsCardOtherName)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Payment method — how you'll settle up with the organizer */}
            {event.costGrosze > 0 && event.acceptedPaymentMethods.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Jak zapłacisz?</p>
                <div className="flex flex-wrap gap-2">
                  {event.acceptedPaymentMethods.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setJoinPaymentMethod(m)}
                      className={[
                        'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                        joinPaymentMethod === m
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300',
                      ].join(' ')}
                    >
                      {PAYMENT_METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>
                {joinPaymentMethod === 'blik' && event.blikPhone && (
                  <p className="mt-2 text-xs text-slate-500">
                    BLIK na numer: <span className="font-semibold text-ink">{event.blikPhone}</span>
                  </p>
                )}
              </div>
            )}

            {/* Cost */}
            {(() => {
              const price = priceForParticipant(event.costGrosze, event.sportsCardDiscountGrosze, joinHasSportsCard);
              return (
                <div className="rounded-xl bg-slate-50 px-4 py-3 mb-5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Koszt</span>
                    {price.discountApplied ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-400 line-through">{costPln} zł</span>
                        <span className="font-semibold text-green-700">{(price.priceGrosze / 100).toFixed(2)} zł</span>
                      </span>
                    ) : (
                      <span className="font-semibold text-ink">{costPln ? `${costPln} zł` : 'Za darmo'}</span>
                    )}
                  </div>
                  {price.discountUnspecified && (
                    <p className="mt-1.5 text-xs text-amber-700">
                      Karta sportowa daje zniżkę — o dokładną kwotę zapytaj organizatora.
                    </p>
                  )}
                </div>
              );
            })()}

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
                <TimeSelect value={repeatTime} onChange={setRepeatTime} />
              </div>
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-sm font-medium text-slate-900">Biorę udział</p>
                  <p className="text-xs text-slate-500">Zapisz mnie jako uczestnika kopii</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRepeatJoin((v) => !v)}
                  className={['relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors', repeatJoin ? 'bg-primary-600' : 'bg-slate-200'].join(' ')}
                  role="switch"
                  aria-checked={repeatJoin}
                >
                  <span className={['pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', repeatJoin ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
                </button>
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

      {/* Delete confirmation modal */}
      {deleteConfirmOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setDeleteConfirmOpen(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-1">Usunąć wydarzenie?</h3>
            <p className="text-sm text-slate-500 mb-5">Tej operacji nie można cofnąć. Wszyscy uczestnicy stracą dostęp do meczu.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="flex-1">
                Anuluj
              </Button>
              <Button
                onClick={() => { setDeleteConfirmOpen(false); handleDelete(); }}
                isLoading={busy}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Usuń na stałe
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
