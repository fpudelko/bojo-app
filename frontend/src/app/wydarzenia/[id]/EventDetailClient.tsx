'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Calendar, Clock, MapPin, Users, UserPlus, Trash2, Lock, Globe, Share2, Check, X, Pencil, Banknote, Trophy, Star, BanIcon, RotateCcw, AlertTriangle, Copy, ChevronDown, ChevronRight, Settings, ArrowLeft, Navigation, Tag, Eye, Link2 as LinkIcon, Repeat,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import TimeSelect from '@/components/ui/TimeSelect';
import MatchResultForm from '@/components/events/MatchResultForm';
import TeamsPanel from '@/components/events/TeamsPanel';
import TeamProposals from '@/components/events/TeamProposals';
import EventComments from '@/components/events/EventComments';
import InviteFromGroupDialog from '@/components/events/InviteFromGroupDialog';
import WybierzGrupeDialog from '@/components/events/WybierzGrupeDialog';
import ZakresEdycjiSerii from '@/components/events/ZakresEdycjiSerii';
import {
  getSeriesEvents, setSeriesTime, setSeriesTemplateTime,
  terminyWZakresie, type ZakresEdycji,
} from '@/lib/series';
import EventInvitesStatus from '@/components/events/EventInvitesStatus';
import { useAuth, displayName } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { useToast } from '@/lib/toast';
import { eventLocation } from '@/lib/utils';
import { eventUrl, shareEvent } from '@/lib/eventShare';
import { HideBottomNav } from '@/lib/bottomNavVisibility';
import {
  getEvent, joinEvent, joinEventMaybe, confirmFromMaybe, addGuest, removeParticipant, setVisibility, deleteEvent,
  cancelEvent, restoreEvent, repeatEvent, setAllowGuestAdds, setEventGroup, setEventWhen,
  approveParticipant, rejectParticipant,
  syncReserveClaim, acceptReserveClaim, declineReserveClaim, wolneMiejscaWgRol,
  awansujZRezerwy, cofnijNaRezerwe,
} from '@/lib/events';
import {
  updateParticipantTeam, updateParticipantPayment,
  assignTeamsRandomly, clearTeams as clearTeamsDb, setCaptain,
  getMatchResult, getPlayerGoals,
  publishTeams, unpublishTeams, saveEventAdvancedSettings,
} from '@/lib/eventFeatures';
import type {
  EventItem, EventParticipant, MatchResult, PlayerGoal,
  PaymentMethod, SportsCardProvider, Visibility,
} from '@/types';
import { sportEmoji } from '@/lib/sports';
import { linkPrzejeciaWpisu, tekstZaproszeniaGoscia } from '@/lib/guestClaim';
import { tekstRozliczenia } from '@/lib/settlementShare';
import { eventDisplayTitle } from '@/lib/eventTitle';
import { minutesUntilStart } from '@/lib/eventDates';
import {
  getTeamProposals, createTeamProposal, deleteTeamProposal,
  voteTeamProposal, unvoteTeamProposal, acceptTeamProposal,
  type TeamProposal,
} from '@/lib/teamProposals';
import { PAYMENT_METHOD_LABELS, sportsCardLabel, priceForParticipant, canSeeBlikPhone } from '@/lib/payments';
import { withCount } from '@/lib/plural';
import { TEAM_LABELS, TEAM_LETTERS, TEAM_COLOR_CLASSES } from '@/lib/teamLabels';
import { WARSTWA } from '@/lib/warstwy';
import { useBlokadaPrzewijania } from '@/lib/blokadaPrzewijania';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function fromMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

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

/** Rola gracza w składzie — plakietka.
 *
 *  Bramkarz miał „🧤 BR", zawodnik z pola nie miał nic, więc jego rola czytała
 *  się jako „brak informacji", a nie jako decyzja. Obie role wyglądają teraz
 *  symetrycznie. Pokazujemy je wyłącznie, gdy mecz w ogóle rozróżnia bramkarzy
 *  (`goalkeepersEnabled`) — inaczej wszyscy mieliby tę samą plakietkę i byłaby
 *  ona czystym szumem. */
function RolaGracza({ bramkarz, wariant = 'pelny' }: { bramkarz: boolean; wariant?: 'pelny' | 'maly' }) {
  const wspolne = wariant === 'maly'
    ? 'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold'
    : 'shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-semibold';
  return bramkarz ? (
    <span title="Bramkarz" className={`${wspolne} border-primary-100 bg-primary-50 text-primary-700`}>🧤 BR</span>
  ) : (
    <span title="Zawodnik z pola" className={`${wspolne} border-slate-200 bg-slate-50 text-slate-500`}>⚽ POLE</span>
  );
}

/** Inline roster — rendered INSIDE the player-count card when the avatar stack
 *  is expanded. Always shows flat lists: regulars then reserves.
 *
 *  To jedyny widok składu po starcie meczu (kontrolki organizatora znikają —
 *  patrz `eventStarted` w komponencie nadrzędnym), więc przycisk „Zaproś do
 *  Bojo" musi tu żyć osobno, inaczej znika dokładnie wtedy, gdy organizator
 *  naturalnie wraca na stronę wpisać wynik i konwersja gościa jest najłatwiejsza. */
