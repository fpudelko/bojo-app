'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar, Clock, MapPin, Users, Trash2, Lock, Globe, Pencil,
  Power, UserPlus, X, Send, PlayCircle, RepeatIcon,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { venueThumbnail } from '@/lib/labels';
import {
  getRecurringEvent,
  addInvite,
  removeInvite,
  toggleActive,
  spawnEventInstance,
  sendInvites,
} from '@/lib/recurring';
import type { RecurringEvent, RecurringEventInvite } from '@/types';

const SPORT_EMOJI: Record<string, string> = {
  'piłka nożna': '⚽',
  futsal: '⚡',
  koszykówka: '🏀',
  siatkówka: '🏐',
  'siatkówka plażowa': '🏖️',
  'piłka ręczna': '🤾',
  inne: '🏅',
};

const DAY_NAMES: Record<number, string> = {
  1: 'Poniedziałek',
  2: 'Wtorek',
  3: 'Środa',
  4: 'Czwartek',
  5: 'Piątek',
  6: 'Sobota',
  7: 'Niedziela',
};

/** Returns the date string (YYYY-MM-DD) of the next occurrence of the given
 *  ISO day of week (1=Mon … 7=Sun), starting from today. */
function nextOccurrence(dayOfWeek: number): string {
  const today = new Date();
  // getDay(): 0=Sun … 6=Sat → convert to ISO: Sun→7, Mon→1 … Sat→6
  const todayIso = today.getDay() === 0 ? 7 : today.getDay();
  let diff = dayOfWeek - todayIso;
  if (diff <= 0) diff += 7;
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  return target.toISOString().slice(0, 10);
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastCounter = 0;

export default function RecurringEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [event, setEvent] = useState<RecurringEvent | null>(null);
  const [invites, setInvites] = useState<RecurringEventInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Invite form
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [addingInvite, setAddingInvite] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Spawn section
  const [spawnDate, setSpawnDate] = useState('');
  const [spawning, setSpawning] = useState(false);
  const [spawningWithInvites, setSpawningWithInvites] = useState(false);

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Toggle active
  const [togglingActive, setTogglingActive] = useState(false);

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      const { event: ev, invites: inv } = await getRecurringEvent(id);
      setEvent(ev);
      setInvites(inv);
      setSpawnDate((prev) => prev || nextOccurrence(ev.dayOfWeek));
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-4">
          <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        </main>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (notFound || !event) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center text-gray-500">
          <div>
            <X className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Nie znaleziono cyklicznego wydarzenia</p>
            <Link href="/cykliczne" className="text-primary-600 text-sm underline mt-3 inline-block">
              Wróć do listy
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isOrganizer = !!user && user.id === event.organizerId;

  // ── Not organizer guard ───────────────────────────────────────────────────
  if (!isOrganizer) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center text-gray-500">
          <div>
            <Lock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-700">Brak dostępu</p>
            <p className="text-sm mt-1">Tylko organizator może zarządzać tym szablonem.</p>
            <Link href="/cykliczne" className="text-primary-600 text-sm underline mt-4 inline-block">
              Wróć do listy
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      await toggleActive(event.id, !event.isActive);
      await load();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally {
      setTogglingActive(false);
    }
  };

  const handleAddInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim()) return;
    setInviteError(null);
    setAddingInvite(true);
    try {
      await addInvite(
        event.id,
        inviteName.trim(),
        inviteEmail.trim() || undefined,
        invitePhone.trim() || undefined,
      );
      setInviteName('');
      setInviteEmail('');
      setInvitePhone('');
      await load();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : 'Nie udało się dodać gracza');
    } finally {
      setAddingInvite(false);
    }
  };

  const handleRemoveInvite = async (inviteId: string) => {
    setRemovingId(inviteId);
    try {
      await removeInvite(inviteId);
      await load();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const handleSpawn = async (withInvites: boolean) => {
    if (!spawnDate) return;
    if (withInvites) setSpawningWithInvites(true);
    else setSpawning(true);

    try {
      const eventId = await spawnEventInstance(event.id, spawnDate);

      if (withInvites) {
        try {
          const eventUrl = `${window.location.origin}/wydarzenia/${eventId}`;
          const result = await sendInvites(event.id, eventId, spawnDate, eventUrl);
          const parts: string[] = [];
          if (result.emailsSent > 0) parts.push(`${result.emailsSent} email${result.emailsSent === 1 ? '' : 'i'}`);
          if (result.smsSent > 0) parts.push(`${result.smsSent} SMS`);
          const summary = parts.length > 0 ? `Wysłano ${parts.join(', ')}` : 'Brak kontaktów do powiadomienia';
          addToast(summary, 'success');
        } catch {
          addToast('Wydarzenie utworzone, ale nie udało się wysłać zaproszeń', 'error');
        }
      }

      router.push(`/wydarzenia/${eventId}`);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Nie udało się utworzyć edycji', 'error');
      setSpawning(false);
      setSpawningWithInvites(false);
    }
  };

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  const thumbnail = venueThumbnail(event.lat, event.lng, 600, 200);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      {/* Toast stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs',
              t.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white',
            ].join(' ')}
          >
            {t.message}
          </div>
        ))}
      </div>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-4">

        {/* ── Section 1: Header card ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt={event.fieldName}
              className="w-full h-40 object-cover"
            />
          )}
          <div className="p-6">
            <div className="flex items-start gap-3">
              <span className="text-4xl shrink-0" role="img" aria-label={event.sport}>
                {SPORT_EMOJI[event.sport] ?? '🏅'}
              </span>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900">{event.title || event.sport}</h1>
                {event.title && (
                  <p className="text-sm text-gray-500 capitalize">{event.sport}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={[
                  'text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1',
                  event.visibility === 'public'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-600',
                ].join(' ')}>
                  {event.visibility === 'public'
                    ? <><Globe className="w-3 h-3" /> Publiczne</>
                    : <><Lock className="w-3 h-3" /> Prywatne</>}
                </span>
                <span className={[
                  'text-xs px-2 py-1 rounded-full font-medium',
                  event.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500',
                ].join(' ')}>
                  {event.isActive ? 'Aktywne' : 'Nieaktywne'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <RepeatIcon className="w-4 h-4 text-gray-400" />
                <span>{DAY_NAMES[event.dayOfWeek]}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Clock className="w-4 h-4 text-gray-400" />
                {event.eventTime.slice(0, 5)}
                {event.endTime && (
                  <span className="text-gray-400">– {event.endTime.slice(0, 5)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-gray-700 sm:col-span-2">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                {event.fieldName}
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Users className="w-4 h-4 text-gray-400" />
                Maks. {event.maxPlayers} graczy
              </div>
              {event.notifyDaysBefore > 0 && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  Powiadomienie {event.notifyDaysBefore} dni wcześniej
                </div>
              )}
            </div>

            {event.description && (
              <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">
                {event.description}
              </p>
            )}

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
              <button
                onClick={handleToggleActive}
                disabled={togglingActive}
                className={[
                  'flex items-center gap-2 text-sm rounded-lg px-3 py-2 transition-colors',
                  event.isActive
                    ? 'text-amber-700 hover:bg-amber-50'
                    : 'text-green-700 hover:bg-green-50',
                ].join(' ')}
              >
                <Power className="w-4 h-4" />
                {event.isActive ? 'Dezaktywuj' : 'Aktywuj'}
              </button>

              <Link
                href={`/cykliczne/${event.id}/edytuj`}
                className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                <Pencil className="w-3.5 h-3.5" /> Edytuj
              </Link>
            </div>
          </div>
        </div>

        {/* ── Section 2: Invite list ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Users className="w-4 h-4" /> Lista zaproszonych
            {invites.length > 0 && (
              <span className="text-xs font-normal text-gray-400 ml-1">{invites.length} os.</span>
            )}
          </h2>

          {invites.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              Nie dodano jeszcze żadnych graczy
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 mb-4">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold shrink-0">
                      {inv.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{inv.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {[inv.email, inv.phone].filter(Boolean).join(' · ') || 'Brak kontaktu'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveInvite(inv.id)}
                    disabled={removingId === inv.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded shrink-0 transition-colors"
                    aria-label="Usuń gracza"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add invite form */}
          <form onSubmit={handleAddInvite} className="pt-4 border-t border-gray-100 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Imię i nazwisko *"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email (opcjonalnie)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                type="tel"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                placeholder="Telefon (opcjonalnie)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            {inviteError && (
              <p className="text-sm text-red-600">{inviteError}</p>
            )}
            <Button
              type="submit"
              variant="outline"
              isLoading={addingInvite}
              disabled={!inviteName.trim()}
            >
              <UserPlus className="w-4 h-4" /> Dodaj
            </Button>
          </form>
        </div>

        {/* ── Section 3: Spawn instance ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
            <PlayCircle className="w-4 h-4" /> Utwórz nową edycję
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Tworzy jednorazowe wydarzenie na podstawie tego szablonu.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Data edycji</label>
            <input
              type="date"
              value={spawnDate}
              onChange={(e) => setSpawnDate(e.target.value)}
              className={inputCls}
              required
            />
            {spawnDate && (
              <p className="text-xs text-gray-400 mt-1">
                {DAY_NAMES[event.dayOfWeek]}, {event.eventTime.slice(0, 5)}
                {event.endTime && ` – ${event.endTime.slice(0, 5)}`}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => handleSpawn(false)}
              isLoading={spawning}
              disabled={!spawnDate || spawning || spawningWithInvites}
              className="flex-1"
            >
              <PlayCircle className="w-4 h-4" />
              Utwórz bez powiadomień
            </Button>
            <Button
              onClick={() => handleSpawn(true)}
              isLoading={spawningWithInvites}
              disabled={!spawnDate || spawning || spawningWithInvites || invites.length === 0}
              className="flex-1"
              title={invites.length === 0 ? 'Dodaj graczy, aby wysłać zaproszenia' : undefined}
            >
              <Send className="w-4 h-4" />
              Utwórz i wyślij zaproszenia
            </Button>
          </div>
          {invites.length === 0 && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              Dodaj graczy do listy zaproszonych, aby móc wysyłać powiadomienia.
            </p>
          )}
        </div>

      </main>
    </div>
  );
}
