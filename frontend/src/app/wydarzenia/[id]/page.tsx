'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Calendar, Clock, MapPin, Users, UserPlus, Trash2, Lock, Globe, Share2,
  Check, X, Pencil, Banknote, Shuffle,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { venueThumbnail } from '@/lib/labels';
import {
  getEvent, joinEvent, addGuest, removeParticipant, setVisibility, deleteEvent, togglePayment,
} from '@/lib/events';
import type { EventItem, EventParticipant } from '@/types';

const SPORT_EMOJI: Record<string, string> = {
  'piłka nożna': '⚽', koszykówka: '🏀', siatkówka: '🏐',
  'siatkówka plażowa': '🏖️', tenis: '🎾', futsal: '⚡', 'piłka ręczna': '🤾', inne: '🏅',
};

const TEAM_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
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
  const shuffled = shuffle(players);
  const mid = Math.ceil(shuffled.length / 2);
  return [shuffled.slice(0, mid), shuffled.slice(mid)];
}

function StatusBadge({ regulars, max }: { regulars: number; max: number }) {
  const left = max - regulars;
  if (left <= 0) {
    return (
      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-red-100 text-red-700">
        Pełne
      </span>
    );
  }
  if (left <= 3) {
    return (
      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-700">
        Brakuje {left}
      </span>
    );
  }
  return (
    <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-green-100 text-green-700">
      Wolne
    </span>
  );
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const isAdmin = useAdmin();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [copied, setCopied] = useState(false);
  const [teams, setTeams] = useState<[EventParticipant[], EventParticipant[]] | null>(null);

  const load = useCallback(async () => {
    try {
      const { event: ev, participants: parts } = await getEvent(id);
      setEvent(ev);
      setParticipants(parts);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

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
  const isFull = regulars.length >= event.maxPlayers;

  let dateStr = event.date;
  try { dateStr = format(parseISO(event.date), 'EEEE, d MMMM yyyy', { locale: pl }); } catch {}

  const handleJoin = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await joinEvent(event.id, user.id, displayName(user));
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : 'Błąd'); }
    finally { setBusy(false); }
  };

  const handleAddGuest = async () => {
    if (!guestName.trim()) return;
    setBusy(true);
    try {
      await addGuest(event.id, guestName.trim());
      setGuestName('');
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : 'Błąd'); }
    finally { setBusy(false); }
  };

  const handleRemove = async (participantId: string) => {
    setBusy(true);
    try { await removeParticipant(participantId); await load(); setTeams(null); }
    catch (e) { alert(e instanceof Error ? e.message : 'Błąd'); }
    finally { setBusy(false); }
  };

  const handleTogglePayment = async (p: EventParticipant) => {
    setBusy(true);
    try { await togglePayment(p.id, !p.hasPaid); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Błąd'); }
    finally { setBusy(false); }
  };

  const handleToggleVisibility = async () => {
    setBusy(true);
    try {
      await setVisibility(event.id, event.visibility === 'public' ? 'private' : 'public');
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : 'Błąd'); }
    finally { setBusy(false); }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title || event.sport, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* user cancelled */ }
  };

  const handleDelete = async () => {
    if (!confirm('Na pewno usunąć to wydarzenie?')) return;
    setBusy(true);
    try { await deleteEvent(event.id); router.push('/wydarzenia'); }
    catch (e) { alert(e instanceof Error ? e.message : 'Błąd'); setBusy(false); }
  };

  const handleDrawTeams = () => {
    setTeams(splitTeams(regulars));
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-4">

        {/* Header card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {venueThumbnail(event.lat, event.lng, 600, 200) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={venueThumbnail(event.lat, event.lng, 600, 200)!}
              alt={event.fieldName}
              className="w-full h-40 object-cover"
            />
          )}
          <div className="p-6">
            <div className="flex items-start gap-3">
              <span className="text-4xl" role="img">{SPORT_EMOJI[event.sport] ?? '🏅'}</span>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900">{event.title || event.sport}</h1>
                <p className="text-sm text-gray-500 capitalize">{event.sport}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={[
                  'text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1',
                  event.visibility === 'public' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600',
                ].join(' ')}>
                  {event.visibility === 'public'
                    ? <><Globe className="w-3 h-3" /> Publiczne</>
                    : <><Lock className="w-3 h-3" /> Prywatne</>}
                </span>
                <StatusBadge regulars={regulars.length} max={event.maxPlayers} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="capitalize">{dateStr}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Clock className="w-4 h-4 text-gray-400" />
                {event.time?.slice(0, 5)}
                {event.endTime && <span className="text-gray-400">– {event.endTime.slice(0, 5)}</span>}
              </div>
              <div className="flex items-center gap-2 text-gray-700 sm:col-span-2">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" /> {event.fieldName}
              </div>
            </div>

            {event.description && (
              <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">
                {event.description}
              </p>
            )}

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-400">Organizator: {event.organizerName}</p>
              {isOrganizer && (
                <Link
                  href={`/wydarzenia/${event.id}/edytuj`}
                  className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edytuj
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Participants */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4" /> Uczestnicy
            </h2>
            <span className={[
              'text-sm font-medium px-2.5 py-1 rounded-full',
              isFull ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700',
            ].join(' ')}>
              {regulars.length} / {event.maxPlayers}
            </span>
          </div>

          <ul className="divide-y divide-gray-100">
            {regulars.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-2 text-sm text-gray-800">
                  {p.avatarUrl
                    ? <img src={p.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    : <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold shrink-0">{p.name.charAt(0).toUpperCase()}</span>
                  }
                  <span className="truncate max-w-[160px]">{p.name}</span>
                  {p.isGuest && <span className="text-xs text-gray-400 shrink-0">(gość)</span>}
                  {p.userId === event.organizerId && (
                    <span className="text-xs text-primary-600 shrink-0">• organizator</span>
                  )}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {isOrganizer && (
                    <button
                      onClick={() => handleTogglePayment(p)} disabled={busy}
                      title={p.hasPaid ? 'Oznacz jako nieopłacone' : 'Oznacz jako opłacone'}
                      className={[
                        'p-1.5 rounded transition-colors',
                        p.hasPaid ? 'text-green-600 hover:text-green-700' : 'text-gray-300 hover:text-gray-500',
                      ].join(' ')}
                      aria-label={p.hasPaid ? 'Opłacone' : 'Nieopłacone'}
                    >
                      <Banknote className="w-4 h-4" />
                    </button>
                  )}
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
              </li>
            ))}
            {regulars.length === 0 && (
              <li className="py-4 text-sm text-gray-400 text-center">Nikt jeszcze nie dołączył</li>
            )}
          </ul>

          {/* Organizer: add guest */}
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-gray-400" />
              Lista rezerwowa
              <span className="text-xs font-normal text-gray-400 ml-1">{reserves.length} os.</span>
            </h2>
            <ul className="divide-y divide-gray-100">
              {reserves.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-medium shrink-0">
                      {i + 1}
                    </span>
                    <span className="truncate max-w-[160px]">{p.name}</span>
                    {p.isGuest && <span className="text-xs text-gray-400 shrink-0">(gość)</span>}
                  </span>
                  {(isOrganizer || p.userId === user?.id) && (
                    <button
                      onClick={() => handleRemove(p.id)} disabled={busy}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                      aria-label="Usuń z rezerwy"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Team draw */}
        {regulars.length >= 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Shuffle className="w-4 h-4" /> Składy
              </h2>
              <Button variant="outline" onClick={handleDrawTeams} disabled={busy}>
                {teams ? 'Losuj ponownie' : 'Losuj składy'}
              </Button>
            </div>

            {teams && (
              <div className="grid grid-cols-2 gap-3">
                {teams.map((team, ti) => {
                  const c = TEAM_COLORS[ti];
                  return (
                    <div key={ti} className={`rounded-xl border p-3 ${c.bg} ${c.border}`}>
                      <p className={`text-xs font-bold mb-2 uppercase tracking-wide ${c.text}`}>
                        Drużyna {ti + 1}
                      </p>
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
            )}

            {!teams && (
              <p className="text-sm text-gray-400 text-center py-2">
                Kliknij przycisk, aby podzielić {regulars.length} graczy losowo.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
          {/* Join / reserve / status for logged-in non-organizer */}
          {user && !myParticipation && !isFull && (
            <Button onClick={handleJoin} isLoading={busy} className="w-full" size="lg">
              Dołącz do gry
            </Button>
          )}
          {user && !myParticipation && isFull && (
            <Button onClick={handleJoin} isLoading={busy} variant="outline" className="w-full" size="lg">
              Zapisz się na listę rezerwową
            </Button>
          )}
          {user && myParticipation && !myParticipation.isReserve && !isOrganizer && (
            <div className="flex items-center justify-center gap-2 text-green-700 text-sm font-medium py-2">
              <Check className="w-4 h-4" /> Jesteś zapisany
            </div>
          )}
          {user && myParticipation?.isReserve && (
            <div className="flex items-center justify-center gap-2 text-amber-600 text-sm font-medium py-2">
              <Users className="w-4 h-4" /> Jesteś na liście rezerwowej
            </div>
          )}
          {!authLoading && !user && (
            <Button onClick={() => signInWithGoogle()} variant="outline" className="w-full">
              Zaloguj się, aby dołączyć
            </Button>
          )}

          {/* Share */}
          <Button onClick={handleShare} variant="outline" className="w-full">
            {copied
              ? <><Check className="w-4 h-4" /> Skopiowano link</>
              : <><Share2 className="w-4 h-4" /> Udostępnij</>}
          </Button>

          {/* Organizer controls */}
          {isOrganizer && (
            <div className="pt-3 border-t border-gray-100 space-y-3">
              <button
                onClick={handleToggleVisibility} disabled={busy}
                className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg px-3 py-2"
              >
                {event.visibility === 'public'
                  ? <><Lock className="w-4 h-4" /> Ustaw jako prywatne</>
                  : <><Globe className="w-4 h-4" /> Upublicznij (gdy brakuje ludzi)</>}
              </button>
              <button
                onClick={handleDelete} disabled={busy}
                className="w-full flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 rounded-lg px-3 py-2"
              >
                <Trash2 className="w-4 h-4" /> Usuń wydarzenie
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
