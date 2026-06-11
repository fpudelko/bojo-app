'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, CalendarDays } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { getField } from '@/lib/api';
import { getFieldBookings, updateBookingStatus } from '@/lib/bookings';
import type { Field, Booking } from '@/types';

type BookingWithField = Booking & { fieldName: string };

function formatPrice(grosze: number) {
  return (grosze / 100).toFixed(0) + ' zł';
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Oczekujące',
  confirmed: 'Potwierdzone',
  cancelled: 'Anulowane',
};

const STATUS_ORDER: Booking['status'][] = ['pending', 'confirmed', 'cancelled'];

export default function RezerwacjePage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [field, setField] = useState<Field | null>(null);
  const [bookings, setBookings] = useState<BookingWithField[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const loadBookings = useCallback(async () => {
    const data = await getFieldBookings(id);
    setBookings(data);
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); setNotAllowed(true); return; }

    Promise.all([getField(id), getFieldBookings(id)])
      .then(([f, data]) => {
        if (f.managerId !== user.id) { setNotAllowed(true); return; }
        setField(f);
        setBookings(data);
      })
      .catch(() => setNotAllowed(true))
      .finally(() => setLoading(false));
  }, [authLoading, user, id]);

  const handleStatus = async (bookingId: string, status: 'confirmed' | 'cancelled') => {
    setBusy((prev) => new Set(prev).add(bookingId));
    try {
      await updateBookingStatus(bookingId, status);
      await loadBookings();
    } catch {
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(bookingId);
        return next;
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-8" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
          </div>
        </main>
      </div>
    );
  }

  if (notAllowed) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <Lock className="w-10 h-10 mx-auto mb-4 text-slate-300" />
            <p className="font-medium text-slate-700">Brak dostępu</p>
            <Link href={`/obiekt/${id}`} className="text-primary-600 text-sm underline mt-3 inline-block">
              Wróć do obiektu
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const grouped = STATUS_ORDER.reduce<Record<string, BookingWithField[]>>(
    (acc, status) => {
      acc[status] = bookings.filter((b) => b.status === status);
      return acc;
    },
    {},
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/obiekt/${id}`}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Rezerwacje</h1>
            {field && <p className="text-sm text-slate-500">{field.name}</p>}
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <CalendarDays className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-700">Brak rezerwacji</p>
            <p className="text-sm text-slate-400 mt-1">Rezerwacje pojawią się tutaj po tym, jak klienci zaczną rezerwować sloty.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {STATUS_ORDER.map((status) => {
              const group = grouped[status];
              if (group.length === 0) return null;

              const sectionColors: Record<string, string> = {
                pending: 'text-amber-700',
                confirmed: 'text-green-700',
                cancelled: 'text-slate-500',
              };

              return (
                <section key={status}>
                  <h2 className={['text-sm font-semibold uppercase tracking-wide mb-3', sectionColors[status]].join(' ')}>
                    {STATUS_LABELS[status]} ({group.length})
                  </h2>
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    {group.map((booking, idx) => {
                      const isBusy = busy.has(booking.id);
                      const isCancelled = booking.status === 'cancelled';
                      return (
                        <div
                          key={booking.id}
                          className={[
                            'px-5 py-4',
                            idx < group.length - 1 ? 'border-b border-slate-100' : '',
                            isCancelled ? 'opacity-50' : '',
                          ].join(' ')}
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900">{booking.userName}</p>
                              <p className="text-sm text-slate-500 mt-0.5">
                                {booking.date} &middot; {booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)}
                              </p>
                              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                                {formatPrice(booking.priceGrosze)}
                              </p>
                              {booking.notes && (
                                <p className="text-xs text-slate-400 mt-1 italic">{booking.notes}</p>
                              )}
                            </div>

                            {!isCancelled && (
                              <div className="flex gap-2 shrink-0">
                                {booking.status === 'pending' && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => handleStatus(booking.id, 'confirmed')}
                                      isLoading={isBusy}
                                      disabled={isBusy}
                                      className="bg-green-600 hover:bg-green-700 border-transparent text-white"
                                    >
                                      Potwierdź
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleStatus(booking.id, 'cancelled')}
                                      isLoading={isBusy}
                                      disabled={isBusy}
                                      className="border-red-300 text-red-600 hover:bg-red-50"
                                    >
                                      Odrzuć
                                    </Button>
                                  </>
                                )}
                                {booking.status === 'confirmed' && (
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
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
