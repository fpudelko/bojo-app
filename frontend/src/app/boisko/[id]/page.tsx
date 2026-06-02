'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, Globe, ArrowLeft } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { venueThumbnail, surfaceLabel } from '@/lib/labels';
import { getAvailableSlots, createBooking } from '@/lib/bookings';
import { getField } from '@/lib/api';
import type { Field, TimeSlot } from '@/types';

const SPORT_EMOJI: Record<string, string> = {
  'piłka nożna': '⚽',
  koszykówka: '🏀',
  siatkówka: '🏐',
  'siatkówka plażowa': '🏖️',
  futsal: '⚡',
  'piłka ręczna': '🤾',
  inne: '🏅',
};

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

export default function VenueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();

  const [field, setField] = useState<Field | null>(null);
  const [fieldLoading, setFieldLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

  useEffect(() => {
    getField(id)
      .then(setField)
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
    if (field?.bookingType === 'internal' && user) {
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

  if (fieldLoading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-4">
          <div className="h-60 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
        </main>
      </div>
    );
  }

  if (notFound || !field) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center text-gray-500">
          <div>
            <MapPin className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-700">Nie znaleziono boiska</p>
            <Link href="/mapa" className="text-primary-600 text-sm underline mt-4 inline-block">
              Wróć do mapy
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const thumbnail = venueThumbnail(field.lat, field.lng, 600, 240);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${field.lat},${field.lng}`;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-4">

        <div className="flex items-center gap-3">
          <Link href="/mapa" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 truncate">{field.name}</h1>
        </div>

        {/* Field info card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
                <h2 className="text-lg font-bold text-gray-900">{field.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {field.address}
                </p>
                {field.bookingType === 'internal' && (
                  <span className="inline-block mt-1.5 text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                    📅 Rezerwacja online
                  </span>
                )}
                {field.bookingType === 'external' && (
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
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 font-medium"
                >
                  <span role="img" aria-label={s}>{SPORT_EMOJI[s] ?? '🏅'}</span>
                  {s}
                </span>
              ))}
              {field.surface && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                  {surfaceLabel(field.surface)}
                </span>
              )}
            </div>

            {field.bookingType === 'none' && (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
                Ten obiekt nie przyjmuje rezerwacji online.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {field.phone && (
                <a
                  href={`tel:${field.phone}`}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-600 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {field.phone}
                </a>
              )}
              {field.website && (
                <a
                  href={field.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-600 transition-colors"
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

        {/* Booking section */}
        {field.isBookable && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-900">Zarezerwuj termin</h2>

            {!user && !authLoading && (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-4">Zaloguj się, aby zarezerwować slot.</p>
                <Button variant="outline" onClick={() => signInWithGoogle()}>
                  Zaloguj się, aby zarezerwować
                </Button>
              </div>
            )}

            {user && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Wybierz datę
                  </label>
                  <input
                    type="date"
                    value={date}
                    min={todayIso()}
                    onChange={handleDateChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Dostępne sloty</p>

                  {slotsLoading && (
                    <div className="flex flex-wrap gap-2">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-9 w-36 rounded-full bg-gray-100 animate-pulse" />
                      ))}
                    </div>
                  )}

                  {!slotsLoading && slotsLoaded && slots.length === 0 && (
                    <p className="text-sm text-gray-500 py-2">
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
                              className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
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
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-900">Potwierdzenie rezerwacji</p>
                    <div className="text-sm text-gray-700 space-y-1">
                      <p>
                        <span className="text-gray-500">Data:</span>{' '}
                        <span className="capitalize">{formatDatePl(date)}</span>
                      </p>
                      <p>
                        <span className="text-gray-500">Godzina:</span>{' '}
                        {selectedSlot.startTime.slice(0, 5)}–{selectedSlot.endTime.slice(0, 5)}
                      </p>
                      <p>
                        <span className="text-gray-500">Cena:</span>{' '}
                        {(selectedSlot.priceGrosze / 100).toFixed(0)} zł
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Uwagi <span className="text-gray-400 font-normal">(opcjonalnie)</span>
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Uwagi dla zarządcy…"
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
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
      </main>
    </div>
  );
}
