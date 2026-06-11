'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, CalendarDays } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { getField, updateFieldBookingSettings } from '@/lib/api';
import { getFieldBookings, updateBookingStatus } from '@/lib/bookings';
import type { Field, Booking, BookingType } from '@/types';

type BookingWithField = Booking & { fieldName: string };

type Tab = 'rezerwacje' | 'ustawienia';

const inputCls =
  'border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function StatusBadge({ status }: { status: Booking['status'] }) {
  const map: Record<Booking['status'], { label: string; cls: string }> = {
    pending: { label: 'Oczekujące', cls: 'bg-amber-100 text-amber-700' },
    confirmed: { label: 'Potwierdzone', cls: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Anulowane', cls: 'bg-slate-100 text-slate-500' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function AdminFieldPage() {
  const { fieldId } = useParams<{ fieldId: string }>();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = useAdmin();

  const [pageLoading, setPageLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [field, setField] = useState<Field | null>(null);
  const [tab, setTab] = useState<Tab>('rezerwacje');

  // --- Rezerwacje tab ---
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [allBookings, setAllBookings] = useState<BookingWithField[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  // --- Ustawienia tab ---
  const [bookingType, setBookingType] = useState<BookingType>('none');
  const [bookingUrl, setBookingUrl] = useState('');
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    setBookingsLoading(true);
    try {
      const data = await getFieldBookings(fieldId);
      setAllBookings(data);
    } finally {
      setBookingsLoading(false);
    }
  }, [fieldId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setNotAllowed(true);
      setPageLoading(false);
      return;
    }

    getField(fieldId)
      .then((f) => {
        if (f.managerId !== user.id && !isAdmin) {
          setNotAllowed(true);
          return;
        }
        setField(f);
        setBookingType(f.bookingType);
        setBookingUrl(f.bookingUrl ?? '');
        setBookingEnabled(f.bookingEnabled);
      })
      .catch(() => setNotAllowed(true))
      .finally(() => setPageLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isAdmin]);

  useEffect(() => {
    if (!field) return;
    loadBookings();
  }, [field, loadBookings]);

  const bookingsForDate = allBookings.filter((b) => b.date === selectedDate);

  const handleStatus = async (bookingId: string, status: 'confirmed' | 'cancelled') => {
    setBusy((prev) => new Set(prev).add(bookingId));
    try {
      await updateBookingStatus(bookingId, status);
      await loadBookings();
    } catch {
      // silently ignore
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(bookingId);
        return next;
      });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await updateFieldBookingSettings(
        fieldId,
        bookingType,
        bookingType === 'external' ? bookingUrl.trim() || undefined : undefined,
        bookingEnabled,
      );
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Nie udało się zapisać ustawień');
    } finally {
      setSaving(false);
    }
  };

  // --- Loading skeleton ---
  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // --- Not logged in ---
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center">
          <div>
            <Lock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-700">Musisz być zalogowany</p>
            <p className="text-sm text-slate-500 mt-1">Zaloguj się, aby uzyskać dostęp do panelu.</p>
            <Link href="/mapa" className="text-primary-600 text-sm underline mt-4 inline-block">
              Wróć do mapy
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // --- Access denied ---
  if (notAllowed) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center">
          <div>
            <Lock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-700">Brak dostępu</p>
            <p className="text-sm text-slate-500 mt-1">
              Ta strona jest dostępna tylko dla menedżera obiektu lub administratorów.
            </p>
            <Link href="/obiekt" className="text-primary-600 text-sm underline mt-4 inline-block">
              Wróć do obiektów
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {/* Header row */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/obiekt"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {field?.name ?? 'Panel rezerwacji'}
            </h1>
            <p className="text-sm text-slate-500">Panel zarządzania obiektem</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6">
          {(['rezerwacje', 'ustawienia'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                tab === t
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {t === 'rezerwacje' ? 'Rezerwacje' : 'Ustawienia'}
            </button>
          ))}
        </div>

        {/* === Tab: Rezerwacje === */}
        {tab === 'rezerwacje' && (
          <div className="space-y-5">
            {/* Date picker */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Wybierz datę
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Bookings list */}
            {bookingsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : bookingsForDate.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-base font-medium text-slate-600">Brak rezerwacji na ten dzień</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {bookingsForDate.map((booking, idx) => {
                  const isBusy = busy.has(booking.id);
                  return (
                    <div
                      key={booking.id}
                      className={[
                        'px-5 py-4',
                        idx < bookingsForDate.length - 1 ? 'border-b border-slate-100' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          {/* Time + status */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-slate-900 text-sm">
                              {booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)}
                            </span>
                            <StatusBadge status={booking.status} />
                          </div>
                          {/* Player name */}
                          <p className="text-sm font-medium text-slate-800">{booking.userName}</p>
                          {/* Phone */}
                          {booking.phone && (
                            <p className="text-xs text-slate-500 mt-0.5">{booking.phone}</p>
                          )}
                          {/* Players count + sport */}
                          <p className="text-xs text-slate-400 mt-0.5">
                            {booking.playersCount} os.
                            {booking.sport ? ` · ${booking.sport}` : ''}
                          </p>
                        </div>

                        {/* Action buttons */}
                        {booking.status !== 'cancelled' && (
                          <div className="flex gap-2 shrink-0">
                            {booking.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => handleStatus(booking.id, 'confirmed')}
                                isLoading={isBusy}
                                disabled={isBusy}
                                className="bg-green-600 hover:bg-green-700 border-transparent text-white"
                              >
                                Potwierdź
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatus(booking.id, 'cancelled')}
                              isLoading={isBusy}
                              disabled={isBusy}
                              className="border-red-300 text-red-600 hover:bg-red-50"
                            >
                              Anuluj
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* === Tab: Ustawienia === */}
        {tab === 'ustawienia' && (
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <h2 className="text-base font-semibold text-slate-900">Typ rezerwacji</h2>

              {/* Radio: none */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="bookingType"
                  value="none"
                  checked={bookingType === 'none'}
                  onChange={() => setBookingType('none')}
                  className="mt-1 w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">Brak rezerwacji</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Boisko nie przyjmuje rezerwacji przez aplikację
                  </p>
                </div>
              </label>

              {/* Radio: internal */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="bookingType"
                  value="internal"
                  checked={bookingType === 'internal'}
                  onChange={() => setBookingType('internal')}
                  className="mt-1 w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Rezerwacja online (przez aplikację)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gracze mogą rezerwować bezpośrednio — wybierają datę i slot czasowy
                  </p>
                </div>
              </label>

              {/* Radio: external */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="bookingType"
                  value="external"
                  checked={bookingType === 'external'}
                  onChange={() => setBookingType('external')}
                  className="mt-1 w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Rezerwacja zewnętrzna (link)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gracze są przekierowani na zewnętrzny system rezerwacji
                  </p>
                </div>
              </label>

              {/* bookingUrl input — shown only for external */}
              {bookingType === 'external' && (
                <div className="pl-7">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    URL systemu rezerwacji
                  </label>
                  <input
                    type="url"
                    value={bookingUrl}
                    onChange={(e) => setBookingUrl(e.target.value)}
                    placeholder="https://..."
                    className={`${inputCls} w-full`}
                    maxLength={500}
                  />
                </div>
              )}
            </div>

            {/* booking_enabled override */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="text-base font-semibold text-slate-900 mb-3">Widoczność rezerwacji</h2>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bookingEnabled}
                  onChange={(e) => setBookingEnabled(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">Pokaż rezerwację dla tego boiska</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gdy włączone, opcja rezerwacji jest widoczna dla graczy nawet gdy globalna flaga <code className="bg-slate-100 px-1 rounded">FEATURE_RESERVATIONS</code> jest wyłączona.
                  </p>
                </div>
              </label>
            </div>

            {/* Feedback */}
            {saveSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
                Ustawienia zostały zapisane.
              </div>
            )}
            {saveError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {saveError}
              </div>
            )}

            <Button type="submit" size="lg" isLoading={saving} className="w-full">
              Zapisz ustawienia
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
