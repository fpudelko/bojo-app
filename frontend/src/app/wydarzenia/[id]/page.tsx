'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Calendar, Clock, MapPin, Users, UserPlus, Trash2, Lock, Globe, Share2,
  Check, X, Pencil, Banknote, Shuffle, Phone, Trophy, MessageSquare, Star,
  BanIcon, RotateCcw, AlertTriangle, Copy, ArrowRight,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import MatchResultForm from '@/components/events/MatchResultForm';
import TeamsPanel from '@/components/events/TeamsPanel';
import RemindersSection from '@/components/events/RemindersSection';
import EventComments from '@/components/events/EventComments';
import { useAuth, displayName } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { useToast } from '@/lib/toast';
import { venueThumbnail } from '@/lib/labels';
import {
  getEvent, joinEvent, addGuest, removeParticipant, setVisibility, deleteEvent,
  cancelEvent, restoreEvent, repeatEvent,
} from '@/lib/events';
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

const TEAM_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
];

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
  brak_odpowiedzi: 'bg-gray-100 text-gray-500',
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function splitTeams(players: EventParticipant[]): [EventParticipant[], EventParticipant[]] {
  const s = shuffle(players);
  const mid = Math.ceil(s.length / 2);
  return [s.slice(0, mid), s.slice(mid)];
}

