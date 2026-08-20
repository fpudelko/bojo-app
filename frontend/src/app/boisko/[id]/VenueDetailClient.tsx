'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import Link from 'next/link';
import { MapPin, Phone, Globe, ArrowLeft, Mail, Building2, Clock as ClockIcon, Calendar, Clock, Eye, EyeOff, Map as MapIcon } from 'lucide-react';
import { sportEmoji, sportColor } from '@/lib/sports';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { fieldPhotoUrl, surfaceLabel } from '@/lib/labels';
import { externalUrl } from '@/lib/utils';
import { getAvailableSlots, createBooking } from '@/lib/bookings';
import { getField } from '@/lib/api';
import { showBookingForField } from '@/config/features';
import { useAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { getOutreach } from '@/lib/outreach';
import type { Outreach } from '@/lib/outreach';
import ZglosBladObiektu from '@/components/venues/ZglosBladObiektu';
import VenueComments from '@/components/venue/VenueComments';
import { odczytajPowrot } from '@/lib/powrot';
import type { Field, TimeSlot } from '@/types';


interface UpcomingEvent {
  id: string;
  sport: string;
  date: string;
  time: string;
  maxPlayers: number;
  currentCount: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatDatePl(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pl-PL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function VenueDetailClient({
  fieldId,
  upcomingEvents = [],
}: {
  fieldId: string;
  upcomingEvents?: UpcomingEvent[];
}) {
  const id = fieldId;
  const { user, loading: authLoading } = useAuth();
  const isAdmin = useAdmin();

  // Where the back arrow goes. Read from sessionStorage AFTER mount, not from
  // a `?wroc=` query param (patrz lib/powrot.ts — usuwa warianty URL-a boiska
  // z linków wewnętrznych, canonical i tak jest bez parametrów) and not via
  // useSearchParams(): this route is prerendered for every venue
  // (generateStaticParams), and that hook forces a client-side bail-out which
  // fails the production build unless the whole page sits in <Suspense>.
  // The link only has to be right by the time somebody clicks it.
  const [backHref, setBackHref] = useState('/mapa');
  useEffect(() => {
    const wroc = odczytajPowrot();
    if (wroc) setBackHref(wroc);
  }, []);

  const [field, setField] = useState<Field | null>(null);
  const [fieldLoading, setFieldLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [outreach, setOutreach] = useState<Outreach | null>(null);

  const [date, setDate] = useState(tomorrowIso());
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsLoaded, setSlotsLoaded] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [playersCount, setPlayersCount] = useState(1);
  const [booking, setBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [mapVisibility, setMapVisibility] = useState<'public' | 'hidden' | 'organizer_only'>('organizer_only');
  const [visibilityBusy, setVisibilityBusy] = useState(false);

  useEffect(() => {
    getField(id)
      .then((f) => {
        setField(f);
        setMapVisibility(f.mapVisibility ?? 'organizer_only');
        getOutreach(f.id).then(setOutreach).catch(() => {});
      })
      .catch(() => setNotFound(true))
      .finally(() => setFieldLoading(false));
  }, [id]);

  const loadSlots = useCallback(async (targetDate: string) => {
    setSlotsLoaded(false);
    setSlotsLoading(true);
    setSelectedSlot(null);
    setBookingSuccess(false);
    setBookingError(null);
    try {
      const result = await getAvailableSlots(id, targetDate);
      setSlots(result);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
      setSlotsLoaded(true);
    }
  }, [id]);

  useEffect(() => {
    if (field && showBookingForField(field) && field.bookingType === 'internal' && user) {
      loadSlots(date);
    }
  }, [field, user, date, loadSlots]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value);
  };

  const handleBooking = async () => {
    if (!selectedSlot || !user || !field) return;
    setBooking(true);
    setBookingError(null);
    try {
      await createBooking(
        field.id,
        user.id,
        displayName(user),
        date,
        selectedSlot.startTime,
        selectedSlot.endTime,
        selectedSlot.priceGrosze,
        {
          notes: notes.trim() || undefined,
          phone: phone.trim() || undefined,
          playersCount: playersCount > 0 ? playersCount : 1,
        },
      );
      setBookingSuccess(true);
      setSelectedSlot(null);
      setNotes('');
      setPhone('');
      setPlayersCount(1);
      await loadSlots(date);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Nie udało się złożyć rezerwacji.');
    } finally {
      setBooking(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!isAdmin || !field) return;
    const next = mapVisibility === 'public' ? 'hidden' : 'public';
    setVisibilityBusy(true);
    try {
      await supabase.from('fields').update({
        map_visibility: next,
        moderation_status: next === 'public' ? 'approved' : 'hidden',
      }).eq('id', field.id);
      setMapVisibility(next);
    } finally { setVisibilityBusy(false); }
  };

  if (fieldLoading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-4">
          <div className="h-60 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
        </main>
      </div>
    );
  }

  if (notFound || !field) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center text-slate-500">
          <div>
            <MapPin className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-700">Nie znaleziono boiska</p>
            <Link href="/mapa" className="text-primary-600 text-sm underline mt-4 inline-block">
              Wróć do mapy
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const thumbnail = fieldPhotoUrl(field, 600, 240);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${field.lat},${field.lng}`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-4">

        <div className="flex items-center gap-3">
          {/* Back goes where the visitor came from (lib/powrot.ts). Without it,
              arriving from a match page dumped people on /mapa, losing the
              match they were looking at. Only relative paths are honoured,
              so the stashed value can't be used to bounce anyone off-site. */}
          <Link
            href={backHref}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold text-slate-900 truncate">{field.name}</h1>
        </div>

        {/* Field info card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt={field.name}
              className="w-full h-48 object-cover"
            />
          )}

          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900">{field.name}</h2>
                {field.district && (
                  <p className="text-xs font-medium text-primary-700 mt-0.5">{field.district}</p>
                )}
                <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {field.address}
                </p>
                {showBookingForField(field) && field.bookingType === 'internal' && (
                  <span className="inline-block mt-1.5 text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                    📅 Rezerwacja online
                  </span>
                )}
                {showBookingForField(field) && field.bookingType === 'external' && (
                  <span className="inline-block mt-1.5 text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">
                    🔗 Rezerwuj zewnętrznie
                  </span>
                )}
              </div>
              {field.isIndoor && (
                <span className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                  Hala
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {field.sport.map((s) => (
                  <span
                    key={s}
                    style={{ background: sportColor(s) + '18', color: sportColor(s) }}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                  >
                    <span role="img" aria-hidden>{sportEmoji(s)}</span>
                    {s}
                  </span>
              ))}
              {field.surface && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                  {surfaceLabel(field.surface)}
                </span>
              )}
            </div>

            {showBookingForField(field) && field.bookingType === 'none' && (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
                Ten obiekt nie przyjmuje rezerwacji online.
              </p>
            )}

            {/* Operator / manager info */}
            {(field.operator || field.operatorType || field.description || field.openingHours) && (
              <div className="border-t border-slate-100 pt-4 space-y-2">
                {field.operator && (
                  <p className="flex items-center gap-2 text-sm text-slate-700">
                    <Building2 className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="font-medium">{field.operator}</span>
                    {field.operatorType && (
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{field.operatorType}</span>
                    )}
                  </p>
                )}
                {field.openingHours && (
                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <ClockIcon className="w-4 h-4 shrink-0 text-slate-400" />
                    {field.openingHours}
                  </p>
                )}
                {field.description && (
                  <p className="text-sm text-slate-500 leading-relaxed">{field.description}</p>
                )}
              </div>
            )}

            {/* Facilities chips */}
            {(field.lit !== undefined || field.fee !== undefined || field.hasChangingRooms || field.hasShower || field.hasToilets || field.capacity) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {field.lit === true && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">💡 Oświetlenie</span>}
                {field.fee === false && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">✓ Bezpłatne</span>}
                {field.fee === true && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">💳 Płatne</span>}
                {field.hasChangingRooms && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">👕 Szatnia</span>}
                {field.hasShower && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">🚿 Prysznic</span>}
                {field.hasToilets && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">🚻 Toaleta</span>}
                {field.capacity && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">👥 maks. {field.capacity} os.</span>}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {field.phone && (
                <a
                  href={`tel:${field.phone}`}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-primary-600 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {field.phone}
                </a>
              )}
              {field.email && (
                <a
                  href={`mailto:${field.email}`}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-primary-600 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {field.email}
                </a>
              )}
              {field.website && (
                <a
                  href={externalUrl(field.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-primary-600 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  Strona www
                </a>
              )}
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors ml-auto"
              >
                <MapPin className="w-4 h-4" />
                Prowadź →
              </a>
            </div>
          </div>
        </div>

        {/* Booking section — internal */}
        {showBookingForField(field) && field.bookingType === 'internal' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-900">Zarezerwuj termin</h2>

            {!user && !authLoading && (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 mb-4">Zaloguj się, aby zarezerwować slot.</p>
                <Button variant="outline" onClick={() => { window.location.href = `/logowanie?next=${encodeURIComponent(window.location.pathname)}`; }}>
                  Zaloguj się, aby zarezerwować
                </Button>
              </div>
            )}

            {user && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Wybierz datę
                  </label>
                  <input
                    type="date"
                    value={date}
                    min={todayIso()}
                    onChange={handleDateChange}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Dostępne sloty</p>

                  {slotsLoading && (
                    <div className="flex flex-wrap gap-2">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-9 w-36 rounded-full bg-slate-100 animate-pulse" />
                      ))}
                    </div>
                  )}

                  {!slotsLoading && slotsLoaded && slots.length === 0 && (
                    <p className="text-sm text-slate-500 py-2">
                      Brak slotów dla wybranego dnia — obiekt może być nieczynny.
                    </p>
                  )}

                  {!slotsLoading && slots.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {slots.map((slot) => {
                        const isSelected =
                          selectedSlot?.startTime === slot.startTime &&
                          selectedSlot?.endTime === slot.endTime;

                        if (!slot.available) {
                          return (
                            <button
                              key={slot.startTime}
                              disabled
                              className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-400 cursor-not-allowed"
                            >
                              {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}&nbsp;&nbsp;ZAJĘTE
                            </button>
                          );
                        }

                        return (
                          <button
                            key={slot.startTime}
                            onClick={() => setSelectedSlot(isSelected ? null : slot)}
                            className={[
                              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                              isSelected
                                ? 'bg-primary-700 text-white ring-2 ring-primary-700 ring-offset-1'
                                : 'bg-primary-600 text-white hover:bg-primary-700',
                            ].join(' ')}
                          >
                            {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}&nbsp;&nbsp;{(slot.priceGrosze / 100).toFixed(0)} zł
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {bookingSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3 font-medium">
                    ✓ Rezerwacja złożona! Zarządca potwierdzi wkrótce.
                  </div>
                )}

                {selectedSlot && (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <p className="text-sm font-semibold text-slate-900">Potwierdzenie rezerwacji</p>
                    <div className="text-sm text-slate-700 space-y-1">
                      <p>
                        <span className="text-slate-500">Data:</span>{' '}
                        <span className="capitalize">{formatDatePl(date)}</span>
                      </p>
                      <p>
                        <span className="text-slate-500">Godzina:</span>{' '}
                        {selectedSlot.startTime.slice(0, 5)}–{selectedSlot.endTime.slice(0, 5)}
                      </p>
                      <p>
                        <span className="text-slate-500">Cena:</span>{' '}
                        {(selectedSlot.priceGrosze / 100).toFixed(0)} zł
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Liczba osób
                      </label>
                      <input
                        type="number"
                        value={playersCount}
                        min={1}
                        max={20}
                        onChange={(e) => setPlayersCount(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
                        className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Twój telefon <span className="text-slate-400 font-normal">(opcjonalnie)</span>
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+48 500 000 000"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Uwagi <span className="text-slate-400 font-normal">(opcjonalnie)</span>
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Uwagi dla zarządcy…"
                        rows={2}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                      />
                    </div>

                    {bookingError && (
                      <p className="text-sm text-red-600">{bookingError}</p>
                    )}

                    <Button
                      onClick={handleBooking}
                      isLoading={booking}
                      className="w-full"
                    >
                      Zarezerwuj
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Booking section — external */}
        {showBookingForField(field) && field.bookingType === 'external' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Rezerwacja zewnętrzna</h2>
            {(field.bookingUrl || outreach?.bookingUrl) ? (
              <>
                {outreach?.bookingProvider && !field.bookingUrl && (
                  <p className="text-sm text-slate-500">
                    Przez: <span className="font-medium text-slate-700">{outreach.bookingProvider}</span>
                  </p>
                )}
                <a
                  href={field.bookingUrl || outreach!.bookingUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-6 py-3 text-sm transition-colors"
                >
                  Przejdź do rezerwacji →
                </a>
              </>
            ) : (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
                📞 Kontakt telefoniczny
              </p>
            )}
          </div>
        )}

        {/* Booking section — none */}
        {showBookingForField(field) && field.bookingType === 'none' && !outreach?.bookingUrl && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
              Brak rezerwacji online dla tego obiektu.
            </p>
          </div>
        )}

        {/* AI-found booking URL — shown when outreach has a booking URL and we're not already showing internal booking */}
        {outreach?.bookingUrl && field.bookingType !== 'internal' && !(showBookingForField(field) && field.bookingType === 'external' && field.bookingUrl) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Rezerwacja online</h2>
            {outreach.bookingProvider && (
              <p className="text-sm text-slate-500">
                Przez: <span className="font-medium text-slate-700">{outreach.bookingProvider}</span>
              </p>
            )}
            <a
              href={outreach.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-6 py-3 text-sm transition-colors"
            >
              Zarezerwuj →
            </a>
          </div>
        )}

        {/* AI summary — subtle info, only when meaningful */}
        {outreach?.aiSummary && outreach.aiSummary.length > 40 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Opis AI</p>
            <p className="text-sm text-slate-600 leading-relaxed">{outreach.aiSummary}</p>
          </div>
        )}

        {/* Upcoming events */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Nadchodzące mecze
            </h2>
          </div>
          {upcomingEvents.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {upcomingEvents.map((ev) => {
                let dateStr = ev.date;
                try { dateStr = format(parseISO(ev.date), 'd MMM yyyy', { locale: pl }); } catch {}
                const spotsLeft = ev.maxPlayers - ev.currentCount;
                return (
                  <li key={ev.id} className="py-3">
                    <Link href={`/wydarzenia/${ev.id}`} className="flex items-center justify-between gap-3 hover:opacity-80 transition-opacity">
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800 capitalize">{ev.sport}</span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {dateStr} · {ev.time}
                          </span>
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${spotsLeft <= 0 ? 'bg-red-100 text-red-700' : spotsLeft <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {spotsLeft <= 0 ? 'Pełne' : `+${spotsLeft} miejsc`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Brak nadchodzących meczy na tym boisku.</p>
          )}

          <div className="mt-5 space-y-2 pt-4 border-t border-slate-100">
            <Link href={`/wydarzenia/nowe?fieldId=${field.id}`}>
              <Button className="w-full">Stwórz mecz tutaj</Button>
            </Link>
            {/* Powrót na mapę wycelowaną w TEN obiekt. Bez tego jedyną drogą
                z opisu boiska do jego okolicy było wejście na mapę i szukanie
                go od nowa — a mapa otwiera się na widoku całego kraju.
                Parametr `boisko` obsługuje VenueExplorer. */}
            <Link href={`/mapa?boisko=${field.id}`}>
              <Button variant="outline" className="w-full">
                <MapIcon className="h-4 w-4" />
                Zobacz na mapie
              </Button>
            </Link>
          </div>
        </div>

        <VenueComments fieldId={field.id} />

        {/* Atrybucja OpenStreetMap. Nie ozdoba — ODbL wymaga uznania autorstwa
            wszędzie, gdzie pokazujemy te dane, a nie tylko pod mapą. Ta strona
            pokazuje nazwę, nawierzchnię, wymiary i udogodnienia pochodzące
            wprost z OSM. */}
        <p className="px-1 text-center text-[11px] text-slate-400">
          Dane o obiekcie pochodzą z{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate-600"
          >
            OpenStreetMap
          </a>{' '}
          — © autorzy OpenStreetMap, licencja ODbL. Coś się nie zgadza?{' '}
          <a
            href={`https://www.openstreetmap.org/note/new#map=19/${field.lat}/${field.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate-600"
          >
            Zgłoś poprawkę
          </a>
          .
        </p>

        {/* Dwie różne drogi, obie potrzebne: odnośnik wyżej naprawia dane
            U ŹRÓDŁA (notatka w OSM, z pożytkiem dla wszystkich), a ten przycisk
            zgłasza rzecz DO NAS — bo tylko my możemy ukryć obiekt, którego
            w rzeczywistości nie ma. */}
        <div className="px-1 text-center">
          <ZglosBladObiektu fieldId={field.id} />
        </div>
        {/* Admin: map visibility toggle */}
        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Panel admina</p>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2.5">
                {mapVisibility === 'public'
                  ? <Eye className="h-5 w-5 text-primary-600" />
                  : <EyeOff className="h-5 w-5 text-slate-400" />}
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {mapVisibility === 'public' ? 'Widoczny na mapie' : 'Ukryty z mapy'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {mapVisibility === 'public'
                      ? 'Obiekt pojawia się dla wszystkich użytkowników'
                      : 'Obiekt nie jest widoczny na mapie'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleVisibility}
                disabled={visibilityBusy}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  mapVisibility === 'public'
                    ? 'bg-slate-200 text-slate-600 hover:bg-red-100 hover:text-red-700'
                    : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                }`}
              >
                {visibilityBusy ? '…' : mapVisibility === 'public' ? 'Ukryj' : 'Upublicznij'}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
