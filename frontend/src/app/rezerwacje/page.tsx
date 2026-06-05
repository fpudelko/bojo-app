'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Calendar, Clock, MapPin, User } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { getMyBookings, updateBookingStatus } from '@/lib/bookings';
import type { Booking } from '@/types';

type BookingWithField = Booking & { fieldName: string };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDatePl(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pl-PL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: Booking['status'] }) {
  if (status === 'confirmed') {
    return (
      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
        Potwierdzona
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
        Oczekuje
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
      Anulowana
    </span>
  );
}

function BookingCard({
  booking,
  onCancel,
  cancelling,
}: {
  booking: BookingWithField;
  onCancel: (id: string) => void;
  cancelling: string | null;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            {booking.fieldName}
          </p>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span className="capitalize">{formatDatePl(booking.date)}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              {booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={booking.status} />
          <p className="text-sm font-medium text-gray-700">
            {(booking.priceGrosze / 100).toFixed(0)} zł
          </p>
        </div>
      </div>

      {booking.notes && (
        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          {booking.notes}
        </p>
      )}

      {booking.status === 'pending' && (
        <Button
          variant="outline"
          size="sm"
          isLoading={cancelling === booking.id}
          onClick={() => onCancel(booking.id)}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          Anuluj
        </Button>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">{title}</h2>
  );
}

export default function MyBookingsPage() {
  const { user, loading: authLoading } = useAuth();

  const [bookings, setBookings] = useState<BookingWithField[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadingBookings(true);
    try {
      const data = await getMyBookings(user.id);
      setBookings(data);
    } finally {
      setLoadingBookings(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Na pewno anulować tę rezerwację?')) return;
    setCancelling(bookingId);
    try {
      await updateBookingStatus(bookingId, 'cancelled');
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Nie udało się anulować rezerwacji.');
    } finally {
      setCancelling(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-4">
          <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <User className="w-10 h-10 mx-auto mb-4 text-gray-300" />
            <h1 className="text-xl font-bold text-gray-900">Moje rezerwacje</h1>
            <p className="text-gray-500 text-sm mt-2 mb-6">
              Zaloguj się, aby zobaczyć swoje rezerwacje.
            </p>
            <Button onClick={() => { window.location.href = `/logowanie?next=${encodeURIComponent(window.location.pathname)}`; }}>Zaloguj się</Button>
          </div>
        </main>
      </div>
    );
  }

  const today = todayIso();

  const upcoming = bookings
    .filter((b) => b.date >= today && (b.status === 'pending' || b.status === 'confirmed'))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const awaitingPast = bookings
    .filter((b) => b.date < today && b.status === 'pending')
    .sort((a, b) => a.date.localeCompare(b.date));

  const history = bookings
    .filter(
      (b) =>
        b.date < today && (b.status === 'confirmed' || b.status === 'cancelled'),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));

  const isEmpty = bookings.length === 0;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Moje rezerwacje</h1>

        {loadingBookings && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!loadingBookings && isEmpty && (
          <div className="text-center py-16 text-gray-500">
            <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-700">Nie masz jeszcze żadnych rezerwacji.</p>
            <p className="text-sm mt-1 mb-6">Znajdź boisko i zarezerwuj swój pierwszy termin.</p>
            <Link
              href="/mapa"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              <MapPin className="w-4 h-4" />
              Przeglądaj boiska
            </Link>
          </div>
        )}

        {!loadingBookings && !isEmpty && (
          <>
            {upcoming.length > 0 && (
              <section className="space-y-3">
                <SectionHeader title="Nadchodzące" />
                {upcoming.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onCancel={handleCancel}
                    cancelling={cancelling}
                  />
                ))}
              </section>
            )}

            {awaitingPast.length > 0 && (
              <section className="space-y-3">
                <SectionHeader title="Oczekujące na potwierdzenie" />
                {awaitingPast.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onCancel={handleCancel}
                    cancelling={cancelling}
                  />
                ))}
              </section>
            )}

            {history.length > 0 && (
              <section className="space-y-3">
                <SectionHeader title="Historia" />
                {history.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onCancel={handleCancel}
                    cancelling={cancelling}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