function SpotsBadge({ regulars, max }: { regulars: number; max: number }) {
  const left = max - regulars;
  if (left <= 0) return <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-red-100 text-red-700">Pełne</span>;
  if (left <= 3) return <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-700">Brakuje {left}</span>;
  return <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-green-100 text-green-700">Wolne</span>;
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
  // Legacy client-side teams (teamMode === 'brak' only)
  const [localTeams, setLocalTeams] = useState<[EventParticipant[], EventParticipant[]] | null>(null);
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
          <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        </main>
      </div>
    );
  }
  if (notFound || !event) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center text-gray-500">
          <div>
            <X className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Nie znaleziono wydarzenia</p>
          </div>
        </main>
      </div>
    );
  }

  const isOrganizer = !!user && (user.id === event.organizerId || isAdmin);
  const regulars = participants.filter((p) => !p.isReserve);
  const reserves = participants.filter((p) => p.isReserve);
  const myParticipation = participants.find((p) => p.userId && p.userId === user?.id);
  const externalCount = event.externalCount ?? 0;
  const takenSpots = regulars.length + externalCount;
  const isFull = takenSpots >= event.maxPlayers;
  const showStatus = event.trackAttendance || event.requireSmsConfirmation;
  const showTeams = event.teamMode !== 'brak';
  const costPln = event.costGrosze > 0 ? (event.costGrosze / 100).toFixed(2) : null;
  const goalsMap: Record<string, number> = {};
  for (const g of playerGoals) goalsMap[g.participantId] = g.goals;
  const teamA = regulars.filter((p) => p.team === 'A');
  const teamB = regulars.filter((p) => p.team === 'B');
  const unassigned = regulars.filter((p) => !p.team);

  let dateStr = event.date;
  try { dateStr = format(parseISO(event.date), 'EEEE, d MMMM yyyy', { locale: pl }); } catch {}

  // Handlers
  const handleJoin = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await joinEvent(event.id, user.id, displayName(user));
      await load();
      toast('Dołączyłeś do gry!');
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
      setLocalTeams(null);
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

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-4">

        {/* Cancelled banner */}
        {isCancelled && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">Mecz odwołany</p>
              <p className="text-xs text-red-500">Ten mecz został odwołany przez organizatora.</p>
            </div>
            {isOrganizer && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestore}
                disabled={busy}
                className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Przywróć
              </Button>
            )}
          </div>
        )}

        {/* Header card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {venueThumbnail(event.lat, event.lng, 800, 400, 17) ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={venueThumbnail(event.lat, event.lng, 800, 400, 17)!} alt={event.fieldName} className="w-full h-52 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <div className="absolute top-3 right-3">
                <SpotsBadge regulars={takenSpots} max={event.maxPlayers} />
              </div>
            </div>
          ) : (
            <div className="h-24 bg-gradient-to-br from-primary-700 to-primary-900 flex items-center justify-center">
              <span className="text-5xl opacity-70">{sportEmoji(event.sport)}</span>
            </div>
          )}
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-ink leading-tight">{event.title || event.sport}</h1>
                <p className="text-sm text-slate-500 capitalize mt-0.5">{event.sport}</p>
              </div>
              {!venueThumbnail(event.lat, event.lng, 1, 1) && (
                <SpotsBadge regulars={takenSpots} max={event.maxPlayers} />
              )}
            </div>

            {/* Info chips */}
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="capitalize">{dateStr}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {event.time?.slice(0, 5)}{event.endTime && `–${event.endTime.slice(0, 5)}`}
              </span>
              {event.costGrosze > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
                  <Banknote className="w-3.5 h-3.5" />
                  {(event.costGrosze / 100).toFixed(0)} PLN / os.
                </span>
              )}
              {event.costGrosze === 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-xs font-medium text-green-700">
                  Bez opłaty
                </span>
              )}
              <span className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border',
                event.visibility === 'public'
                  ? 'bg-primary-50 border-primary-200 text-primary-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600',
              ].join(' ')}>
                {event.visibility === 'public'
                  ? <><Globe className="w-3.5 h-3.5" /> Publiczne</>
                  : <><Lock className="w-3.5 h-3.5" /> Prywatne</>}
              </span>
            </div>

            <div className="mt-4 text-sm">
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-ink">{event.fieldName}</span>
                  {(event.fieldAddress || event.customAddress || event.customLocationName) && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {event.fieldAddress || event.customAddress || event.customLocationName}
                    </p>
                  )}
                  {event.fieldId && (
                    <Link href={`/boisko/${event.fieldId}`} className="text-xs text-primary-600 hover:underline mt-0.5 inline-block">
                      Szczegóły obiektu →
                    </Link>
                  )}
                </div>
                {event.lat && event.lng && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-primary-600 hover:text-primary-700 font-medium ml-1 whitespace-nowrap"
                  >
                    Nawiguj →
                  </a>
                )}
              </div>
            </div>

            {event.description && (
              <p className="mt-4 text-sm text-slate-600 bg-slate-50 rounded-xl p-3 leading-relaxed">
                {event.description}
              </p>
            )}

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-slate-400">Organizator: {event.organizerName}</p>
              {isOrganizer && (
                <Link href={`/wydarzenia/${event.id}/edytuj`} className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium">
                  <Pencil className="w-3.5 h-3.5" /> Edytuj
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Participants */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" /> Uczestnicy
            </h2>
            <span className={[
              'text-sm font-medium px-2.5 py-1 rounded-full',
              isFull ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700',
            ].join(' ')}>
              {takenSpots} / {event.maxPlayers}
            </span>
          </div>

          {externalCount > 0 && (
            <p className="-mt-2 mb-3 text-xs text-gray-500">
              W tym <span className="font-medium text-gray-700">{externalCount}</span>{' '}
              {externalCount === 1 ? 'gracz' : externalCount < 5 ? 'graczy' : 'graczy'} spoza aplikacji.
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
                  <span className="flex-1 flex items-center gap-1.5 text-sm text-ink min-w-0">
                    <span className="truncate max-w-[120px]">{p.name}</span>
                    {p.isGuest && (
                      <span className="text-xs text-gray-400 shrink-0">
                        (gość{isOrganizer && p.addedBy && p.addedBy !== user?.id
                          ? ` · dodany przez: ${
                              participants.find((x) => x.userId === p.addedBy)?.name ?? 'innego użytkownika'
                            }`
                          : ''})
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
                        className="p-1.5 text-gray-400 hover:text-blue-500 rounded"
                        title="Wyślij SMS z potwierdzeniem"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    )}

                    {/* Payment (trackPayments on) */}
                    {event.trackPayments && (isOrganizer || event.showPaymentStatus) && (
                      <button
                        onClick={() => handleTogglePayment(p)}
                        disabled={busy || !isOrganizer}
                        title={p.hasPaid ? 'Opłacone' : 'Nieopłacone'}
                        className={[
                          'p-1.5 rounded transition-colors',
                          p.hasPaid ? 'text-green-600 hover:text-green-700' : 'text-gray-300 hover:text-gray-500',
                          !isOrganizer ? 'cursor-default' : '',
                        ].join(' ')}
                      >
                        <Banknote className="w-4 h-4" />
                      </button>
                    )}

                    {/* Report button (for other logged-in participants) */}
                    {user && !isOrganizer && p.userId !== user.id && (
                      <button
                        onClick={() => setReportTarget(p)}
                        className="p-1.5 text-gray-200 hover:text-red-400 rounded"
                        title="Zgłoś uczestnika"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    )}

                    {/* Remove */}
                    {(isOrganizer || p.userId === user?.id) && p.userId !== event.organizerId && (
                      <button
                        onClick={() => handleRemove(p.id)} disabled={busy}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded"
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
              <li className="py-4 text-sm text-gray-400 text-center">Nikt jeszcze nie dołączył</li>
            )}
          </ul>

          {/* Add guest */}
          {isOrganizer && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              <input
                type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
                placeholder="Imię znajomego (bez konta)"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Button variant="outline" onClick={handleAddGuest} disabled={busy || !guestName.trim()}>
                <UserPlus className="w-4 h-4" /> Dodaj
              </Button>
            </div>
          )}
        </div>

        {/* Reserve list */}
        {reserves.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-ink flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-gray-400" />
              Lista rezerwowa
              <span className="text-xs font-normal text-gray-400 ml-1">{reserves.length} os.</span>
            </h2>
            <ul className="divide-y divide-slate-100">
              {reserves.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-medium shrink-0">{i + 1}</span>
                    <span className="truncate max-w-[160px]">{p.name}</span>
                    {p.isGuest && <span className="text-xs text-gray-400 shrink-0">(gość)</span>}
                  </span>
                  {(isOrganizer || p.userId === user?.id) && (
                    <button onClick={() => handleRemove(p.id)} disabled={busy} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
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

        {/* Quick shuffle (teamMode === 'brak') — organizer only, client-side */}
        {!showTeams && isOrganizer && regulars.length >= 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ink flex items-center gap-2">
                <Shuffle className="w-4 h-4" /> Losuj składy
                <span className="text-xs font-normal text-gray-400">tylko dla Ciebie</span>
              </h2>
              <Button variant="outline" onClick={() => setLocalTeams(splitTeams(regulars))} disabled={busy}>
                {localTeams ? 'Losuj ponownie' : 'Losuj składy'}
              </Button>
            </div>
            {localTeams ? (
              <div className="grid grid-cols-2 gap-3">
                {localTeams.map((team, ti) => {
                  const c = TEAM_COLORS[ti];
                  return (
                    <div key={ti} className={`rounded-xl border p-3 ${c.bg} ${c.border}`}>
                      <p className={`text-xs font-bold mb-2 uppercase tracking-wide ${c.text}`}>Drużyna {ti + 1}</p>
                      <ul className="space-y-1">
                        {team.map((p) => (
                          <li key={p.id} className="flex items-center gap-1.5 text-sm text-gray-800">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                            {p.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-2">
                Kliknij przycisk, aby podzielić {regulars.length} graczy losowo.
              </p>
            )}
          </div>
        )}

        {/* Match results (trackResults) — locked until 30 min after event start */}
        {event.trackResults && !resultsAvailable && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-3 text-sm text-gray-400">
            <Trophy className="w-4 h-4 shrink-0" />
            Wynik można wpisać po rozpoczęciu meczu ({event.date} {event.time?.slice(0, 5)})
          </div>
        )}
        {event.trackResults && resultsAvailable && (
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

        {/* Join / status */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
          {user && !myParticipation && !isFull && (
            <Button
              onClick={handleJoin}
              isLoading={busy}
              size="lg"
              className="w-full bg-primary-700 hover:bg-primary-800 text-white font-bold rounded-xl shadow-md active:scale-[0.98] transition-all"
            >
              Dołącz do gry <ArrowRight className="w-4 h-4" />
            </Button>
          )}
          {user && !myParticipation && isFull && (
            <Button onClick={handleJoin} isLoading={busy} variant="outline" className="w-full" size="lg">Zapisz się na listę rezerwową</Button>
          )}
          {user && myParticipation && !myParticipation.isReserve && !isOrganizer && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-green-50 text-green-700 text-sm font-semibold py-3">
              <Check className="w-4 h-4" /> Jesteś zapisany
            </div>
          )}
          {user && myParticipation?.isReserve && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 text-amber-700 text-sm font-semibold py-3">
              <Users className="w-4 h-4" /> Jesteś na liście rezerwowej
            </div>
          )}
          {!authLoading && !user && (
            <Button onClick={() => { window.location.href = `/logowanie?next=${encodeURIComponent(window.location.pathname)}`; }} className="w-full" size="lg">
              Zaloguj się, aby dołączyć
            </Button>
          )}
        </div>

        {/* ZAPROSZENIE — skopiuj link i wklej gdzie chcesz (WhatsApp, Messenger, SMS…) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="font-semibold text-ink flex items-center gap-2 mb-1">
            <Share2 className="w-4 h-4" /> Zaproś
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            Skopiuj link i wklej go na grupie WhatsApp, Messengerze, SMS-ie — gdziekolwiek chcesz.
            Zaproszeni NIE muszą zakładać konta, żeby potwierdzić udział.
          </p>
          <Button onClick={handleShare} variant="outline" className="w-full">
            {copied ? <><Check className="w-4 h-4" /> Skopiowano link</> : <><Share2 className="w-4 h-4" /> Skopiuj link zaproszenia</>}
          </Button>
        </div>

        {/* POWIADOMIENIA — automatyczne przypomnienia dla zapisanych uczestników */}
        {isOrganizer && <RemindersSection eventId={event.id} />}

        {/* Cost split summary */}
        {event.trackPayments && event.costGrosze > 0 && isOrganizer && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-ink flex items-center gap-2 mb-4">
              <Banknote className="w-4 h-4" /> Podział kosztów
            </h2>
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-gray-500">Koszt / os.</span>
              <span className="font-semibold text-ink">{(event.costGrosze / 100).toFixed(2)} PLN</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-gray-500">Opłaconych</span>
              <span className="font-semibold text-green-700">
                {regulars.filter((p) => p.hasPaid).length} / {regulars.length}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Zebrano</span>
              <span className="font-semibold text-ink">
                {((regulars.filter((p) => p.hasPaid).length * event.costGrosze) / 100).toFixed(2)} PLN
                {' '}<span className="text-gray-400 font-normal">z {((regulars.length * event.costGrosze) / 100).toFixed(2)} PLN</span>
              </span>
            </div>
            {regulars.some((p) => !p.hasPaid) && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Czekamy na wpłatę od:</p>
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

        {/* Comments */}
        <EventComments eventId={event.id} />

        {/* Organizer controls */}
        {isOrganizer && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-3">
            <h2 className="font-semibold text-ink text-sm mb-2">Zarządzaj wydarzeniem</h2>
            <button
              onClick={handleToggleVisibility} disabled={busy}
              className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg px-3 py-2"
            >
              {event.visibility === 'public'
                ? <><Lock className="w-4 h-4" /> Ustaw jako prywatne</>
                : <><Globe className="w-4 h-4" /> Upublicznij (gdy brakuje ludzi)</>}
            </button>
            <button
              onClick={() => { setRepeatDate(''); setRepeatTime(event.time?.slice(0, 5) ?? ''); setRepeatOpen(true); }}
              disabled={busy}
              className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg px-3 py-2"
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
              className="w-full flex items-center gap-2 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" /> Usuń na stałe
            </button>
          </div>
        )}
      </main>

      {/* Repeat game dialog */}
      {repeatOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setRepeatOpen(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-1">Powtórz mecz</h3>
            <p className="text-sm text-gray-500 mb-4">
              Skopiuje wszystkie ustawienia do nowego wydarzenia. Wybierz nową datę i godzinę.
            </p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                <input
                  type="date"
                  value={repeatDate}
                  onChange={(e) => setRepeatDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Godzina</label>
                <input
                  type="time"
                  value={repeatTime}
                  onChange={(e) => setRepeatTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-1">Zgłoś uczestnika</h3>
            <p className="text-sm text-gray-500 mb-4">{reportTarget.name}</p>
            <div className="space-y-2 mb-4">
              {REPORT_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  onClick={() => setReportType(rt.value)}
                  className={[
                    'w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors',
                    reportType === rt.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300',
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
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
