'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CalendarPlus, MapPin, Bell, BellRing, Users } from 'lucide-react';
import NearbyGames from './NearbyGames';
import AlertSetupDialog from './AlertSetupDialog';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getPublicEvents, getMyParticipatedEvents } from '@/lib/events';
import { getMyAlert } from '@/lib/alerts';
import { isUpcoming } from '@/components/EventCard';
import type { EventItem, GameAlert } from '@/types';
import { sportEmoji } from '@/lib/sports';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { pl } from 'date-fns/locale';

function firstName(name: string): string {
  return name.split(' ')[0] || name;
}

function dayLabel(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return 'Dziś';
    if (isTomorrow(d)) return 'Jutro';
    return format(d, 'EEE d MMM', { locale: pl });
  } catch { return dateStr; }
}

/** Compact event row — open games shown normally, full/past as subdued ghost */
function EventFeedRow({ event, taken }: { event: EventItem; taken: number }) {
  const max = event.maxPlayers ?? 0;
  const isFull = max > 0 && taken >= max;
  const isPast = !isUpcoming(event);
  const muted = isFull || isPast;
  const location = event.district ? `${event.district}` : event.fieldName;
  const label = event.title || `${sportEmoji(event.sport)} ${event.sport}`;

  return (
    <Link
      href={`/wydarzenia/${event.id}`}
      className={[
        'flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all',
        muted
          ? 'border-slate-100 bg-white/50 opacity-60'
          : 'border-slate-200/80 bg-white shadow-sm hover:border-primary-200 hover:shadow-card-hover active:scale-[0.99]',
      ].join(' ')}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${muted ? 'bg-slate-300' : 'bg-primary-500'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${muted ? 'text-slate-400' : 'text-ink'}`}>{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {dayLabel(event.date)}{event.time ? ` ${event.time.slice(0, 5)}` : ''} · {location}
        </p>
      </div>
      {muted ? (
        <span className="shrink-0 text-xs text-slate-400 font-medium">
          {isPast ? 'Odbyło się' : 'Pełne'}
        </span>
      ) : (
        <span className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary-700 text-white">
          Dołącz
        </span>
      )}
    </Link>
  );
}

/** Marketing hero for logged-out visitors */
function MarketingHero() {
  const [venueCount, setVenueCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { count } = await supabase
          .from('fields')
          .select('id', { count: 'exact', head: true })
          .eq('map_visibility', 'public');
        setVenueCount(count ?? 0);
      } catch { /* ignore */ }
    })();
  }, []);

  return (
    <section className="hero-surface relative overflow-hidden text-white">
      <div className="hero-dots absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-24 lg:pt-20">
        <div className="text-center lg:text-left">
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-amber-200 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            Poznań i okolice
          </span>
          <h1
            className="mt-5 animate-fade-up font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ animationDelay: '80ms' }}
          >
            Otwarte mecze amatorskie.
            <br />
            <span className="text-white/85">Dołącz w 30 sekund.</span>
          </h1>
          <p
            className="mx-auto mt-5 max-w-xl animate-fade-up text-base font-medium text-white/80 sm:text-lg lg:mx-0"
            style={{ animationDelay: '160ms' }}
          >
            Piłka, kosz, siatka. Zero grup na WhatsAppie, zero excela,
            zero „kto w końcu gra?". Znajdź grę blisko, kliknij Dołącz, idź zagrać.
          </p>
          <div
            className="mt-8 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
            style={{ animationDelay: '240ms' }}
          >
            <Link href="/wydarzenia" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-[#F5A623] text-[#1A1D21] font-bold hover:bg-amber-400 border-transparent shadow-lg active:scale-[0.97]">
                Znajdź grę <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/wydarzenia/nowe" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full border-white/30 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15 sm:w-auto">
                Zorganizuj mecz
              </Button>
            </Link>
            <Link href="/mapa" className="inline-flex items-center gap-2 px-2 py-2 text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline">
              <MapPin className="h-4 w-4" /> Mapa boisk
            </Link>
          </div>
          <dl
            className="mx-auto mt-10 grid max-w-md animate-fade-up grid-cols-2 gap-6 border-t border-white/10 pt-6 lg:mx-0"
            style={{ animationDelay: '320ms' }}
          >
            <div>
              <dt className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-white/55 lg:justify-start">
                <MapPin className="h-4 w-4" /> boisk w bazie
              </dt>
              <dd className="mt-1 text-center font-display text-2xl font-bold tracking-tight lg:text-left">
                {venueCount !== null ? venueCount : '—'}
              </dd>
            </div>
            <div>
              <dt className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-white/55 lg:justify-start">
                <Users className="h-4 w-4" /> dyscypliny
              </dt>
              <dd className="mt-1 text-center font-display text-2xl font-bold tracking-tight lg:text-left">4</dd>
            </div>
          </dl>
        </div>
        <div className="relative mx-auto w-full max-w-[300px] animate-fade-up sm:max-w-[340px] lg:max-w-[400px]" style={{ animationDelay: '200ms' }}>
          <Image
            src="/mockups/mockup-1-lista-gier.png"
            alt="Aplikacja BOJO — lista nadchodzących meczów"
            width={1024}
            height={1536}
            priority
            sizes="(max-width: 640px) 70vw, 400px"
            className="w-full select-none drop-shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
          />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-canvas" aria-hidden="true" />
    </section>
  );
}

/** Dashboard hero for logged-in users — shows all public events with status feed */
function PersonalizedHero({ name }: { name: string }) {
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  const [myGames, setMyGames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<GameAlert | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([
      getPublicEvents(),
      user ? getMyParticipatedEvents(user.id) : Promise.resolve([]),
      getMyAlert().catch(() => null),
    ]).then(([events, mine, myAlert]) => {
      setAllEvents(events);
      setMyGames(new Set(mine.map((m) => m.event.id)));
      setAlert(myAlert);
    }).finally(() => setLoading(false));
  }, [user]);

  const nonCancelled = allEvents.filter((e) => e.status !== 'cancelled');
  const openEvents = nonCancelled.filter((e) => {
    const taken = (e.participantsCount ?? 0) + (e.externalCount ?? 0);
    return isUpcoming(e) && taken < e.maxPlayers;
  });
  const fullOrPast = nonCancelled.filter((e) => {
    const taken = (e.participantsCount ?? 0) + (e.externalCount ?? 0);
    return !isUpcoming(e) || taken >= e.maxPlayers;
  }).slice(0, 4);

  return (
    <>
      <section className="hero-surface relative overflow-hidden text-white">
        <div className="hero-dots absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-start gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:py-12">
          <div>
            <p className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Cześć, {firstName(name)} 👋
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/wydarzenia">
              <Button size="sm" className="bg-[#F5A623] text-[#1A1D21] font-bold hover:bg-amber-400 border-transparent shadow-lg active:scale-[0.97]">
                Wszystkie mecze <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/wydarzenia/nowe">
              <Button variant="outline" size="sm" className="border-white/30 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15">
                <CalendarPlus className="h-4 w-4" /> Nowy
              </Button>
            </Link>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-canvas" aria-hidden="true" />
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pt-6 pb-10 space-y-6">
        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/wydarzenia" className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm hover:border-primary-200 hover:shadow-card-hover transition-all group">
            <span className="text-xl">⚽</span>
            <div>
              <p className="text-sm font-semibold text-ink">Dołącz do gry</p>
              <p className="text-xs text-slate-400">Otwarte mecze</p>
            </div>
          </Link>
          <Link href="/mapa" className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm hover:border-primary-200 hover:shadow-card-hover transition-all group">
            <span className="text-xl">🗺️</span>
            <div>
              <p className="text-sm font-semibold text-ink">Mapa boisk</p>
              <p className="text-xs text-slate-400">Setki lokalizacji</p>
            </div>
          </Link>
        </div>

        {/* Open events feed */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Najbliższe mecze
            </h2>
            <button
              onClick={() => setShowAlert(true)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                alert ? 'bg-primary-50 text-primary-700' : 'bg-amber-50 text-amber-700',
              ].join(' ')}
            >
              {alert ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
              {alert ? 'Alert włączony' : 'Ustaw alert'}
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
            </div>
          ) : openEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm font-medium text-slate-600">Brak otwartych gier w tej chwili</p>
              <button
                onClick={() => setShowAlert(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white"
              >
                <Bell className="w-4 h-4" /> Ustaw alert
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {openEvents.slice(0, 6).map((e) => (
                <EventFeedRow key={e.id} event={e} taken={(e.participantsCount ?? 0) + (e.externalCount ?? 0)} />
              ))}
              {fullOrPast.map((e) => (
                <EventFeedRow key={e.id} event={e} taken={(e.participantsCount ?? 0) + (e.externalCount ?? 0)} />
              ))}
              {allEvents.length > 10 && (
                <Link href="/wydarzenia" className="flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-primary-700 hover:text-primary-800">
                  Pokaż wszystkie <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {showAlert && (
        <AlertSetupDialog
          onClose={() => setShowAlert(false)}
          onSaved={(a) => { setAlert(a); setShowAlert(false); }}
        />
      )}
    </>
  );
}

export default function HomeHero() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading || !user) return <MarketingHero />;
  return <PersonalizedHero name={displayName(user)} />;
}