function ParticipantsList({
  regulars, reserves, gkEnabled, mozeZaprosic, skopiowanyToken, onZaprosDoBojo, golyMap,
}: {
  regulars: EventParticipant[];
  reserves: EventParticipant[];
  gkEnabled: boolean;
  mozeZaprosic: (p: EventParticipant) => boolean;
  skopiowanyToken: string | null;
  onZaprosDoBojo: (p: EventParticipant) => void;
  golyMap: Record<string, number>;
}) {
  return (
    <div className="space-y-3 text-left">
      <div className="divide-y divide-slate-50 dark:divide-slate-700">
        {regulars.map((p) => (
          <div key={p.id} className="py-2">
            <PlayerLink p={p} className="flex items-center gap-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <PlayerAvatar p={p} />
              <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate">{p.name}</span>
              {golyMap[p.id] > 0 && (
                <span className="shrink-0 text-xs font-semibold text-slate-500">⚽ {golyMap[p.id]}</span>
              )}
              {gkEnabled && <RolaGracza bramkarz={!!p.isGoalkeeper} />}
            </PlayerLink>
            {mozeZaprosic(p) && p.isGuest && p.claimToken && (
              <button
                type="button"
                onClick={() => onZaprosDoBojo(p)}
                className="ml-11 mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary-700 hover:underline"
              >
                <LinkIcon className="h-3 w-3" />
                {skopiowanyToken === p.id ? 'Skopiowano link' : 'Zaproś do Bojo'}
              </button>
            )}
          </div>
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
              <div key={p.id} className="py-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-400">
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{p.name}</span>
                  {golyMap[p.id] > 0 && (
                    <span className="shrink-0 text-xs font-semibold text-slate-500">⚽ {golyMap[p.id]}</span>
                  )}
                  {/* Rola także na rezerwie: od migracji `075` kolejka biegnie
                      osobno dla bramkarzy i zawodników z pola, więc sam numer
                      w kolejce nie mówi, na co ta osoba właściwie czeka. */}
                  {gkEnabled && <RolaGracza bramkarz={!!p.isGoalkeeper} wariant="maly" />}
                </div>
                {mozeZaprosic(p) && p.isGuest && p.claimToken && (
                  <button
                    type="button"
                    onClick={() => onZaprosDoBojo(p)}
                    className="ml-11 mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary-700 hover:underline"
                  >
                    <LinkIcon className="h-3 w-3" />
                    {skopiowanyToken === p.id ? 'Skopiowano link' : 'Zaproś do Bojo'}
                  </button>
                )}
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
  teamA, teamB, unassigned, golyMap,
}: {
  teamA: EventParticipant[];
  teamB: EventParticipant[];
  unassigned: EventParticipant[];
  golyMap: Record<string, number>;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">Składy</p>
      <div className="grid grid-cols-2 gap-4">
        {[{ key: 'A' as const, players: teamA },
          { key: 'B' as const, players: teamB }]
          .map(({ key, players }) => (
            <div key={key}>
              <p className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold mb-2 ${TEAM_COLOR_CLASSES[key].pill}`}>
                {TEAM_LABELS[key]} ({TEAM_LETTERS[key]}) · {players.length}
              </p>
              <div className="space-y-1.5">
                {players.length === 0
                  ? <p className="text-xs italic text-slate-400">Brak graczy</p>
                  : players.map((p) => (
                    <PlayerLink key={p.id} p={p} className="flex items-center gap-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <PlayerAvatar p={p} />
                      <span className="text-sm font-medium text-ink truncate">{p.name}</span>
                      {golyMap[p.id] > 0 && <span className="text-[10px] font-semibold text-slate-500">⚽{golyMap[p.id]}</span>}
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
//
// Panel udostępniał kiedyś WŁASNY link (`/d/{kod}`), inny niż przycisk
// „Udostępnij" w pasku górnym — ten sam mecz, dwa adresy, dwa przyciski o tej
// samej nazwie na jednej stronie. Teraz oba wołają `shareEvent` z tym samym
// adresem kanonicznym i tym samym tekstem. Dlaczego akurat kanoniczny, a nie
// krótszy: patrz komentarz przy `eventUrl` w `lib/eventShare.ts`.
// ---------------------------------------------------------------------------
function ZaprosZnajomychPanel({ event }: { event: EventItem }) {
  const [copied, setCopied] = useState(false);

  const link = () => eventUrl(
    event.id,
    typeof window !== 'undefined' ? window.location.origin : 'https://bojo.pl',
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  };

  const share = async () => {
    const wynik = await shareEvent(event, link());
    if (wynik === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
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
  const [guestName, setGuestName] = useState('');
  const [guestIsGk, setGuestIsGk] = useState(false);
  // `copied` bez czytania wartości — jedynym sygnałem po skopiowaniu linku jest
  // toast. Stan został po wersji, w której przycisk zmieniał napis na „OK".
  const [, setCopied] = useState(false);
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
  // Repeat game dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatDate, setRepeatDate] = useState('');
  const [repeatTime, setRepeatTime] = useState('');
  const [repeatBusy, setRepeatBusy] = useState(false);
  const [repeatJoin, setRepeatJoin] = useState(true);
  const [repeatRole, setRepeatRole] = useState<'player' | 'goalkeeper'>('player');
  const [editMode, setEditMode] = useState(false);
  const [groupInfo, setGroupInfo] = useState<{ id: string; name: string } | null>(null);
  const [proposals, setProposals] = useState<TeamProposal[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  // Terminy stałej gierki, do której należy ten mecz — puste, gdy mecz nie jest
  // częścią serii. Decyduje o tym, czy „Zmień termin" pyta o zakres.
  const [seriaTerminy, setSeriaTerminy] = useState<{ id: string; date: string }[]>([]);
  const [zakresTerminuOtwarty, setZakresTerminuOtwarty] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // Panel „Mecz gotowy" — tylko tuż po publikacji z kreatora.
  const [swiezoUtworzony, setSwiezoUtworzony] = useState(false);
  // Id szablonu cyklicznego, gdy kreator go właśnie utworzył razem z tym
  // meczem (?cykliczne=<id>) — patrz `wydarzenia/nowe/page.tsx`.
  const [cyklicznyId, setCyklicznyId] = useState<string | null>(null);
  // Wylogowany kliknął „Zaloguj się, aby dołączyć" (?dolacz=1) — po powrocie
  // z logowania otwieramy okno zapisu automatycznie zamiast zostawiać go na
  // widoku identycznym z tym sprzed logowania.
  const [chceDolaczyc, setChceDolaczyc] = useState(false);
  const [venueInfoOpen, setVenueInfoOpen] = useState(false);
  const [skopiowanyToken, setSkopiowanyToken] = useState<string | null>(null);
  const [rozliczenieSkopiowane, setRozliczenieSkopiowane] = useState(false);
  // Rescheduling from the badge. `whenConfirm` is the second gate: moving a
  // match that people already signed up for needs an explicit yes.
  const [whenOpen, setWhenOpen] = useState(false);
  const [whenDate, setWhenDate] = useState('');
  const [whenTime, setWhenTime] = useState('');
  const [whenEnd, setWhenEnd] = useState('');
  const [whenConfirm, setWhenConfirm] = useState(false);
  // Wybór widoczności z badge'a — okno zamiast natychmiastowego przełącznika.
  const [visOpen, setVisOpen] = useState(false);

  // Jedno wywołanie dla wszystkich okien tej strony — hook musi lecieć
  // bezwarunkowo, więc stan „czy cokolwiek jest otwarte" liczymy tutaj.
  useBlokadaPrzewijania(
    joinDialogOpen || leaveConfirmOpen || deleteConfirmOpen || venueInfoOpen
    || repeatOpen || inviteOpen || groupPickerOpen || whenOpen || visOpen,
  );
  const loadMatchData = useCallback(async (ev: EventItem) => {
    if (!ev.trackResults) return;
    const [result, goals] = await Promise.all([getMatchResult(ev.id), getPlayerGoals(ev.id)]);
    setMatchResult(result);
    setPlayerGoals(goals);
  }, []);

  const load = useCallback(async () => {
    try {
      // Move the reserve queue along before reading: lapses an expired offer and
      // hands a free spot to the next person. There's no cron, so any page view
      // is what keeps the queue honest.
      await syncReserveClaim(id);
      const { event: ev, participants: parts } = await getEvent(id);
      setEvent(ev);
      setParticipants(parts);
      await loadMatchData(ev);
      // Proposals only matter once the match actually uses teams.
      if (ev.teamMode !== 'brak') {
        getTeamProposals(id, user?.id).then(setProposals).catch(() => {});
      } else {
        setProposals([]);
      }
      if (ev.groupId) {
        import('@/lib/groups').then(({ getGroup }) =>
          getGroup(ev.groupId!).then((g) => g && setGroupInfo({ id: g.id, name: g.name })).catch(() => {}),
        );
      } else {
        setGroupInfo(null);
      }
      if (ev.recurringEventId) {
        // Cicho — brak listy terminów znaczy tylko tyle, że nie pytamy o zakres.
        getSeriesEvents(ev.recurringEventId)
          .then((t) => setSeriaTerminy(t.map((x) => ({ id: x.id, date: x.date }))))
          .catch(() => {});
      } else {
        setSeriaTerminy([]);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id, loadMatchData, user?.id]);

  useEffect(() => { load(); }, [load]);

  // Kreator przekierowuje tu z `?utworzono=1`, żeby pokazać panel „Mecz gotowy".
  //
  // Parametr czytamy z `window.location`, a NIE przez `useSearchParams()`: ten
  // hak wymusza na trasie prerenderowanej bail-out do CSR i wywala produkcyjny
  // build błędem `missing-suspense-with-csr-bailout`. Lokalnie się to nie
  // powtórzy — wychodzi dopiero na Vercelu (patrz AGENTS.md).
  //
  // Zaraz po odczycie zdejmujemy parametr z adresu. Dwa powody: odświeżenie
  // strony nie pokaże panelu drugi raz, a „Kopiuj link" nie złapie go do
  // schowka — choć ten drugi jest już zabezpieczony osobno, bo kopiuje
  // `eventUrl()`, nie `window.location.href`.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const cid = p.get('cykliczne');
    if (cid) setCyklicznyId(cid);
    // Wylogowany klika „Zaloguj się, aby dołączyć" i wraca na tę samą stronę
    // po zalogowaniu — dotąd lądował na widoku identycznym z tym sprzed
    // logowania i musiał od nowa znaleźć przycisk „Dołącz". `?dolacz=1` niesie
    // tę intencję przez logowanie, tym samym wzorem co `?utworzono=1`.
    const dolacz = p.get('dolacz') === '1';
    if (dolacz) setChceDolaczyc(true);
    if (p.get('utworzono') !== '1' && !cid && !dolacz) return;
    if (p.get('utworzono') === '1' || cid) setSwiezoUtworzony(true);
    p.delete('utworzono');
    p.delete('cykliczne');
    p.delete('dolacz');
    const q = p.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
  }, []);

  // Otwarcie okna zapisu po powrocie z logowania — osobny efekt, bo musi
  // poczekać, aż skończy się `authLoading` i wczyta mecz. Nie zapisujemy
  // nikogo automatycznie: to łamałoby regułę „nikt nie trafia do składu po
  // cichu" (docs/domena.md) i przy meczu płatnym pominęłoby wybór sposobu
  // płatności.
  //
  // `eventStarted`/`regulars` są liczone niżej w komponencie (po early
  // returnach dla `loading`/`notFound`), więc ten efekt — hook, musi stać
  // przed nimi — liczy to samo inline z `event`/`participants`, żeby nie
  // odwoływać się do stałych `const`, które w tym miejscu pliku jeszcze
  // nie istnieją.
  useEffect(() => {
    if (!chceDolaczyc || authLoading || loading || !user || !event) return;
    setChceDolaczyc(false);
    if (event.status === 'cancelled') return;
    let started = true;
    try {
      const [y, m, d] = event.date.split('-').map(Number);
      const [h, min] = (event.time ?? '00:00').split(':').map(Number);
      started = Date.now() >= new Date(y, m - 1, d, h, min).getTime();
    } catch { /* started zostaje true — bezpieczniej nie otwierać okna */ }
    if (started) return;
    if (participants.some((p) => p.userId === user.id)) return; // już zapisany
    const takenSpots = participants.filter((p) => !p.pendingApproval && !p.isReserve).length;
    setJoinRole('player');
    setJoinAsReserve(takenSpots >= event.maxPlayers);
    setJoinDialogOpen(true);
  }, [chceDolaczyc, authLoading, loading, user, event, participants]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header showMobileWordmark />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
        </main>
      </div>
    );
  }
  if (notFound || !event) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header showMobileWordmark />
        <main className="flex-1 flex items-center justify-center px-4 text-center text-slate-500">
          <div>
            <X className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Nie znaleziono wydarzenia</p>
          </div>
        </main>
      </div>
    );
  }

  // Deliberately broader than `isOwner` — drives support/moderation affordances
  // (guest management, entering the match result), not the management panel.
  // The "Zarządzaj wydarzeniem" panel below is gated on `isOwner`, so an admin
  // never gets a shortcut into someone else's match from there.
  const isOrganizer = !!user && (user.id === event.organizerId || isAdmin);
  // Strict ownership — only the actual creator, never admins. Drives the inline
  // "Edytuj" link so admins don't see an edit shortcut on other people's events.
  const isOwner = !!user && user.id === event.organizerId;
  // Gościa dopisuje często uczestnik, nie organizator (`allowGuestAdds`
  // pozwala każdemu) — i to właśnie ten, kto go przyprowadził, ma z nim
  // kontakt. Dotąd link przejęcia wpisu mógł wysłać wyłącznie organizator,
  // czyli najczęściej osoba, która gościa w ogóle nie zna.
  const mozeZaprosic = (p: EventParticipant) => isOrganizer || (!!user && p.addedBy === user.id);
  // Pending requests don't count toward the roster or capacity.
  const confirmed = participants.filter((p) => !p.pendingApproval);
  const pendingRequests = participants.filter((p) => p.pendingApproval);
  const regulars = confirmed.filter((p) => !p.isReserve);
  // Obserwujący („może") siedzi w bazie z `is_reserve = true` — to sztuczka,
  // żeby nie zajmował miejsca w składzie, a nie deklaracja gry. Bez tego filtru
  // wpadał do kolejki rezerwowej i człowiek, który kliknął „Obserwuj",
  // widział siebie jako rezerwowego.
  const reserves = confirmed.filter((p) => p.isReserve && p.rsvp !== 'maybe');
  // Gość przejmuje wpis, dopóki ma token — po przejęciu `is_guest` przechodzi
  // na false (migracja 066), więc licznik sam się zeruje bez dodatkowego stanu.
  const niePrzejeciGoscie = [...regulars, ...reserves].filter((p) => p.isGuest && p.claimToken);
  const myConfirmed = confirmed.find((p) => p.userId && p.userId === user?.id && p.rsvp !== 'maybe');
  const myMaybe = confirmed.find((p) => p.userId && p.userId === user?.id && p.rsvp === 'maybe');
  const myPendingRequest = pendingRequests.find((p) => p.userId && p.userId === user?.id);
  // "myParticipation" = I'm in the roster (confirmed). Pending is handled separately.
  const myParticipation = myConfirmed;
  // My row whichever way I'm in — confirmed or "maybe" (used by the leave dialog).
  const myEntry = myConfirmed ?? myMaybe;
  // Am I already tied to this match in any way? Drives whether the UI still
  // pitches joining — a squad member, reserve, pending request or observer has
  // nothing to act on when the match fills up.
  const amIInvolved = !!(myConfirmed || myMaybe || myPendingRequest);
  // Rezerwowy nie ma miejsca w składzie, więc „wypisz się z meczu" myli —
  // sugeruje, że coś zwalnia. Wypisuje się z kolejki, nie ze składu.
  const amIReserve = !!myConfirmed?.isReserve;
  // My place in the reserve queue (1-based). The queue is ordered by signup
  // time, same as sync_reserve_claim walks it — so this number is what
  // actually decides who gets the next freed spot.
  const myReservePosition = amIReserve
    ? reserves.filter((p) => !p.claimPassed).findIndex((p) => p.id === myConfirmed!.id) + 1 || null
    : null;
  // A freed spot currently offered to me (I'm on the reserve and it's my turn).
  const myClaimOffer = reserves.find((p) => p.userId === user?.id && p.claimOfferedAt);
  const claimDeadline = myClaimOffer?.claimOfferedAt
    ? new Date(new Date(myClaimOffer.claimOfferedAt).getTime() + event.reserveClaimHours * 3600_000)
    : null;
  const takenSpots = regulars.length;
  const isFull = takenSpots >= event.maxPlayers;
  const eventLoc = eventLocation(event);
  // Kafelek pokazuje NAZWĘ obiektu, adres dopiero w jej braku.
  //
  // Było odwrotnie, z uzasadnieniem „nazwy z katalogu są generyczne (»Boisko —
  // piłka nożna«), a ulica mówi więcej". Po imporcie z OSM to już nieprawda:
  // obiekty mają własne nazwy („Szkoła Podstawowa nr 5 — boisko piłkarskie"),
  // a miejscowość zniknęła z nazwy, więc nie dubluje adresu. Przy okazji
  // znikła sprzeczność: nagłówek mówił „ul. Pawia", a okno zapisu na ten sam
  // mecz — pełną nazwę szkoły.
  const venueBadgeLabel = eventLoc.primary || eventLoc.secondary;

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

  // Gole przy nazwisku w składzie — jedyne aktywnie zapisywane źródło jest
  // `match_results.result_data.scorers` (tabela `player_goals` to martwy duplikat).
  const golyMap: Record<string, number> = {};
  if (matchResult?.resultData?.type === 'goals') {
    for (const s of matchResult.resultData.scorers ?? []) {
      if (s.goals > 0) golyMap[s.participantId] = s.goals;
    }
  }

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

  const handleAcceptClaim = async () => {
    if (!myClaimOffer) return;
    setBusy(true);
    try {
      await acceptReserveClaim(myClaimOffer.id);
      await load();
      toast('Jesteś w składzie! ⚽');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleDeclineClaim = async () => {
    if (!myClaimOffer) return;
    if (!confirm('Odpuszczasz to miejsce? Przejdzie do kolejnej osoby z rezerwy.')) return;
    setBusy(true);
    try {
      await declineReserveClaim(myClaimOffer.id, event.id);
      await load();
      toast('Miejsce przeszło do kolejnej osoby');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  // --- Propozycje składów -------------------------------------------------
  const reloadProposals = async () => {
    try { setProposals(await getTeamProposals(event.id, user?.id)); } catch { /* ignore */ }
  };

  const handleProposeTeams = async (picks: Record<string, 'A' | 'B'>) => {
    if (!user) return;
    setBusy(true);
    try {
      await createTeamProposal(event.id, user.id, picks);
      await reloadProposals();
      toast('Propozycja wysłana — reszta może ją poprzeć');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleVoteProposal = async (proposalId: string) => {
    if (!user) return;
    setBusy(true);
    try { await voteTeamProposal(proposalId, user.id); await reloadProposals(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); }
    finally { setBusy(false); }
  };

  const handleUnvoteProposal = async (proposalId: string) => {
    if (!user) return;
    setBusy(true);
    try { await unvoteTeamProposal(proposalId, user.id); await reloadProposals(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); }
    finally { setBusy(false); }
  };

  const handleAcceptProposal = async (proposalId: string) => {
    if (!confirm('Zatwierdzić tę propozycję? Zastąpi obecny podział na drużyny.')) return;
    setBusy(true);
    try {
      await acceptTeamProposal(proposalId);
      await load();
      toast('Składy zatwierdzone');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleDeleteProposal = async (proposalId: string) => {
    if (!confirm('Usunąć tę propozycję?')) return;
    setBusy(true);
    try { await deleteTeamProposal(proposalId); await reloadProposals(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); }
    finally { setBusy(false); }
  };

  const handleJoin = async (asGoalkeeper = false) => {
    if (!user) return;
    setBusy(true);
    try {
      const platnosc = {
        method: joinPaymentMethod,
        hasSportsCard: joinHasSportsCard,
        sportsCardProvider: joinSportsCardProvider,
      };
      // Obserwujący ma już wiersz w `event_participants` — dosłowny `joinEvent`
      // wywaliłby się na unikalności. Przełączamy istniejący wpis, przekazując
      // te same decyzje (pozycja, płatność), które właśnie podjął w dialogu.
      const wynik = myMaybe
        ? await confirmFromMaybe(myMaybe.id, event.id, asGoalkeeper, platnosc)
        : await joinEvent(event.id, user.id, displayName(user), asGoalkeeper, platnosc);
      await load();
      // Komunikat bierze się z TEGO, CO SIĘ STAŁO, nie z ustawień meczu.
      // Wcześniej zawsze mówił „Dołączyłeś do meczu!" — także wtedy, gdy zapis
      // wylądował na rezerwie, bo w wybranej roli był już komplet. Człowiek
      // wychodził przekonany, że gra, a jedynym śladem był przycisk „wypisz się
      // z rezerwy" gdzieś niżej na stronie.
      if (wynik.pending) {
        toast('Wysłano prośbę o dołączenie — czekaj na akceptację organizatora');
      } else if (wynik.isReserve) {
        toast(asGoalkeeper
          ? 'Komplet bramkarzy — jesteś na liście rezerwowej'
          : 'Komplet w polu — jesteś na liście rezerwowej');
      } else {
        toast(asGoalkeeper ? 'Dołączyłeś jako bramkarz! 🧤' : 'Dołączyłeś do meczu!');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  /** Ręczny awans z rezerwy. Gdy w roli tej osoby nie ma już miejsca, pytamy —
   *  organizator może świadomie przekroczyć limit (dogadał się z obiektem,
   *  ktoś odpadnie w ostatniej chwili), ale nie powinien zrobić tego przez
   *  przypadek, bo licznik „14/14" zamieni się w „15/14". */
  const handleAwans = async (p: EventParticipant) => {
    const wolneWRoli = gkEnabled
      ? (p.isGoalkeeper ? wolne.bramkarze : wolne.pole)
      : wolne.razem;
    if (wolneWRoli <= 0) {
      const rola = !gkEnabled ? 'Skład' : p.isGoalkeeper ? 'Miejsca dla bramkarzy' : 'Miejsca w polu';
      if (!confirm(`${rola} są już zajęte. Dodać ${p.name} do składu mimo to?`)) return;
    }
    setBusy(true);
    try {
      await awansujZRezerwy(p.id, event.id);
      await load();
      toast(`${p.name} — w składzie`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  /** Odwrotność awansu — na koniec kolejki, zamiast usuwania z meczu. */
  const handleCofnijNaRezerwe = async (p: EventParticipant) => {
    if (!confirm(`Przenieść ${p.name} do rezerwy? Zwolni miejsce w składzie.`)) return;
    setBusy(true);
    try {
      await cofnijNaRezerwe(p.id, event.id);
      await load();
      toast(`${p.name} — na liście rezerwowej`);
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

  /** Give up the spot but keep following the match. Two steps rather than one
   *  RPC: the spot must be freed first (so `sync_reserve_claim` can offer it on)
   *  before the observing row goes in, or the capacity check would see the old
   *  row and refuse. */
  const handleLeaveAndObserve = async (participantId: string) => {
    if (!user) return;
    setBusy(true);
    try {
      await removeParticipant(participantId);
      await joinEventMaybe(event.id, user.id, displayName(user));
      await load();
      toast('Nie grasz, ale obserwujesz ten mecz');
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

  // Widoczność zmienia się przez okno wyboru, nie jednym tknięciem badge'a.
  // Przełącznik w miejscu, w którym stoi etykieta, znaczył tyle, że przypadkowe
  // dotknięcie zdejmowało mecz z publicznej listy — bez pytania i bez śladu,
  // za to od razu dla wszystkich, którzy go szukali.
  const handleSetVisibility = async (next: Visibility) => {
    if (next === event.visibility) { setVisOpen(false); return; }
    setBusy(true);
    try {
      await setVisibility(event.id, next, user?.id, displayName(user ?? null));
      setVisOpen(false);
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

  // Filing an existing match under a group after the fact — matches created
  // outside a group otherwise never show up on the group's list.
  const handleSetGroup = async (groupId: string) => {
    setBusy(true);
    try {
      await setEventGroup(event.id, groupId || null);
      await load();
      toast(groupId ? 'Mecz przypisany do grupy' : 'Mecz odpięty od grupy');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  /** Udostępnia jednorazowy link, którym gość zwiąże ten wpis ze swoim kontem —
   *  razem z argumentem, nie samym adresem (patrz `tekstZaproszeniaGoscia`). */
  const kopiujLinkPrzejecia = async (p: EventParticipant) => {
    if (!p.claimToken) return;
    const url = linkPrzejeciaWpisu(p.claimToken);
    // Kto zaprasza: osoba, która ten wpis dopisała. Nie zawsze organizator —
    // przy `allowGuestAdds` robi to kolega z drużyny, a wiadomość podpisana
    // cudzym nazwiskiem myli bardziej niż brak podpisu.
    const zapraszajacy = participants.find((x) => x.userId === p.addedBy)?.name
      ?? (p.addedBy === event.organizerId ? event.organizerName : undefined)
      ?? event.organizerName;
    const text = tekstZaproszeniaGoscia(p.name, event, zapraszajacy);

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Zaproszenie do Bojo', text, url });
        return;
      } catch {
        return; // anulowane przez użytkownika — nic nie pokazujemy, jak w shareEvent()
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setSkopiowanyToken(p.id);
      setTimeout(() => setSkopiowanyToken(null), 2500);
      toast('Wiadomość skopiowana — wyślij ją tej osobie');
    } catch {
      toast('Nie udało się skopiować linku', 'error');
    }
  };

  /** Rozliczenie kończyło się na ekranie organizatora: żeby powiedzieć ekipie,
   *  kto jeszcze nie oddał, trzeba było przepisać to ręcznie na czat. Goście
   *  bez konta w ogóle nie mają jak tego zobaczyć w samym Bojo. Bez `url`
   *  w `navigator.share` — to wiadomość do ludzi, którzy już są w meczu,
   *  a przy gościach bez konta link i tak nie pokazałby im nic nowego. */
  const handleWyslijRozliczenie = async () => {
    const text = tekstRozliczenia(event, regulars);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Rozliczenie', text });
      } catch {
        // anulowane przez użytkownika — nic nie pokazujemy, jak w shareEvent()
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setRozliczenieSkopiowane(true);
      setTimeout(() => setRozliczenieSkopiowane(false), 2500);
    } catch {
      toast('Nie udało się skopiować', 'error');
    }
  };

  /** Jedna ścieżka udostępniania dla całej strony — patrz `lib/eventShare.ts`.
   *  Adres bierzemy z `eventUrl`, a nie z `window.location.href`, bo ten drugi
   *  potrafi nieść parametry widoku (np. `?utworzono=1` tuż po publikacji). */
  const handleShare = async () => {
    const wynik = await shareEvent(event, eventUrl(event.id, window.location.origin));
    if (wynik === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast('Skopiowano — wklej na czacie ze znajomymi');
    }
    // 'failed' obejmuje anulowanie arkusza przez użytkownika, więc milczymy.
  };

  const openEditWhen = () => {
    setWhenDate(event.date);
    setWhenTime((event.time ?? '18:00').slice(0, 5));
    setWhenEnd((event.endTime ?? '').slice(0, 5));
    setWhenConfirm(false);
    setWhenOpen(true);
  };

  const zapiszTermin = async (zakres: ZakresEdycji) => {
    setZakresTerminuOtwarty(false);
    setBusy(true);
    try {
      // Data zawsze dotyczy wyłącznie tego terminu — wspólna data absolutna dla
      // całej serii oznaczałaby wszystkie mecze tego samego dnia.
      await setEventWhen(
        event.id, whenDate, whenTime, whenEnd || null,
        user?.id, displayName(user ?? null),
      );

      if (zakres !== 'ten' && event.recurringEventId) {
        const dzis = new Date().toLocaleDateString('sv-SE');
        const objete = terminyWZakresie(seriaTerminy, event.id, zakres, dzis)
          .filter((t) => t.id !== event.id);
        await setSeriesTime(objete.map((t) => t.id), whenTime, whenEnd || null);
        // Szablon też — inaczej kolejne terminy wracałyby do starej godziny.
        await setSeriesTemplateTime(event.recurringEventId, whenTime, whenEnd || null);
      }

      setWhenOpen(false);
      await load();
      toast(zakres === 'ten' ? 'Termin zmieniony' : 'Godzina zmieniona w serii');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setBusy(false); }
  };

  const handleSaveWhen = async () => {
    // O zakres pytamy tylko, gdy zmieniła się GODZINA. Sama zmiana daty dotyczy
    // z definicji jednego terminu, więc pytanie byłoby zbędnym kliknięciem.
    const godzinaZmieniona =
      whenTime !== (event.time ?? '').slice(0, 5)
      || (whenEnd || '') !== (event.endTime ?? '').slice(0, 5);

    if (godzinaZmieniona && event.recurringEventId && seriaTerminy.length > 1) {
      setZakresTerminuOtwarty(true);
      return;
    }
    await zapiszTermin('ten');
  };

  /** Straight to the clipboard — for people who just want to paste the link
   *  into a chat and skip the system share sheet. */
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl(event.id, window.location.origin));
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast('Nie udało się skopiować linku', 'error');
    }
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
      const newId = await repeatEvent(
        event, repeatDate, repeatTime, user.id, displayName(user),
        repeatJoin, repeatJoin && repeatRole === 'goalkeeper',
      );
      setRepeatOpen(false);
      toast('Wydarzenie skopiowane!');
      router.push(`/wydarzenia/${newId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally { setRepeatBusy(false); }
  };

  // Zapisywanie wyniku i goli przeniosło się do `MatchResultForm` (ma własny
  // stan i `onSaved`), a `canManualAssign` do `TeamsPanel`. Osierocone kopie
  // zostały tu po refaktorze — nic ich nie wołało. Wykrył je dopiero ESLint
  // uruchomiony po raz pierwszy w tym repo.

  const isCancelled = event.status === 'cancelled';
  // eventStarted: event time has passed
  const eventStarted = (() => {
    try {
      const [y, m, d] = event.date.split('-').map(Number);
      const [h, min] = (event.time ?? '00:00').split(':').map(Number);
      return Date.now() >= new Date(y, m - 1, d, h, min).getTime();
    } catch { return true; }
  })();

  // Organizator widzi listę od razu: to jego narzędzie pracy, a przy pustym
  // składzie nie ma nawet awatarów, w które można by kliknąć, żeby ją rozwinąć
  // — i dopisanie gościa stawało się nieosiągalne.
  const rosterRozwiniety = rosterOpen || (isOwner && !eventStarted);
  // Drives both the sticky join bar below and hiding the bottom nav while
  // it's up — the nav would otherwise cover "Dołącz"/"Obserwuj". Stays true
  // while merely observing (myMaybe), matching the join bar's own comment.
  const joinBarVisible = !(user && (myParticipation || myPendingRequest)) && !eventStarted;
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
  const wolne = wolneMiejscaWgRol(regulars, event);
  // Czy rola wybrana w oknie dołączania jest już pełna — i którym z kolei
  // będzie ten zapis. Liczone z tych samych danych, z których liczy je
  // `decydujCzyRezerwa()` po stronie zapisu, żeby zapowiedź zgadzała się
  // z tym, co faktycznie się stanie.
  const rolaPelna = joinAsReserve || (gkEnabled
    ? (joinRole === 'goalkeeper' ? wolne.bramkarze === 0 : wolne.pole === 0)
    : wolne.razem === 0);
  // Płatny mecz z listą akceptowanych metod wymaga deklaracji „jak zapłacę".
  // Bez tego wpis lądował w bazie z `payment_method = null` i organizator nie
  // miał czego rozliczyć — pole było widoczne, ale nic nie wymuszało wyboru.
  const brakWyboruPlatnosci = event.costGrosze > 0
    && event.acceptedPaymentMethods.length > 0
    && !joinPaymentMethod;
  const pozycjaWKolejce = reserves.filter((p) => !p.claimPassed
    && (!gkEnabled || !!p.isGoalkeeper === (joinRole === 'goalkeeper'))).length + 1;

  // Po starcie meczu rozliczenie idzie przed składem/wynikiem — to wtedy
  // organizator/gracz faktycznie tego szukają. Treść sekcji bez zmian,
  // zmienia się wyłącznie kolejność (patrz `eventStarted` niżej w JSX).
  const skladWynikSection = (
    <>
      {/* Published teams — visible to all participants (separate from roster) */}
      {showTeams && event.teamsPublished && !isOwner && (
        <div className="px-4">
          <PublishedTeamsCard teamA={teamA} teamB={teamB} unassigned={unassigned} golyMap={golyMap} />
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

      {/* Propozycje składów. Organizator ustawia drużyny wprost w panelu wyżej,
          więc sam nie proponuje — widzi tylko cudze propozycje i „Zatwierdź".
          Uczestnik odwrotnie: może zaproponować i poprzeć, ale nie tknie
          realnego składu. Po opublikowaniu składów temat jest zamknięty. */}
      {showTeams && !eventStarted && (
        <div className="px-4">
          <TeamProposals
            proposals={proposals}
            participants={regulars}
            teamMode={event.teamMode}
            isOrganizer={isOwner}
            canPropose={!!user && !!myParticipation && !isOwner && !event.teamsPublished}
            currentUserId={user?.id}
            busy={busy}
            onSubmit={handleProposeTeams}
            onVote={handleVoteProposal}
            onUnvote={handleUnvoteProposal}
            onAccept={handleAcceptProposal}
            onDelete={handleDeleteProposal}
          />
        </div>
      )}

      {/* Pre-match "result coming" note — only the organizer enters results */}
      {isOwner && event.trackResults && !resultsAvailable && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-3 text-sm text-slate-400">
          <Trophy className="w-4 h-4 shrink-0" />
          Wynik można wpisać po rozpoczęciu meczu ({event.date} {event.time?.slice(0, 5)})
        </div>
      )}
      {isOwner && eventStarted && resultsAvailable && event.trackResults && !matchResult && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          Mecz się odbył — wpisz wynik, żeby zapisał się w statystykach graczy.
        </p>
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
    </>
  );

  const platnosciSection = (
    <>
      {/* Cost split summary — deliberately NOT gated by !eventStarted: rozliczenie
          kosztów zwykle dzieje się po meczu, więc chowanie go wtedy, gdy organizator
          faktycznie się rozlicza z ekipą, było błędem. */}
      {event.costGrosze > 0 && isOwner && (
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
          {/* Rozliczenie kończyło się na ekranie: żeby powiedzieć ekipie,
              kto jeszcze nie oddał, organizator przepisywał to ręcznie na
              czat. Goście bez konta w ogóle nie mają jak tego zobaczyć
              w Bojo. */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Button variant="outline" className="w-full" onClick={handleWyslijRozliczenie}>
              <Share2 className="h-4 w-4" strokeWidth={2.25} />
              {rozliczenieSkopiowane ? 'Skopiowano' : 'Wyślij rozliczenie ekipie'}
            </Button>
            <p className="mt-2 text-[11px] text-slate-400">
              Gotowa wiadomość z kwotą, listą zaległości i numerem BLIK — do wklejenia na czat.
            </p>
          </div>
        </div>
      )}

      {/* Uczestnik nigdy nie widział, ile ma zapłacić — widział to tylko
          organizator w „Podziale kosztów" wyżej. `showPaymentStatus`
          („Pokaż status płatności uczestnikom") było od dawna zapisywane
          przez formularz edycji i nigdzie nieodczytywane; to pierwsze
          miejsce, które je respektuje. Rezerwowy nie widzi tej karty —
          jeszcze nie ma za co płacić, dopóki nie wejdzie do składu. */}
      {event.costGrosze > 0 && !isOwner && event.showPaymentStatus
        && myConfirmed && !myConfirmed.isReserve && (() => {
          const price = priceForParticipant(
            event.costGrosze, event.sportsCardDiscountGrosze, myConfirmed.hasSportsCard,
          );
          return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="font-semibold text-ink flex items-center gap-2 mb-3">
                <Banknote className="w-4 h-4" /> Twoja płatność
              </h2>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Do zapłaty</span>
                <span className="font-semibold text-ink">
                  {price.discountUnspecified
                    ? 'Zniżka z karty — ustal kwotę z organizatorem'
                    : `${(price.priceGrosze / 100).toFixed(2)} PLN`}
                </span>
              </div>
              {myConfirmed.paymentMethod && (
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Sposób</span>
                  <span className="text-ink">{PAYMENT_METHOD_LABELS[myConfirmed.paymentMethod]}</span>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-slate-100">
                {myConfirmed.hasPaid ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                    <Check className="w-3.5 h-3.5" strokeWidth={2.25} /> Opłacone
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    <Clock className="w-3.5 h-3.5" strokeWidth={2.25} /> Jeszcze nieopłacone
                  </span>
                )}
              </div>
            </div>
          );
        })()}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header showMobileWordmark />
      {/* pb-32 kompensował fixed pasek "Dołącz"/"Obserwuj" — a ten pokazuje
          się tylko dopóki joinBarVisible. Bez niego 128 px to czysta pustka
          pod treścią. */}
      <main className={`flex-1 w-full max-w-2xl mx-auto space-y-4 ${joinBarVisible ? 'pb-32' : 'pb-8'}`}>

        {/* ── TOP BAR ──
            Deliberately no cover photo: it was a satellite tile that ate half
            the first screen and told nobody anything the venue card doesn't.
            Labelled actions instead of bare icons — "Udostępnij" opens the
            system share sheet, "Kopiuj" puts the link on the clipboard for
            people who just want to paste it into a chat. */}
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <button
            type="button"
            // Prosto z kreatora „wstecz" wracałoby do wypełnionego formularza —
            // najgorsze możliwe miejsce tuż po opublikowaniu meczu. `replace`,
            // a nie `push`, żeby kreator zniknął też z historii przeglądarki.
            onClick={() => { if (swiezoUtworzony) router.replace('/moje-gry'); else router.back(); }}
            className="-ml-2 inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.25} /> Wróć
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
            >
              <Share2 className="h-4 w-4" strokeWidth={2.25} /> Udostępnij
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
            >
              {linkCopied
                ? <><Check className="h-4 w-4 text-primary-700" strokeWidth={2.25} /> Skopiowano</>
                : <><Copy className="h-4 w-4" strokeWidth={2.25} /> Kopiuj</>}
            </button>
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

        {/* ── MECZ GOTOWY — pierwsza minuta po publikacji ──
            Kreator kończył się przekierowaniem na tę stronę i niczym więcej:
            organizator lądował na widoku identycznym z tym, który widzi każdy
            inny, i sam musiał znaleźć, co dalej. A cała obietnica produktu
            brzmi „stwórz grę i wyślij znajomym jeden link" — to jest ten moment.

            Układ mobile-first: główna akcja pełnej szerokości, dwie poboczne
            w siatce 2×1, która mieści się już na 320 px. */}
        {swiezoUtworzony && isOwner && !isCancelled && (
          <div className="mx-4 rounded-2xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 font-semibold text-ink">Mecz gotowy</p>
              <button
                type="button"
                onClick={() => setSwiezoUtworzony(false)}
                aria-label="Ukryj"
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1 text-slate-500 transition hover:bg-white/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Wyślij link znajomym — to wszystko, czego trzeba, żeby się zapisali.
            </p>

            <Button size="lg" className="mt-3 w-full" onClick={handleShare}>
              <Share2 className="h-4 w-4" strokeWidth={2.25} /> Wyślij link znajomym
            </Button>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleCopyLink}>
                {linkCopied
                  ? <><Check className="h-4 w-4 text-primary-700" strokeWidth={2.25} /> Skopiowano</>
                  : <><Copy className="h-4 w-4" strokeWidth={2.25} /> Kopiuj link</>}
              </Button>
              <Button variant="outline" onClick={() => setInviteOpen(true)}>
                <Users className="h-4 w-4" strokeWidth={2.25} /> Zaproś z grupy
              </Button>
            </div>

            <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
              {event.visibility === 'public'
                ? 'Mecz jest publiczny: zobaczą go też gracze z okolicy na liście otwartych gier.'
                : 'Mecz jest prywatny: wejdą tylko osoby z tym linkiem.'}
            </p>

            {cyklicznyId && (
              <Link
                href={`/cykliczne/${cyklicznyId}`}
                className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800"
              >
                <Repeat className="h-4 w-4" /> Ustawiłeś powtarzanie co tydzień — zarządzaj serią
              </Link>
            )}
          </div>
        )}

        {/* ── HEADER: title + meta chips ── */}
        <div className="px-4">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {eventDisplayTitle(event)}
          </h1>
          {event.description && (
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-400">
              {event.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {/* My relation to this match — the two axes (ownership × participation)
                shown up front, so nobody has to expand the roster to learn
                whether they're actually in. */}
            {isOwner && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-700 px-3 py-1.5 text-xs font-bold text-white">
                <Star className="h-3.5 w-3.5" strokeWidth={2.25} /> Organizujesz
              </span>
            )}
            {myConfirmed && !myConfirmed.isReserve && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-800">
                <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
                Grasz{myConfirmed.isGoalkeeper ? ' · bramkarz' : ''}
              </span>
            )}
            {myConfirmed?.isReserve && (
              // Szary, nie bursztyn: bursztyn znaczy w tej apce „uwaga, coś się
              // dzieje" (obserwowanie, ostrzeżenia), a niebieski — „wymaga
              // akceptacji". Rezerwa to stan bierny: masz miejsce w kolejce,
              // nie w składzie. Jeden kolor dla wszystkich komunikatów o rezerwie
              // sprawia, że po kilku meczach sam kolor niesie informację.
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">
                <Clock className="h-3.5 w-3.5" strokeWidth={2.25} />
                Rezerwa{myReservePosition ? ` · ${myReservePosition}.` : ''}
                {myConfirmed.isGoalkeeper ? ' · bramkarz' : ''}
              </span>
            )}
            {myMaybe && (
              // Bursztyn — tak jak baner „Obserwujesz ten mecz" i przycisk
              // w dolnym pasku. Szary zwolnił się dla rezerwy, a obserwowanie
              // miało już swój kolor w dwóch innych miejscach tej samej strony.
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
                <Eye className="h-3.5 w-3.5" strokeWidth={2.25} /> Obserwujesz
              </span>
            )}
            {/* date — organizer edits it in place */}
            {isOrganizer && !eventStarted ? (
              <button
                type="button"
                onClick={openEditWhen}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
              >
                <Calendar className="h-3.5 w-3.5 text-slate-500" strokeWidth={2.25} />
                <span className="capitalize">{dateShort}</span> · {timeStr}
                <Pencil className="h-3 w-3 text-slate-400" strokeWidth={2.25} />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                <Calendar className="h-3.5 w-3.5 text-slate-500" strokeWidth={2.25} />
                <span className="capitalize">{dateShort}</span> · {timeStr}
              </span>
            )}
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
            {/* venue — the ADDRESS, not the name: most catalogue names are
                generic ("Boisko — piłka nożna") and say less than a street.
                Custom locations have no venue page, so they open a small modal
                with the address and directions instead of 404-ing. */}
            {venueBadgeLabel && (
              event.fieldId ? (
                <Link
                  href={`/boisko/${event.fieldId}?wroc=${encodeURIComponent(`/wydarzenia/${event.id}`)}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                >
                  <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" strokeWidth={2.25} />
                  <span className="truncate">{venueBadgeLabel}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setVenueInfoOpen(true)}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                >
                  <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" strokeWidth={2.25} />
                  <span className="truncate">{venueBadgeLabel}</span>
                </button>
              )
            )}
            {/* price — po starcie meczu ustępuje miejsca statusowi rozliczenia:
                cena "ile trzeba zapłacić" traci sens, gdy już się zapłaciło albo nie */}
            {!eventStarted ? (
              event.costGrosze > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <Tag className="h-3.5 w-3.5" strokeWidth={2.25} />
                  {(event.costGrosze / 100).toFixed(0)} zł / os.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                  <Tag className="h-3.5 w-3.5" strokeWidth={2.25} /> Za darmo
                </span>
              )
            ) : event.costGrosze > 0 ? (
              isOwner ? (() => {
                const unpaid = regulars.filter((p) => !p.hasPaid).length;
                return unpaid === 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.25} /> Rozliczono
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    <Banknote className="h-3.5 w-3.5" strokeWidth={2.25} /> {withCount(unpaid, 'osoba nie zapłaciła', 'osoby nie zapłaciły', 'osób nie zapłaciło')}
                  </span>
                );
              })() : myConfirmed && !myConfirmed.isReserve ? (
                myConfirmed.hasPaid ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.25} /> Zapłacono
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    <Clock className="h-3.5 w-3.5" strokeWidth={2.25} /> Zapłać
                  </span>
                )
              ) : null
            ) : null}
            {/* visibility — one tap toggles it for the organizer */}
            {isOrganizer ? (
              <button
                type="button"
                onClick={() => setVisOpen(true)}
                disabled={busy}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-50',
                  event.visibility === 'public'
                    ? 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                ].join(' ')}
              >
                {event.visibility === 'public'
                  ? <><Globe className="h-3.5 w-3.5" strokeWidth={2.25} /> Publiczne</>
                  : <><Lock className="h-3.5 w-3.5" strokeWidth={2.25} /> Prywatne</>}
                <Pencil className="h-3 w-3 opacity-60" strokeWidth={2.25} />
              </button>
            ) : (
              <span className={[
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
                event.visibility === 'public' ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-600',
              ].join(' ')}>
                {event.visibility === 'public'
                  ? <><Globe className="h-3.5 w-3.5" strokeWidth={2.25} /> Publiczne</>
                  : <><Lock className="h-3.5 w-3.5" strokeWidth={2.25} /> Prywatne</>}
              </span>
            )}
            {/* wymaga akceptacji — niebieski wyłącznie dla tego znaczenia,
                patrz sekcja 5 planu: bursztyn jest już zajęty przez rezerwę
                i obserwowanie, więc to jedyny kolor, który tu nic innego nie znaczy */}
            {!eventStarted && event.requireApproval && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                <UserPlus className="h-3.5 w-3.5" strokeWidth={2.25} /> Wymaga akceptacji
              </span>
            )}
            {/* stała gierka — jedyne przejście z meczu do panelu serii. Bez tego
                organizator, który wszedł na termin z listy, nie ma jak trafić
                do ustawień powtarzania. Tylko dla organizatora: `/cykliczne/[id]`
                i tak wpuszcza wyłącznie właściciela szablonu. */}
            {event.recurringEventId && isOwner && (
              <Link
                href={`/cykliczne/${event.recurringEventId}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
              >
                <Repeat className="h-3.5 w-3.5" strokeWidth={2.25} /> Stała gierka
              </Link>
            )}
            {/* group — edytowalne wyłącznie dla organizatora (dawniej schowane
                w "Zarządzaj wydarzeniem", teraz badge na widoku, otwiera
                WybierzGrupeDialog; patrz sekcja 6a planu). Dla pozostałych:
                widoczne tylko gdy grupa jest przypisana, sam link do niej. */}
            {isOwner ? (
              <button
                type="button"
                onClick={() => setGroupPickerOpen(true)}
                disabled={busy}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-50',
                  groupInfo ? 'bg-primary-50 text-primary-700 hover:bg-primary-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                ].join(' ')}
              >
                <Users className="h-3.5 w-3.5" strokeWidth={2.25} /> {groupInfo ? groupInfo.name : 'Dodaj do grupy'}
                <Pencil className="h-3 w-3 opacity-60" strokeWidth={2.25} />
              </button>
            ) : (
              groupInfo && (
                <Link
                  href={`/grupy/${groupInfo.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 transition hover:bg-primary-100"
                >
                  <Users className="h-3.5 w-3.5" strokeWidth={2.25} /> {groupInfo.name}
                </Link>
              )
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
                    canSeeBlikPhone({
                      isOrganizer: isOwner,
                      isInSquad: !!myParticipation,
                      minutesToStart: minutesUntilStart(event.date, event.time),
                    }) ? (
                      <> — BLIK na numer <span className="font-semibold text-ink">{event.blikPhone}</span></>
                    ) : myParticipation ? (
                      <> — numer do BLIKA zobaczysz na godzinę przed meczem</>
                    ) : (
                      <> — numer do BLIKA zobaczysz, jeśli dołączysz do składu</>
                    )
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
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-semibold text-blue-800">
                  Prośby o dołączenie
                  {pendingRequests.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-blue-200 px-1.5 py-0.5 text-[11px] font-bold text-blue-800">{pendingRequests.length}</span>
                  )}
                </p>
              </div>
              {pendingRequests.length === 0 && (
                <p className="text-sm text-blue-700/80">Na razie nikt nie czeka na akceptację.</p>
              )}
              <ul className="space-y-2">
                {pendingRequests.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 border border-blue-100">
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
                // Only pitch the reserve list to someone who could actually act on
                // it — a player already signed up (squad, reserve, pending or
                // observing) is told the match is full, not invited to join again.
                ? (amIInvolved ? 'Komplet' : 'Komplet — dołącz do rezerwy')
                : `Zostało ${withCount(freeSpots, 'wolne miejsce', 'wolne miejsca', 'wolnych miejsc')}`}
            </p>

            {/* Rozbicie na role. Sam licznik zbiorczy kłamał przez przemilczenie:
                „zostały 2 wolne miejsca" przy komplecie w polu znaczyło
                „2 miejsca dla bramkarzy", a zawodnik z pola i tak lądował na
                rezerwie — dowiadując się o tym dopiero po zapisaniu się. */}
            {gkEnabled && !isFull && (
              <p className="mt-1 text-center text-xs text-slate-500">
                {wolne.rozdzielone
                  ? <>
                      {wolne.pole > 0 ? `${wolne.pole} w polu` : 'pole: komplet'}
                      {' · '}
                      {wolne.bramkarze > 0
                        ? `${wolne.bramkarze} dla ${wolne.bramkarze === 1 ? 'bramkarza' : 'bramkarzy'}`
                        : 'bramkarze: komplet'}
                    </>
                  // Wspólna pula — miejsca nie są podzielone, więc licznik nie
                  // może ich rozdzielać. Jedyne ograniczenie to sufit bramkarzy.
                  : wolne.bramkarze > 0
                    ? `dla wszystkich ról, w tym do ${wolne.bramkarze} dla ${wolne.bramkarze === 1 ? 'bramkarza' : 'bramkarzy'}`
                    : 'bramkarze: komplet, miejsca tylko w polu'}
              </p>
            )}

            {/* Zapraszanie stoi tuż pod licznikiem wolnych miejsc, bo to tutaj
                człowiek orientuje się, że brakuje ludzi. Panel z linkiem jest
                na samym dole strony — zanim ktoś tam dojedzie, zdąży wyjść
                i wkleić link z Messengera.

                To jest teraz JEDYNY stały przycisk „Zaproś z grupy" na stronie —
                dolna sekcja „Zaproś znajomych" miała kiedyś własny, drugi
                przycisk o tej samej nazwie, innej ikonie i innym warunku
                widoczności (bez `!isFull`). Ikona ujednolicona na `Users`,
                bo tej samej używa panel „Mecz gotowy" tuż po publikacji. */}
            {user && !eventStarted && !isFull && (myParticipation || isOwner) && (
              <button
                onClick={() => setInviteOpen(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-800 hover:bg-primary-100"
              >
                <Users className="h-4 w-4" /> Zaproś z grupy
              </button>
            )}

            {/* Avatar stack — tap to expand. Hidden when roster is open.
                Rezerwa też otwiera listę: przy pustym składzie i kimś w kolejce
                (np. mecz 1v1, do którego organizator zapisał się na rezerwę)
                nie było czego kliknąć, więc rezerwowi byli niewidoczni. */}
            {regulars.length === 0 && reserves.length > 0 && !rosterRozwiniety && (
              <button
                type="button"
                onClick={() => setRosterOpen(true)}
                className="mt-5 flex w-full items-center justify-center gap-1.5 text-sm text-slate-500"
              >
                Nikt nie ma jeszcze miejsca w składzie · {withCount(reserves.length, 'osoba', 'osoby', 'osób')} na rezerwie
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
            )}
            {regulars.length > 0 && !rosterRozwiniety && (
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
            {regulars.length === 0 && reserves.length === 0 && (
              <p className="mt-5 text-center text-sm text-slate-400">Nikt jeszcze nie dołączył — bądź pierwszy!</p>
            )}

            {/* Roster — replaces avatar row when open */}
            {(regulars.length > 0 || reserves.length > 0 || isOwner) && rosterRozwiniety && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {withCount(regulars.length, 'gracz', 'gracze', 'graczy')}
                    {reserves.length > 0 && ` · ${reserves.length} na rezerwie`}
                  </span>
                  {!(isOwner && !eventStarted) && (
                    <button
                      type="button"
                      onClick={() => setRosterOpen(false)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <ChevronDown className="h-3.5 w-3.5 rotate-180" /> Zwiń
                    </button>
                  )}
                </div>
                {/* Sygnał do organizatora: skoro przycisk „Zaproś do Bojo" żyje
                    przy pojedynczym wierszu gościa, łatwo go nie zauważyć,
                    zwłaszcza po meczu, gdy skład jest zwinięty do samej listy
                    (`ParticipantsList` niżej). Jedna linia nad składem, licząca
                    i skład, i rezerwę — gość na rezerwie też może przejąć wpis. */}
                {isOrganizer && niePrzejeciGoscie.length > 0 && (
                  <p className="mb-3 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-800">
                    {withCount(niePrzejeciGoscie.length, 'gość', 'goście', 'gości')} bez konta w składzie —
                    kliknij „Zaproś do Bojo" przy imieniu. Po założeniu konta dołączą do ekipy
                    i dostaną powiadomienie o kolejnym meczu.
                  </p>
                )}
                {/* Organizator dostaje tu listę z kontrolkami zamiast osobnej
                    karty „Skład". Dwie sekcje mówiące to samo — licznik na
                    górze i lista niżej — kazały szukać, w której z nich
                    właściwie się jest. */}
                {isOwner && !eventStarted ? (
                  <>
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
                        {gkEnabled && <RolaGracza bramkarz={!!p.isGoalkeeper} />}
                        {p.userId === event.organizerId && <span className="text-xs text-primary-600 shrink-0">• org.</span>}
                        {p.isCaptain && <span title="Kapitan"><Star className="w-3 h-3 text-amber-500 shrink-0" /></span>}
                        {showTeams && p.team && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-bold shrink-0 ${TEAM_COLOR_CLASSES[p.team].pill}`}>
                            {TEAM_LETTERS[p.team]}
                          </span>
                        )}
                        {golyMap[p.id] > 0 && (
                          <span className="text-xs font-semibold text-slate-500 shrink-0">⚽ {golyMap[p.id]}</span>
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
                      {/* Gość może przejąć swój wpis po założeniu konta —
                          link jest jednorazowy i wędruje kanałem, który wybierze
                          wysyłający. Dopasowanie po imieniu byłoby fałszywą
                          tożsamością: na osiedlowym meczu bywa trzech Marków,
                          a przejęcie cudzego wpisu to cudze miejsce w składzie
                          i cudza historia gier.

                          Wysłać może też ten, kto gościa dopisał (`allowGuestAdds`
                          pozwala każdemu uczestnikowi), nie tylko organizator —
                          to on zna gościa i ma z nim kontakt, organizator często
                          nie. */}
                      {mozeZaprosic(p) && p.isGuest && p.claimToken && (
                        <button
                          type="button"
                          onClick={() => kopiujLinkPrzejecia(p)}
                          className="mt-1 inline-flex items-center gap-1 self-start text-[11px] font-medium text-primary-700 hover:underline"
                        >
                          <LinkIcon className="h-3 w-3" />
                          {skopiowanyToken === p.id ? 'Skopiowano link' : 'Zaproś do Bojo'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
                {regulars.length === 0 && (
                  <li className="py-4 text-sm text-slate-400 text-center">
                    {reserves.length > 0 ? 'Nikt nie ma jeszcze miejsca w składzie' : 'Nikt jeszcze nie dołączył'}
                  </li>
                )}
              </ul>

              {/* Rezerwa siedzi w tej samej liście co skład, a nie w osobnej
                  karcie na dole strony. Przy pustym składzie osobna karta dawała
                  sprzeczny obraz: „nikt jeszcze nie dołączył" tuż nad listą osób,
                  które dołączyły. Numer to pozycja w kolejce — ta sama, którą
                  `sync_reserve_claim` obchodzi przy zwolnionym miejscu. */}
              {reserves.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Rezerwa — kolejka do zwolnionego miejsca
                  </p>
                  <ul className="divide-y divide-slate-100">
                    {reserves.map((p, i) => (
                      <li key={p.id} className="flex items-start justify-between gap-2 py-2.5">
                        <div className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">{i + 1}</span>
                            <span className="min-w-0 truncate">{p.name}</span>
                            {gkEnabled && <RolaGracza bramkarz={!!p.isGoalkeeper} wariant="maly" />}
                            {p.isGuest && <span className="shrink-0 text-xs text-slate-400">(gość)</span>}
                            {p.claimOfferedAt && (
                              <span title="Zaproponowano zwolnione miejsce — czeka na decyzję" className="shrink-0 rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                                czeka na decyzję
                              </span>
                            )}
                            {p.claimPassed && !p.claimOfferedAt && (
                              <span title="Odpuścił(a) miejsce albo nie zdążył(a) — możesz awansować ręcznie" className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                przepuścił(a)
                              </span>
                            )}
                          </span>
                          {/* Ta sama atrybucja i przycisk co przy graczach w składzie
                              (patrz regulars.map wyżej) — gość na rezerwie też ma kogoś,
                              kto go dodał, i też może przejąć swój wpis. */}
                          {p.isGuest && p.addedBy && (() => {
                            const adderName = participants.find((x) => x.userId === p.addedBy)?.name
                              ?? (p.addedBy === event.organizerId ? event.organizerName : undefined)
                              ?? 'innego gracza';
                            return (
                              <span className="ml-9 mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-200 text-[8px] font-bold text-slate-600 shrink-0">
                                  {adderName.charAt(0).toUpperCase()}
                                </span>
                                dodał(a): <span className="font-medium text-slate-500 truncate">{adderName}</span>
                              </span>
                            );
                          })()}
                          {mozeZaprosic(p) && p.isGuest && p.claimToken && (
                            <button
                              type="button"
                              onClick={() => kopiujLinkPrzejecia(p)}
                              className="ml-9 mt-1 inline-flex items-center gap-1 self-start text-[11px] font-medium text-primary-700 hover:underline"
                            >
                              <LinkIcon className="h-3 w-3" />
                              {skopiowanyToken === p.id ? 'Skopiowano link' : 'Zaproś do Bojo'}
                            </button>
                          )}
                        </div>
                        <span className="flex shrink-0 items-center gap-1">
                          {/* Ręczny awans — poza kolejnością i niezależnie od
                              tego, czy miejsce się zwolniło. Bez tego jedyną
                              drogą było usunięcie wpisu i dopisanie tej samej
                              osoby od nowa, co gubi jej konto, historię
                              i deklarację płatności. */}
                          {isOrganizer && !eventStarted && (
                            <button
                              onClick={() => handleAwans(p)}
                              disabled={busy}
                              className="shrink-0 rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-[11px] font-semibold text-primary-800 transition-colors hover:bg-primary-100 disabled:opacity-50"
                              title="Przenieś do składu"
                            >
                              Do składu
                            </button>
                          )}
                          {p.userId === user?.id ? (
                            <button onClick={() => handleRemove(p.id)} disabled={busy} className="shrink-0 rounded p-1.5 text-slate-400 hover:text-red-500" title="Zrezygnuj z rezerwy">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : isOrganizer && (
                            <button onClick={() => handleRemovePlayer(p)} disabled={busy} className="shrink-0 rounded p-1.5 text-slate-400 hover:text-red-500" title="Usuń z rezerwy">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
                    <Button variant="outline" onClick={handleAddGuest} disabled={busy || !guestName.trim()} className="shrink-0">
                      <UserPlus className="w-4 h-4" /> Dodaj
                    </Button>
                  </div>
                  {gkEnabled && (
                    <div className="mt-2 flex gap-2">
                      {([['field', 'Zawodnik z pola'], ['gk', '🧤 Bramkarz']] as const).map(([r, label]) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setGuestIsGk(r === 'gk')}
                          className={[
                            'rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                            (r === 'gk') === guestIsGk
                              ? 'border-primary-600 bg-primary-50 text-primary-700'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-slate-400">
                    Dopisujesz gracza ręcznie. Jeśli ma dołączyć sam — wyślij mu link
                    przyciskiem „Udostępnij" na górze strony.
                  </p>
                </div>
              )}
                  </>
                ) : (
                  <ParticipantsList
                    regulars={regulars}
                    reserves={reserves}
                    gkEnabled={gkEnabled}
                    mozeZaprosic={mozeZaprosic}
                    skopiowanyToken={skopiowanyToken}
                    onZaprosDoBojo={kopiujLinkPrzejecia}
                    golyMap={golyMap}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── "WYPISZ SIĘ" — inline, nie w sticky ── */}
        {user && myParticipation && !eventStarted && (
          <div className="px-4">
            {!isOrganizer && event.allowGuestAdds && (
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-600 mb-1.5">Dopisz osobę bez konta</p>
                <div className="flex gap-2">
                  <input
                    type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
                    placeholder="Imię znajomego"
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <Button variant="outline" onClick={handleAddGuest} disabled={busy || !guestName.trim()} className="shrink-0">
                    <UserPlus className="w-4 h-4" /> Dodaj
                  </Button>
                </div>
                {gkEnabled && (
                  <div className="mt-2 flex gap-2">
                    {([['field', 'Zawodnik z pola'], ['gk', '🧤 Bramkarz']] as const).map(([r, label]) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setGuestIsGk(r === 'gk')}
                        className={[
                          'rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                          (r === 'gk') === guestIsGk
                            ? 'border-primary-600 bg-primary-50 text-primary-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-slate-400">
                  Dopisujesz gracza ręcznie. Jeśli ma dołączyć sam — wyślij mu link
                  przyciskiem „Udostępnij" na górze strony.
                </p>
              </div>
            )}
            <button
              onClick={() => setLeaveConfirmOpen(true)} disabled={busy}
              className="w-full h-11 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
            >
              {amIReserve ? 'Wypisz się z rezerwy' : 'Wypisz się z meczu'}
            </button>
          </div>
        )}

        {/* ── OCZEKUJESZ NA AKCEPTACJĘ — gdy wysłałeś prośbę o dołączenie ── */}
        {user && myPendingRequest && !eventStarted && (
          <div className="px-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-800">Oczekujesz na akceptację</p>
                  {/* „Skąd będę wiedział, że zaakceptował?" — bez tego zdania
                      jedyną odpowiedzią było wchodzenie i sprawdzanie. */}
                  <p className="text-xs text-blue-600">
                    Organizator musi zatwierdzić Twoją prośbę o dołączenie. Gdy to zrobi, dostaniesz
                    powiadomienie w Bojo, pod dzwonkiem.
                  </p>
                </div>
                <button
                  onClick={() => handleReject(myPendingRequest.id)}
                  disabled={busy}
                  className="shrink-0 rounded-xl border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── JESTEM NA REZERWIE — co to znaczy i co się musi stać ──
            Sam badge „Rezerwa · 3." mówi, GDZIE jestem, ale nie mówi, czego
            mam się spodziewać. Bez tego jedyne wyjście to pytać organizatora
            albo wchodzić i sprawdzać — czyli dokładnie to, co aplikacja miała
            zdjąć z głowy. */}
        {amIReserve && !myClaimOffer && !eventStarted && (
          <div className="px-4">
            <div className="rounded-2xl border border-slate-300 bg-slate-100 p-4">
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" strokeWidth={2.25} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">
                    Jesteś na liście rezerwowej
                    {myReservePosition ? ` — ${myReservePosition}. w kolejce` : ''}
                    {myConfirmed?.isGoalkeeper ? ' · jako bramkarz' : ''}
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                    <li>
                      <span className="font-semibold">Nie masz miejsca w składzie.</span>{' '}
                      Wejdziesz, gdy ktoś zapisany się wypisze.
                    </li>
                    <li>
                      Wtedy Bojo{' '}
                      <span className="font-semibold">
                        zaproponuje miejsce pierwszej osobie z kolejki
                      </span>
                      {myReservePosition && myReservePosition > 1
                        ? ` — przed Tobą ${myReservePosition - 1} ${myReservePosition === 2 ? 'osoba' : 'osoby'}.`
                        : ' — czyli Tobie.'}
                    </li>
                    <li>
                      Na przyjęcie miejsca masz{' '}
                      <span className="font-semibold">{event.reserveClaimHours} h</span>; po tym czasie
                      przechodzi do kolejnej osoby.
                    </li>
                    <li>
                      Powiadomienie zobaczysz w Bojo, pod dzwonkiem.{' '}
                      <span className="font-semibold">Nie wysyłamy jeszcze e-maili ani SMS-ów</span> —
                      warto zajrzeć przed meczem.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── OFERTA MIEJSCA Z REZERWY — tylko dla osoby, której dotyczy ── */}
        {myClaimOffer && !eventStarted && (
          <div className="px-4">
            <div className="rounded-2xl border-2 border-green-300 bg-green-50 p-4">
              <p className="text-sm font-bold text-green-900">Zwolniło się miejsce — jesteś następny!</p>
              <p className="mt-0.5 text-xs text-green-800">
                {claimDeadline
                  ? <>Masz czas do <span className="font-semibold">{format(claimDeadline, 'EEEE HH:mm', { locale: pl })}</span>. Później miejsce przejdzie do kolejnej osoby.</>
                  : <>Potwierdź, żeby wejść do składu.</>}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleAcceptClaim}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-primary-700 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-primary-800 disabled:opacity-50"
                >
                  Wchodzę
                </button>
                <button
                  onClick={handleDeclineClaim}
                  disabled={busy}
                  className="rounded-xl border border-green-300 px-3 py-2.5 text-sm font-medium text-green-800 transition hover:bg-green-100 disabled:opacity-50"
                >
                  Odpuszczam
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── OBSERVING BANNER — RSVP "maybe": watching, not signed up ── */}
        {user && myMaybe && !eventStarted && (
          <div className="px-4">
            {/* Stacked, not side-by-side: on a phone the two buttons next to
                a two-line paragraph wrapped into a mess. */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
              <div className="flex items-start gap-2.5">
                <Eye className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={2.25} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Obserwujesz ten mecz</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Nie masz zajętego miejsca — dołącz, gdy będziesz pewny.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => { setJoinRole('player'); setJoinAsReserve(false); setJoinDialogOpen(true); }}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-primary-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-primary-800 transition disabled:opacity-50"
                >
                  Dołącz
                </button>
                <button
                  onClick={() => { setLeaveConfirmOpen(true); }}
                  disabled={busy}
                  className="rounded-xl border border-amber-300 dark:border-amber-700 px-3 py-2.5 text-sm font-medium text-amber-800 dark:text-amber-400 hover:bg-amber-100 transition"
                >
                  Przestań
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STICKY JOIN BAR ──
            Stays visible while merely OBSERVING: "Obserwuj" used to swap the
            whole bar away, so anyone who watched first had to hunt for a way
            to actually join. Now "Dołącz" holds its place until you're in, and
            the second button just reports the state you're already in. */}
        {joinBarVisible && <HideBottomNav />}
        {joinBarVisible && (
          <div className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-100 dark:border-slate-700 bg-canvas/90 px-4 pb-6 pt-3 backdrop-blur-md">
            <div className="mx-auto max-w-2xl">
              {!authLoading && !user ? (
                <button
                  onClick={() => {
                    const powrot = `${window.location.pathname}?dolacz=1`;
                    window.location.href = `/logowanie?next=${encodeURIComponent(powrot)}`;
                  }}
                  className="flex h-12 w-full items-center justify-center rounded-2xl bg-accent-500 text-[15px] font-bold text-primary-950 transition active:scale-[0.99]"
                >
                  Zaloguj się, aby dołączyć
                </button>
              ) : user && !isFull ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setJoinRole('player'); setJoinAsReserve(false); setJoinDialogOpen(true); }}
                    disabled={busy}
                    className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-accent-500 text-[15px] font-bold text-primary-950 transition active:scale-[0.99] disabled:opacity-50"
                  >
                    Dołącz →
                  </button>
                  {myMaybe ? (
                    <button
                      onClick={() => setLeaveConfirmOpen(true)}
                      disabled={busy}
                      className="flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-amber-300 bg-amber-50 px-5 text-[14px] font-semibold text-amber-800 transition active:scale-[0.99] disabled:opacity-50"
                    >
                      <Eye className="h-4 w-4" strokeWidth={2.25} /> Obserwujesz
                    </button>
                  ) : (
                    <button
                      onClick={handleMaybe}
                      disabled={busy}
                      className="flex h-12 items-center justify-center rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-5 text-[14px] font-semibold text-slate-600 dark:text-slate-300 transition active:scale-[0.99] disabled:opacity-50"
                    >
                      Obserwuj
                    </button>
                  )}
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

        {/* ── ZARZĄDZANIE GRACZAMI (organizer only) — usuwanie, celowo osobno
            od reszty i zawsze z potwierdzeniem, zeby nic nie znikneło przez
            przypadkowe klikniecie w gestej liscie. ── */}
        {isOwner && !eventStarted && regulars.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h2 className="font-semibold text-ink flex items-center gap-2 mb-1">
              <Trash2 className="w-4 h-4 text-slate-400" /> Zarządzanie graczami
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              „Na rezerwę" zostawia gracza w meczu, bez miejsca w składzie. Usuwanie zawsze
              wymaga potwierdzenia.
            </p>
            <ul className="divide-y divide-slate-100">
              {regulars.filter((p) => p.userId !== event.organizerId).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 py-3 sm:flex-nowrap sm:gap-3">
                  {p.avatarUrl
                    ? <img src={p.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    : <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold shrink-0">{p.name.charAt(0).toUpperCase()}</span>
                  }
                  {/* `basis-0 grow` z `min-w-0`: imię ma oddać szerokość
                      przyciskom, a na wąskim ekranie zepchnąć je do drugiego
                      wiersza zamiast rozpychać kartę. */}
                  <span className="min-w-0 flex-1 basis-0 truncate text-sm text-ink">{p.name}</span>
                  <button
                    onClick={() => handleRemovePlayer(p)}
                    disabled={busy}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Usuń
                  </button>
                  {/* „Na rezerwę" zamiast usuwania: gracz zostaje w meczu,
                      tylko bez miejsca w składzie. Usunięcie to koniec —
                      musiałby zapisać się od nowa i wylądować na końcu
                      kolejki, tracąc deklarację płatności. */}
                  <button
                    onClick={() => handleCofnijNaRezerwe(p)}
                    disabled={busy}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
                    title="Przenieś na listę rezerwową"
                  >
                    <Clock className="w-3.5 h-3.5" /> Na rezerwę
                  </button>
                </li>
              ))}
              {regulars.filter((p) => p.userId !== event.organizerId).length === 0 && (
                <li className="py-4 text-sm text-slate-400 text-center">Nikt poza Tobą jeszcze nie dołączył</li>
              )}
            </ul>
          </div>
        )}

        {/* Po starcie meczu rozliczenie idzie nad składem/wynikiem — treść
            obu sekcji zdefiniowana wyżej (skladWynikSection/platnosciSection),
            tu zmienia się wyłącznie kolejność. */}
        {eventStarted ? (
          <>{platnosciSection}{skladWynikSection}</>
        ) : (
          <>{skladWynikSection}{platnosciSection}</>
        )}

        {/* Comments — only for participants */}
        {myParticipation && <EventComments eventId={event.id} />}

        {/* Organizer controls — hidden until "Edytuj" so they don't clutter the
            page or invite accidental clicks on cancel/delete. `isOwner`, NOT
            `isOrganizer` — an admin looking at someone else's match must not
            see a shortcut into managing/deleting it. */}
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
                    onChange={() => handleSetVisibility(event.visibility === 'public' ? 'private' : 'public')}
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

        {/* ── Zaproś znajomych — tylko dla uczestników ──
            Warunek nie zależy już od `event.joinCode`: link jest kanoniczny,
            więc panel ma sens także przy meczach sprzed migracji 041.

            Sekcja miała kiedyś WŁASNY przycisk „Zaproś z grupy" nad panelem
            linku — drugi na tej samej stronie, z inną ikoną i innym warunkiem
            widoczności niż ten przy liczniku wolnych miejsc (`O-20` w audycie
            ścieżki organizatora). Jedyny stały punkt imiennego zaproszenia
            jest teraz tam, tuż pod licznikiem — tutaj zostaje wyłącznie
            udostępnianie linku. */}
        {!isCancelled && (myParticipation || isOwner) && (
          <div className="px-4">
            <ZaprosZnajomychPanel event={event} />
          </div>
        )}

        {/* Kogo zaprosiłem, kto odpowiedział — dotąd nigdzie tego nie było
            widać, mimo że `dismissed_at` istnieje w bazie od migracji 060.
            Tylko organizator: RLS na `event_player_invites` i tak nie
            przepuści reszty. `joinedUserIds` liczone z uczestnictwa, które
            strona ma już wczytane — zero dodatkowego zapytania o skład. */}
        {isOwner && (
          <div className="px-4">
            <EventInvitesStatus
              eventId={event.id}
              joinedUserIds={new Set(participants.map((p) => p.userId).filter((id): id is string => !!id))}
            />
          </div>
        )}

        {inviteOpen && user && (
          <InviteFromGroupDialog
            eventId={event.id}
            userId={user.id}
            participantUserIds={participants.map((p) => p.userId).filter((id): id is string => !!id)}
            onClose={() => setInviteOpen(false)}
            onInvited={(count) => {
              setInviteOpen(false);
              toast(count === 0 ? 'Wszyscy wybrani mieli już zaproszenie' : `Zaproszono ${count}`);
            }}
          />
        )}

        {groupPickerOpen && user && (
          <WybierzGrupeDialog
            userId={user.id}
            wybranaId={groupInfo?.id}
            onWybierz={(g) => { setGroupPickerOpen(false); handleSetGroup(g?.id ?? ''); }}
            onClose={() => setGroupPickerOpen(false)}
          />
        )}

        {zakresTerminuOtwarty && (
          <ZakresEdycjiSerii
            liczbaTerminow={seriaTerminy.length}
            liczbaPrzyszlych={
              terminyWZakresie(seriaTerminy, event.id, 'ten-i-przyszle', new Date().toLocaleDateString('sv-SE')).length
            }
            busy={busy}
            onWybierz={zapiszTermin}
            onClose={() => setZakresTerminuOtwarty(false)}
          />
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

      {/* Reschedule — opened from the date chip. Two gates when people are
          already signed up: the save button first asks for a tick, because a
          moved match that nobody noticed is worse than no match. */}
      {whenOpen && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center ${WARSTWA.modal} p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`}
          onClick={() => setWhenOpen(false)}
        >
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setWhenOpen(false)}
              aria-label="Zamknij"
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="mb-4 pr-8 font-semibold text-ink">Zmień termin</h3>

            <label className="mb-1 block text-sm font-medium text-slate-700">Data</label>
            <input
              type="date"
              value={whenDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => { setWhenDate(e.target.value); setWhenConfirm(false); }}
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Rozpoczęcie</label>
                <TimeSelect
                  value={whenTime}
                  onChange={(v) => {
                    // Przesuwamy koniec o tę samą deltę, żeby czas gry się nie
                    // zmienił — TYLKO gdy koniec jest w ogóle ustawiony. Zmiana
                    // końca (pole obok) nigdy nie rusza początku — jednokierunkowe
                    // celowo.
                    if (whenEnd) {
                      const diff = toMinutes(v) - toMinutes(whenTime);
                      const nowyKoniec = toMinutes(whenEnd) + diff;
                      if (nowyKoniec >= 0 && nowyKoniec < 24 * 60) setWhenEnd(fromMinutes(nowyKoniec));
                    }
                    setWhenTime(v);
                    setWhenConfirm(false);
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Zakończenie</label>
                <TimeSelect value={whenEnd} allowEmpty onChange={setWhenEnd} />
              </div>
            </div>

            {confirmed.length > 0 && (
              <label className="mb-4 flex cursor-pointer select-none items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <input
                  type="checkbox"
                  checked={whenConfirm}
                  onChange={(e) => setWhenConfirm(e.target.checked)}
                  className="mt-0.5 rounded border-amber-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-xs text-amber-800">
                  Wiem, że <span className="font-semibold">
                    {withCount(confirmed.length, 'osoba jest zapisana', 'osoby są zapisane', 'osób jest zapisanych')}
                  </span> na stary termin. Dostaną powiadomienie o zmianie.
                </span>
              </label>
            )}

            <Button
              onClick={handleSaveWhen}
              isLoading={busy}
              disabled={!whenDate || !whenTime || (confirmed.length > 0 && !whenConfirm)}
              className="w-full"
            >
              Zapisz termin
            </Button>
          </div>
        </div>
      )}

      {visOpen && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center ${WARSTWA.modal} p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`}
          onClick={() => setVisOpen(false)}
        >
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setVisOpen(false)}
              aria-label="Zamknij"
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="mb-1 pr-8 font-semibold text-ink">Kto widzi ten mecz</h3>
            <p className="mb-4 text-xs text-slate-500">
              Zmiana działa od razu — także dla osób, które już mają link.
            </p>

            <div className="space-y-2">
              {([
                {
                  value: 'public' as const,
                  icon: <Globe className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={2.25} />,
                  label: 'Publiczne',
                  desc: 'Widoczne na liście meczów, każdy zalogowany może dołączyć.',
                },
                {
                  value: 'private' as const,
                  icon: <Lock className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={2.25} />,
                  label: 'Prywatne',
                  desc: 'Nie pojawia się na liście. Wchodzą zaproszeni, grupa i osoby z linkiem lub kodem.',
                },
              ]).map((opt) => {
                const wybrane = event.visibility === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSetVisibility(opt.value)}
                    disabled={busy}
                    className={[
                      'flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition-colors disabled:opacity-60',
                      wybrane
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-slate-300 hover:border-slate-400',
                    ].join(' ')}
                  >
                    {opt.icon}
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                        {opt.label}
                        {wybrane && <Check className="h-3.5 w-3.5 text-primary-600" strokeWidth={3} />}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">{opt.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {event.visibility === 'public' && confirmed.length > 0 && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Na mecz zapisało się już{' '}
                <span className="font-semibold">
                  {withCount(confirmed.length, 'osoba', 'osoby', 'osób')}
                </span>
                . Zmiana na prywatny nikogo nie wypisuje — po prostu nowi nie znajdą meczu na liście.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Venue details for a hand-typed location — it has no venue page, so the
          address and directions live in a small modal instead of a dead chip. */}
      {venueInfoOpen && (
        <div
          className={`fixed inset-0 ${WARSTWA.modal} flex items-end justify-center bg-black/50 p-4 sm:items-center`}
          onClick={() => setVenueInfoOpen(false)}
        >
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setVenueInfoOpen(false)}
              aria-label="Zamknij"
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="mb-1 pr-8 font-semibold text-ink">{eventLoc.primary}</h3>
            {eventLoc.secondary && <p className="text-sm text-slate-500">{eventLoc.secondary}</p>}
            <p className="mt-3 text-xs text-slate-400">
              Miejsce wpisane ręcznie przez organizatora — nie ma go w katalogu boisk.
            </p>
            {event.lat && event.lng && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-bold text-white transition active:scale-95"
              >
                <Navigation className="h-4 w-4" strokeWidth={2.25} /> Nawiguj
              </a>
            )}
          </div>
        </div>
      )}

      {/* Leave confirmation */}
      {leaveConfirmOpen && myEntry && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center ${WARSTWA.modal} p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`}
          onClick={() => setLeaveConfirmOpen(false)}
        >
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Explicit close: tapping the backdrop already cancels, but that's
                invisible — and "Zostań" as the only way out reads like a trap. */}
            <button
              type="button"
              onClick={() => setLeaveConfirmOpen(false)}
              aria-label="Zamknij"
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="font-semibold text-ink mb-1 pr-8">
              {myMaybe ? 'Przestać obserwować?' : amIReserve ? 'Wypisać się z rezerwy?' : 'Wypisać się z meczu?'}
            </h3>
            <p className="text-sm text-slate-500 mb-5">
              {myMaybe
                ? 'Mecz zniknie z Twoich meczów. Możesz zacząć obserwować ponownie.'
                : amIReserve
                  ? 'Znikniesz z listy rezerwowej i nie dostaniesz propozycji, gdy zwolni się miejsce. Możesz zapisać się ponownie, ale na koniec kolejki.'
                  : 'Twoje miejsce zwolni się i może je zająć ktoś z listy rezerwowej.'}
            </p>
            <div className="space-y-2">
              <Button
                onClick={() => { setLeaveConfirmOpen(false); handleRemove(myEntry.id); }}
                isLoading={busy}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {myMaybe ? 'Przestań obserwować' : 'Wypisz mnie'}
              </Button>
              {/* Leaving is rarely "I'm out for good" — usually it's "not sure
                  any more". Observing keeps the match in their list instead of
                  dropping it out of sight entirely. */}
              {!myMaybe && (
                <Button
                  variant="outline"
                  onClick={() => { setLeaveConfirmOpen(false); handleLeaveAndObserve(myEntry.id); }}
                  disabled={busy}
                  className="w-full"
                >
                  <Eye className="h-4 w-4" /> Wypisz mnie, ale obserwuj
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Join confirmation — role choice + explicit confirm so nobody signs up by accident */}
      {joinDialogOpen && user && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center ${WARSTWA.modal} p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`}
          onClick={() => setJoinDialogOpen(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-1">
              {joinAsReserve ? 'Zapisać się na listę rezerwową?' : 'Zapisać się na mecz?'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {sportEmoji(event.sport)} {eventDisplayTitle(event)}
              {eventLoc.primary ? ` · ${eventLoc.primary}` : ''}
            </p>

            {event.requireApproval && !joinAsReserve && !isOwner && (
              <p className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700">
                Organizator musi zaakceptować Twoją prośbę, zanim wejdziesz do składu.
              </p>
            )}

            {/* Komplet w WYBRANEJ roli — zanim ktoś kliknie „Zapisz mnie".
                Bez tego jedyną informacją o rezerwie był komunikat po zapisie,
                a przy meczu z bramkarzami licznik „zostały 2 miejsca" mógł
                dotyczyć wyłącznie drugiej roli. */}
            {!event.requireApproval && rolaPelna && (
              <p className="mb-4 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">
                {joinRole === 'goalkeeper'
                  ? 'Bramkarze mają już komplet.'
                  : gkEnabled ? 'W polu jest już komplet.' : 'Mecz ma już komplet.'}
                {' '}Zapiszesz się na <span className="font-bold">listę rezerwową</span> jako{' '}
                <span className="font-bold">{pozycjaWKolejce}.</span> w kolejce — wejdziesz, gdy ktoś się wypisze.
              </p>
            )}

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

            {brakWyboruPlatnosci && (
              <p className="mb-2 text-center text-xs font-medium text-slate-500">
                Wybierz sposób płatności, żeby się zapisać.
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setJoinDialogOpen(false)} className="flex-1">
                Anuluj
              </Button>
              <Button
                onClick={() => { setJoinDialogOpen(false); handleJoin(joinRole === 'goalkeeper'); }}
                isLoading={busy}
                disabled={brakWyboruPlatnosci}
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
          className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center ${WARSTWA.modal} p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`}
          onClick={() => setRepeatOpen(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-1">Powtórz mecz</h3>
            <p className="text-sm text-slate-500 mb-4">
              Skopiuje wszystkie ustawienia do nowego wydarzenia. Wybierz nową datę i godzinę —
              resztę, np. cenę czy widoczność, zmienisz później na nowo utworzonym wydarzeniu.
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
              {gkEnabled && repeatJoin && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">Twoja rola</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRepeatRole('player')}
                      className={[
                        'h-10 rounded-xl border text-sm font-semibold transition-colors',
                        repeatRole === 'player'
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300',
                      ].join(' ')}
                    >
                      ⚽ Zawodnik
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepeatRole('goalkeeper')}
                      className={[
                        'h-10 rounded-xl border text-sm font-semibold transition-colors',
                        repeatRole === 'goalkeeper'
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300',
                      ].join(' ')}
                    >
                      🧤 Bramkarz
                    </button>
                  </div>
                </div>
              )}
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
          className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center ${WARSTWA.modal} p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`}
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
    </div>
  );
}
