'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Users, Plus, Lock, Globe } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useAuth } from '@/lib/auth';
import { getMyEvents, getPublicEvents } from '@/lib/events';
import type { EventItem } from '@/types';

const SPORT_EMOJI: Record<string, string> = {
  'piłka nożna': '⚽', koszykówka: '🏀', siatkówka: '🏐', tenis: '🎾', futsal: '⚽', inne: '🏅',
};

function EventRow({ event }: { event: EventItem }) {
  let dateStr = event.date;
  try { dateStr = format(parseISO(event.date), 'd MMM', { locale: pl }); } catch {}
  return (
    <Link href={`/wydarzenia/${event.id}`}>
      <Card className="hover:shadow-md transition-shadow" padding="md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0" role="img">{SPORT_EMOJI[event.sport] ?? '🏅'}</span>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">
                {event.title || event.sport}
              </p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 shrink-0" /> {event.fieldName}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium text-gray-900 flex items-center gap-1 justify-end">
              <Calendar className="w-3.5 h-3.5 text-gray-400" /> {dateStr}
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1 justify-end mt-0.5">
              <Clock className="w-3 h-3" /> {event.time?.slice(0, 5)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> max {event.maxPlayers}</span>
          <span className="flex items-center gap-1">
            {event.visibility === 'public'
              ? <><Globe className="w-3 h-3" /> Publiczne</>
              : <><Lock className="w-3 h-3" /> Prywatne</>}
          </span>
        </div>
      </Card>
    </Link>
  );
}

export default function EventsPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [tab, setTab] = useState<'moje' | 'publiczne'>('publiczne');
  const [myEvents, setMyEvents] = useState<EventItem[]>([]);
  const [publicEvents, setPublicEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pub, mine] = await Promise.all([
        getPublicEvents(),
        user ? getMyEvents(user.id) : Promise.resolve([]),
      ]);
      setPublicEvents(pub);
      setMyEvents(mine);
    } catch {
      // ignore — empty states handle it
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (user) setTab('moje'); }, [user]);

  const events = tab === 'moje' ? myEvents : publicEvents;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Wydarzenia</h1>
          {user && (
            <Link href="/wydarzenia/nowe">
              <Button className="flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nowe</Button>
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {user && (
            <button
              onClick={() => setTab('moje')}
              className={[
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                tab === 'moje' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-300',
              ].join(' ')}
            >Moje</button>
          )}
          <button
            onClick={() => setTab('publiczne')}
            className={[
              'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
              tab === 'publiczne' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-300',
            ].join(' ')}
          >Publiczne</button>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        )}

        {!loading && (
          <div className="space-y-3">
            {events.map((e) => <EventRow key={e.id} event={e} />)}
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            {tab === 'moje' ? (
              <>
                <p className="text-lg font-medium">Nie masz jeszcze wydarzeń</p>
                <p className="text-sm mt-1 mb-5">Stwórz pierwsze i zaproś znajomych.</p>
                <Link href="/wydarzenia/nowe"><Button>Stwórz wydarzenie</Button></Link>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">Brak publicznych wydarzeń</p>
                <p className="text-sm mt-1">Bądź pierwszy — stwórz publiczne wydarzenie.</p>
                {!authLoading && !user && (
                  <button onClick={() => signInWithGoogle()} className="text-primary-600 text-sm underline mt-4">
                    Zaloguj się, aby tworzyć
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
